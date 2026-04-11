-- Migration: 012_create_campaigns
-- Created: 2026-04-05
-- Description: Cria as tabelas campaigns e performance_snapshots —
--              campanhas de anúncio e seus snapshots diários de métricas
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             009_create_projects, 010_create_executions

BEGIN;

-- ============================================================
-- TABLE: campaigns
-- Purpose: Campanhas de anúncio criadas pela plataforma no Facebook e Google
-- Written by: Agentes 15 (Media Buyer Facebook) e 16 (Media Buyer Google)
--             via tools create_facebook_campaign / create_google_campaign;
--             POST /campaigns/{id}/activate após aprovação humana
-- Read by: Tela de Campanhas; Agente 17 (Performance) para leitura de métricas;
--          Agente 18 (Escalador) para pausar/escalar
-- ============================================================

CREATE TABLE campaigns (
  -- Primary key
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id           UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_execution_id  UUID         NOT NULL REFERENCES executions(id),

  -- Identificação
  platform             VARCHAR(50)  NOT NULL,
  name                 VARCHAR(255) NOT NULL,

  -- Referência externa na plataforma de anúncio
  external_campaign_id VARCHAR(255),

  -- Estado
  status               VARCHAR(50)  NOT NULL DEFAULT 'paused',

  -- Budget
  daily_budget_brl     NUMERIC(10,2),

  -- Timestamps de ciclo de vida da campanha
  launched_at          TIMESTAMPTZ,
  paused_at            TIMESTAMPTZ,

  -- Timestamps padrão
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_campaigns_project_id
  ON campaigns(project_id);

CREATE INDEX idx_campaigns_user_id
  ON campaigns(user_id);

CREATE INDEX idx_campaigns_status
  ON campaigns(user_id, status)
  WHERE status = 'active';

CREATE INDEX idx_campaigns_platform
  ON campaigns(project_id, platform);

-- Trigger
CREATE TRIGGER set_campaigns_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_campaigns" ON campaigns
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE campaigns IS
'Campanhas de anúncio criadas pela plataforma no Facebook Ads ou Google Ads. '
'Pertence ao projeto (não à execução), pois continua existindo e acumulando dados '
'após novas execuções. Toda campanha é criada em status paused — a ativação '
'só ocorre após aprovação humana explícita na Tela de Revisão de Lançamento. '
'Nunca ativar automaticamente sem confirmação do usuário.';

COMMENT ON COLUMN campaigns.user_id IS
'Dono da campanha. RLS garante acesso exclusivo do usuário aos seus dados. '
'Cascade delete: remover o usuário remove os registros de campanha no banco '
'(mas não pausa/deleta a campanha na plataforma de anúncio — ação manual necessária).';

COMMENT ON COLUMN campaigns.project_id IS
'Projeto ao qual a campanha pertence. Cascade delete: remover o projeto '
'remove os registros de campanha e seus snapshots de performance.';

COMMENT ON COLUMN campaigns.source_execution_id IS
'Execução que gerou os criativos e estrutura desta campanha. '
'Mantém rastreabilidade de quais ativos, copy e configuração de público '
'deram origem a esta campanha específica.';

COMMENT ON COLUMN campaigns.platform IS
'Plataforma de anúncio onde a campanha foi criada. Valores esperados: '
'facebook, google. Determina qual API usar para leitura de métricas '
'(get_facebook_campaign_metrics vs get_google_campaign_metrics).';

COMMENT ON COLUMN campaigns.name IS
'Nome da campanha conforme criado na plataforma de anúncio. '
'Gerado automaticamente pelo Media Buyer com base no produto, ângulo e formato. '
'Exemplo: "detox-pro-ugc-autoridade-v1-BR".';

COMMENT ON COLUMN campaigns.external_campaign_id IS
'ID da campanha na plataforma de anúncio. '
'Facebook: campaign ID numérico retornado pela Meta Marketing API. '
'Google: campaign ID numérico retornado pela Google Ads API. '
'Nulo enquanto a campanha está sendo criada (janela de criação assíncrona).';

COMMENT ON COLUMN campaigns.status IS
'Estado atual da campanha. Valores: '
'paused = criada mas não ativa (estado inicial obrigatório); '
'active = ativada após aprovação humana na Tela de Revisão de Lançamento; '
'archived = pausada manualmente e encerrada pelo usuário ou pelo Agente 18. '
'REGRA CRÍTICA: status nunca vai de paused para active sem ação humana explícita.';

COMMENT ON COLUMN campaigns.daily_budget_brl IS
'Budget diário da campanha em BRL no momento da criação. '
'Pode ser aumentado pelo Agente 18 (Escalador) após aprovação humana. '
'Apenas referência — o budget real está na plataforma de anúncio.';

COMMENT ON COLUMN campaigns.launched_at IS
'Timestamp de quando a campanha foi ativada pela primeira vez. '
'Nulo enquanto status = paused. Imutável após o primeiro lançamento.';

COMMENT ON COLUMN campaigns.paused_at IS
'Timestamp da última pausa da campanha. Atualizado pelo Agente 18 '
'ou por ação manual do usuário via POST /campaigns/{id}/pause.';

COMMENT ON COLUMN campaigns.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN campaigns.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_campaigns_updated_at.';


-- ============================================================
-- TABLE: performance_snapshots
-- Purpose: Snapshots diários de métricas de performance das campanhas
-- Written by: Agente 17 (Analista de Performance) às 5h via Celery Beat
--             ou sob demanda via POST /campaigns/{id}/refresh-metrics
-- Read by: Tela de Campanhas (último snapshot); gráficos de histórico;
--          Agente 17 para diagnóstico de tendências; Agente 18 para decisões
-- ============================================================

CREATE TABLE performance_snapshots (
  -- Primary key
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id    UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  project_id     UUID          NOT NULL REFERENCES projects(id),

  -- Período do snapshot
  snapshot_date  DATE          NOT NULL,

  -- Métricas de entrega
  spend_brl      NUMERIC(10,2),
  impressions    BIGINT,
  clicks         INTEGER,

  -- Métricas de eficiência
  ctr            NUMERIC(5,4),
  cpc_brl        NUMERIC(10,4),
  cpm_brl        NUMERIC(10,4),

  -- Métricas de conversão
  conversions    INTEGER,
  roas           NUMERIC(5,2),
  cpa_brl        NUMERIC(10,2),

  -- Diagnóstico do agente
  diagnosis      TEXT,

  -- Timestamp de criação (sem updated_at — snapshots são imutáveis)
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Garante um snapshot por campanha por dia
  UNIQUE (campaign_id, snapshot_date)
);

-- Índices
CREATE INDEX idx_performance_campaign_date
  ON performance_snapshots(campaign_id, snapshot_date DESC);

CREATE INDEX idx_performance_project_date
  ON performance_snapshots(project_id, snapshot_date DESC);

-- Comentários de tabela e colunas
COMMENT ON TABLE performance_snapshots IS
'Snapshots diários de métricas de performance das campanhas. '
'Gerados automaticamente às 5h pelo Agente 17 (Celery Beat) ou sob demanda manual. '
'Imutáveis após inserção — nunca atualizados, apenas inseridos. '
'A constraint UNIQUE(campaign_id, snapshot_date) garante um registro por dia por campanha. '
'Usados pelo Agente 17 para identificar tendências (3+ dias consecutivos abaixo da meta).';

COMMENT ON COLUMN performance_snapshots.campaign_id IS
'Campanha à qual este snapshot pertence. '
'Cascade delete: remover a campanha remove todo o histórico de performance.';

COMMENT ON COLUMN performance_snapshots.project_id IS
'Projeto da campanha. Duplicado aqui para simplificar queries de '
'histórico de performance por projeto sem JOIN com campaigns.';

COMMENT ON COLUMN performance_snapshots.snapshot_date IS
'Data a que se referem as métricas (não o dia de coleta). '
'As métricas do dia D são coletadas às 5h do dia D+1. '
'Formato: DATE (sem timezone) — sempre no fuso do ad account.';

COMMENT ON COLUMN performance_snapshots.spend_brl IS
'Gasto total da campanha neste dia em BRL. '
'Nulo se a plataforma de anúncio não retornou dados (campanha pausada ou erro de API).';

COMMENT ON COLUMN performance_snapshots.impressions IS
'Total de impressões da campanha no dia.';

COMMENT ON COLUMN performance_snapshots.clicks IS
'Total de cliques no link do anúncio no dia.';

COMMENT ON COLUMN performance_snapshots.ctr IS
'Click-through rate: clicks / impressions. Armazenado como decimal (0.0250 = 2.50%). '
'Comparado com strategy.min_ctr_percent pelo Agente 17 para diagnóstico.';

COMMENT ON COLUMN performance_snapshots.cpc_brl IS
'Custo por clique em BRL: spend / clicks.';

COMMENT ON COLUMN performance_snapshots.cpm_brl IS
'Custo por mil impressões em BRL: (spend / impressions) * 1000. '
'Comparado com strategy.max_cpm_brl pelo Agente 17.';

COMMENT ON COLUMN performance_snapshots.conversions IS
'Total de conversões (compras confirmadas) atribuídas à campanha no dia.';

COMMENT ON COLUMN performance_snapshots.roas IS
'Return on Ad Spend: receita_atribuída / spend. '
'Comparado com strategy.target_roas pelo Agente 17 para classificar '
'a campanha como winner (acima) ou loser (abaixo por 3+ dias consecutivos).';

COMMENT ON COLUMN performance_snapshots.cpa_brl IS
'Custo por aquisição em BRL: spend / conversions. '
'Comparado com strategy.max_cpa_brl pelo Agente 17.';

COMMENT ON COLUMN performance_snapshots.diagnosis IS
'Diagnóstico textual gerado pelo Agente 17 para este dia. Exemplos: '
'"CTR abaixo do mínimo — possível problema com o hook ou criativo"; '
'"ROAS acima da meta pelo 3º dia consecutivo — candidato a escala"; '
'"Frequência alta (4.2) — sinal de saturação de público". '
'Nulo se o snapshot foi gerado por coleta automática sem análise (sob demanda simples).';

COMMENT ON COLUMN performance_snapshots.created_at IS
'Data e hora de criação do snapshot, com fuso horário. Imutável após inserção. '
'Representa o momento da coleta, não a data das métricas (snapshot_date).';

COMMIT;
