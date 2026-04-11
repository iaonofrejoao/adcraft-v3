-- Migration: 009_create_projects
-- Created: 2026-04-05
-- Description: Cria a tabela projects — container de trabalho para um produto
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             007_create_products, 008_create_templates

BEGIN;

-- ============================================================
-- TABLE: projects
-- Purpose: Container de trabalho que agrupa execuções, ativos e campanhas
--          relacionados a uma estratégia de marketing de um produto específico
-- Written by: Modal "Novo projeto" (frontend) via POST /projects
-- Read by: Tela de Projetos; Tela de Fluxo; todos os agentes que precisam
--          de configuração de campanha (ad_account, budget, plataformas)
-- ============================================================

CREATE TABLE projects (
  -- Primary key
  id                               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id                          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id                       UUID          NOT NULL REFERENCES products(id),
  template_id                      UUID          REFERENCES templates(id) ON DELETE SET NULL,

  -- Identificação
  name                             VARCHAR(255)  NOT NULL,

  -- Configuração de contas de anúncio
  ad_account_facebook              VARCHAR(100),
  ad_account_google                VARCHAR(100),

  -- Budget de teste
  budget_for_test                  NUMERIC(10,2),

  -- Comportamento do orquestrador em falha de viabilidade
  orchestrator_behavior_on_failure orchestrator_behavior NOT NULL DEFAULT 'agent_decides',

  -- Soft delete
  deleted_at                       TIMESTAMPTZ   DEFAULT NULL,

  -- Timestamps
  created_at                       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_projects_user_id
  ON projects(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_product_id
  ON projects(product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_updated_at
  ON projects(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Trigger
CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_projects" ON projects
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE projects IS
'Container de trabalho para um produto. Um projeto agrupa todas as execuções, ativos '
'e campanhas relacionados àquela estratégia de marketing de um produto específico. '
'Um produto pode ter múltiplos projetos (ex: um para Facebook, outro para Google). '
'Os ativos gerados pertencem ao produto, mas são criados no contexto de um projeto.';

COMMENT ON COLUMN projects.user_id IS
'Dono do projeto. RLS garante que cada usuário acessa apenas seus próprios projetos. '
'Cascade delete: remover o usuário remove todos os seus projetos.';

COMMENT ON COLUMN projects.product_id IS
'Produto afiliado que este projeto promove. Sem cascade delete — um projeto não '
'deve ser removido automaticamente se o produto for deletado. A integridade '
'referencial exige que o produto exista enquanto o projeto existir.';

COMMENT ON COLUMN projects.template_id IS
'Template de fluxo usado como base para novas execuções neste projeto. '
'SET NULL se o template for arquivado ou deletado — o projeto permanece. '
'Execuções já criadas usam seu próprio template_snapshot e não são afetadas.';

COMMENT ON COLUMN projects.name IS
'Nome de exibição do projeto na interface. Definido pelo usuário no modal de criação. '
'Exemplos: "Detox Pro — Facebook BR", "Suplemento X — Google Search", "Teste de Verão".';

COMMENT ON COLUMN projects.ad_account_facebook IS
'ID da conta de anúncio do Facebook Ads (sem o prefixo "act_"). '
'Exemplos: "1234567890". Usado pelo Agente 15 (Media Buyer Facebook) '
'ao criar campanhas via Meta Marketing API. Nulo se o projeto não usar Facebook Ads.';

COMMENT ON COLUMN projects.ad_account_google IS
'ID do cliente do Google Ads (customer ID, formato XXX-XXX-XXXX). '
'Usado pelo Agente 16 (Media Buyer Google) ao criar campanhas via Google Ads API. '
'Nulo se o projeto não usar Google Ads.';

COMMENT ON COLUMN projects.budget_for_test IS
'Budget total em BRL disponível para o teste inicial de criativos. '
'Injetado no shared_state como product.budget_for_test e usado pelo Agente 6 '
'(Estrategista de Campanha) para distribuir budget entre os conjuntos de anúncio. '
'Nulo permite que o usuário defina o budget diretamente na configuração de cada execução.';

COMMENT ON COLUMN projects.orchestrator_behavior_on_failure IS
'Define a reação do Orquestrador (Agente 0) quando o Agente 2 (Viabilidade) '
'emite veredicto not_viable para o produto: '
'stop = pausa o fluxo e notifica o usuário para decisão manual; '
'continue = segue com flag viability_warning em todos os nós seguintes; '
'agent_decides = Orquestrador analisa o laudo — margem positiva continua, '
'restrição legal ou score abaixo de 30 para. Padrão: agent_decides.';

COMMENT ON COLUMN projects.deleted_at IS
'Timestamp de soft delete. Nulo = projeto ativo. '
'Registros deletados são ignorados em todas as queries e listagens. '
'Execuções, ativos e campanhas vinculados permanecem no banco para fins de histórico. '
'Hard delete disponível apenas via ação explícita do usuário.';

COMMENT ON COLUMN projects.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN projects.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_projects_updated_at. '
'Usado para ordenar a lista de projetos por atividade recente (ORDER BY updated_at DESC).';

COMMIT;
