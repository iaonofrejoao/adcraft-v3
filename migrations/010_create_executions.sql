-- Migration: 010_create_executions
-- Created: 2026-04-05
-- Description: Cria a tabela executions — instância de rodada do fluxo de agentes
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             009_create_projects

BEGIN;

-- ============================================================
-- TABLE: executions
-- Purpose: Registra cada rodada do fluxo de agentes dentro de um projeto,
--          incluindo todo o estado compartilhado entre os agentes
-- Written by: POST /executions (cria o registro); Celery workers (atualizam
--             shared_state, node_statuses, status, custos após cada nó)
-- Read by: Frontend via GET /executions/{id} e Supabase Realtime;
--          Orquestrador e todos os agentes via ContextBuilder;
--          Agente 17 (Performance) para histórico de execuções
-- ============================================================

CREATE TABLE executions (
  -- Primary key
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  project_id          UUID             NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Reutilização de ativos de execuções anteriores
  source_execution_ids UUID[],

  -- Snapshot imutável do template no momento da criação
  template_snapshot   JSONB            NOT NULL,

  -- Estado central dos agentes
  shared_state        JSONB            NOT NULL DEFAULT '{}',

  -- Status em tempo real de cada nó (publicado via Supabase Realtime)
  node_statuses       JSONB            NOT NULL DEFAULT '{}',

  -- Configurações por nó (modelo, aprovação, variações, ativo)
  node_config         JSONB            NOT NULL DEFAULT '{}',

  -- Status da execução
  status              execution_status NOT NULL DEFAULT 'pending',

  -- Rastreamento de custo
  total_cost_usd      NUMERIC(10,6)    NOT NULL DEFAULT 0,
  total_tokens        INTEGER          NOT NULL DEFAULT 0,

  -- Referência ao task Celery em execução
  celery_task_id      VARCHAR(255),

  -- Timestamps de ciclo de vida
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,

  -- Timestamps padrão
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_executions_project_id
  ON executions(project_id);

CREATE INDEX idx_executions_user_id
  ON executions(user_id);

CREATE INDEX idx_executions_status
  ON executions(status)
  WHERE status IN ('pending', 'running', 'paused_for_approval');

CREATE INDEX idx_executions_created_at
  ON executions(project_id, created_at DESC);

-- Trigger
CREATE TRIGGER set_executions_updated_at
BEFORE UPDATE ON executions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_executions" ON executions
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- COMENTÁRIOS DE TABELA E COLUNAS
-- ============================================================

COMMENT ON TABLE executions IS
'Instância de rodada do fluxo de agentes dentro de um projeto. Cada execução tem '
'seu próprio shared_state isolado e pode reutilizar ativos de execuções anteriores '
'via source_execution_ids. O banco é a fonte de verdade — em caso de crash do worker '
'Celery, a execução retoma do último nó salvo via POST /executions/{id}/resume.';

COMMENT ON COLUMN executions.project_id IS
'Projeto ao qual esta execução pertence. Cascade delete: remover o projeto '
'remove todas as suas execuções, incluindo o shared_state e histórico de nós.';

COMMENT ON COLUMN executions.user_id IS
'Dono da execução. Duplicado aqui (já existe em projects) para simplificar '
'as queries de RLS sem precisar fazer JOIN com projects.';

COMMENT ON COLUMN executions.source_execution_ids IS
'Array de UUIDs de execuções anteriores cujos ativos estão sendo reutilizados '
'nesta execução composta. Nulo ou vazio = execução nova sem reaproveitamento. '
'Populado quando o usuário cria uma nova execução selecionando ativos '
'da Biblioteca (ex: reutilizar personagem de execução anterior com novo roteiro).';

COMMENT ON COLUMN executions.template_snapshot IS
'Snapshot imutável do template no momento de criação da execução. '
'Garante que mudanças futuras no template não afetam execuções existentes. '
'Estrutura idêntica a templates.flow_schema:
{
  "nodes": [{ "id", "type", "position", "data": { "label", "agent_name", ... } }],
  "edges": [{ "id", "source", "target", "type" }],
  "default_node_config": { "{node_id}": { "model", "approval_required", "quantity", "active" } }
}';

COMMENT ON COLUMN executions.shared_state IS
'Documento JSON central que armazena todos os inputs e outputs dos agentes. '
'Lido e escrito pelos Celery workers via StateManager. '
'O ContextBuilder extrai apenas os campos necessários para cada agente — '
'nunca passa o shared_state completo para um agente. '
'Estrutura completa documentada na seção 6 do PRD. Campos principais:
{
  "product":          "{ name, niche, platform, product_url, affiliate_link, ... }",
  "product_analysis": "{ main_promise, pain_points_identified, offer_details, ... }",
  "market":           "{ viability_score, viability_verdict, ads_running_count, ... }",
  "persona":          "{ summary, full_profile, psychographic, verbatim_expressions }",
  "angle":            "{ primary_angle, angle_type, usp, hooks, selected_hook_variant }",
  "benchmark":        "{ top_hooks_found, dominant_formats, audience_verbatim }",
  "strategy":         "{ creative_format, video_duration_seconds, target_roas, ... }",
  "scripts":          "{ scripts[], selected_script_id }",
  "copy":             "{ headlines[], body_copy_short, body_copy_long, cta_options[] }",
  "character":        "{ character_asset_id, character_url, all_variations[] }",
  "keyframes":        "{ keyframes[] }",
  "video_clips":      "{ clips[] }",
  "final_creatives":  "{ creatives[] }",
  "compliance":       "{ facebook_approved, google_approved, issues[] }",
  "tracking":         "{ utm_parameters, final_affiliate_url }",
  "facebook_campaign":"{ campaign_id, adset_ids[], ad_ids[], status }",
  "google_campaign":  "{ campaign_id, adgroup_ids[], ad_ids[], status }",
  "performance":      "{ metrics, winning_asset_ids[], diagnosis, recommended_action }",
  "execution_meta":   "{ total_cost_usd, nodes_completed, approval_pending_node, last_error }"
}';

COMMENT ON COLUMN executions.node_statuses IS
'Status em tempo real de cada nó do fluxo. Atualizado pelo backend após cada mudança '
'de estado e publicado via Supabase Realtime para o canvas React Flow no frontend. '
'Chave = node_id do React Flow. Estrutura por nó:
{
  "{node_id}": {
    "status":          "idle | running | waiting_approval | approved | failed | disabled",
    "cost_usd":        "number — custo acumulado deste nó em USD",
    "tokens":          "number — tokens consumidos por este nó",
    "tooltip_message": "string | null — ex: Aguardando API: YouTube Data · Posição 2 · ~45s",
    "attempts":        "number — tentativas automáticas realizadas",
    "started_at":      "ISO8601 | null",
    "completed_at":    "ISO8601 | null"
  }
}';

COMMENT ON COLUMN executions.node_config IS
'Configurações individuais de cada nó para esta execução específica. '
'Inicializado com os valores de template_snapshot.default_node_config. '
'Modificável pelo usuário via painel lateral de configuração do nó no canvas. '
'Alterações persistem apenas nesta execução — não afetam o template original. '
'Estrutura por nó:
{
  "{node_id}": {
    "model":             "string — ex: claude-opus-4-6, claude-sonnet-4-6",
    "approval_required": "boolean — exige aprovação humana antes de avançar",
    "quantity":          "integer — variações a gerar (1-10, padrão 1)",
    "active":            "boolean — false = nó ignorado durante a execução"
  }
}';

COMMENT ON COLUMN executions.status IS
'Status atual do ciclo de vida da execução: '
'pending = criada, aguardando Celery worker; '
'running = agente em execução no momento; '
'paused_for_approval = fluxo pausado aguardando revisão humana de um nó; '
'completed = todos os nós concluídos e aprovados com sucesso; '
'failed = erro permanente em algum nó — estado preservado para retomada; '
'cancelled = cancelada manualmente pelo usuário via POST /executions/{id}/cancel.';

COMMENT ON COLUMN executions.total_cost_usd IS
'Custo total acumulado de todas as chamadas à Claude API nesta execução, em USD. '
'Atualizado pelo CostTracker após cada chamada ao modelo. '
'Exibido em tempo real no rodapé do canvas e na topbar da execução.';

COMMENT ON COLUMN executions.total_tokens IS
'Total de tokens consumidos (input + output) em todas as chamadas ao Claude API. '
'Atualizado junto com total_cost_usd pelo CostTracker.';

COMMENT ON COLUMN executions.celery_task_id IS
'ID do task Celery em execução para esta execução. '
'Usado para cancelamento via celery_app.control.revoke(task_id). '
'Nulo quando status = pending, completed, failed ou cancelled.';

COMMENT ON COLUMN executions.started_at IS
'Timestamp de quando o Celery worker iniciou o processamento. '
'Nulo enquanto status = pending.';

COMMENT ON COLUMN executions.completed_at IS
'Timestamp de quando a execução atingiu status completed, failed ou cancelled. '
'Nulo enquanto a execução está em andamento.';

COMMENT ON COLUMN executions.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN executions.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_executions_updated_at. '
'Modificado a cada mudança de status, node_statuses ou shared_state.';

COMMIT;
