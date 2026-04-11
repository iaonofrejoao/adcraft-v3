-- Migration v2/0006_complete_rls.sql
-- Ativa RLS nas 10 tabelas v2 que ainda não tinham policies.
-- pipelines e conversations já têm RLS desde 0001_custom_triggers_rls.sql.
--
-- Estratégias:
--   B  → tabelas vinculadas a pipeline (JOIN pipelines.user_id = auth.uid())
--   C  → product_knowledge (JOIN products.user_id = auth.uid())
--   D1 → niche_learnings — global/compartilhada; SELECT para authenticated, escrita só service_role
--   D2 → embeddings, prompt_caches — service_role apenas; authenticated bloqueado por padrão

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — tasks
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_tasks ON tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — approvals
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_approvals ON approvals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = approvals.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = approvals.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — copy_components
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE copy_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_copy_components ON copy_components
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = copy_components.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = copy_components.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — copy_combinations
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE copy_combinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_copy_combinations ON copy_combinations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = copy_combinations.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = copy_combinations.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — messages (via conversations)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_messages ON messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA B — llm_calls (via pipeline)
-- Linhas sem pipeline_id (ex: embeddings de nicho) ficam invisíveis
-- ao authenticated — aceitável, pois são custos globais sem dono.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_llm_calls ON llm_calls
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = llm_calls.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = llm_calls.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA C — product_knowledge (via products)
-- Knowledge pertence ao produto; sobrevive além do pipeline.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE product_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_product_knowledge ON product_knowledge
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_knowledge.product_id
        AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_knowledge.product_id
        AND products.user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA D1 — niche_learnings
-- Conhecimento global por nicho; niches não têm user_id.
-- Authenticated lê (planner + context-builder precisam disso).
-- Escrita feita exclusivamente por workers via service_role (bypassa RLS).
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE niche_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_niche_learnings ON niche_learnings
  FOR SELECT TO authenticated
  USING (true);

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA D2 — embeddings
-- Apenas service_role (workers). Nenhuma rota frontend lê embeddings
-- diretamente — sempre via rotas server-side com service_role.
-- RLS habilitado sem policy para authenticated = deny por padrão.
-- service_role bypassa RLS automaticamente no Supabase.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA D2 — prompt_caches
-- Infraestrutura interna de workers. Frontend jamais consulta
-- esta tabela diretamente. Mesmo padrão de embeddings.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE prompt_caches ENABLE ROW LEVEL SECURITY;
