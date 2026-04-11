-- Migration: 005_create_niches
-- Created: 2026-04-05
-- Description: Cria as tabelas niches e niche_memory — sistema de memória
--              acumulativa compartilhada por nicho de mercado
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users

BEGIN;

-- ============================================================
-- TABLE: niches
-- Purpose: Cadastro de nichos de mercado disponíveis na plataforma
-- Written by: Seed inicial + tela de Nichos (botão "+ Treinar nicho")
-- Read by: Todos os agentes que consultam memória de nicho;
--          tela de Nichos; modal de Novo Projeto
-- ============================================================

CREATE TABLE niches (
  -- Primary key
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name        VARCHAR(255) NOT NULL UNIQUE,
  slug        VARCHAR(255) NOT NULL UNIQUE,

  -- Estado do treinamento
  status      VARCHAR(50)  NOT NULL DEFAULT 'untrained',

  -- Data do último treinamento concluído
  trained_at  TIMESTAMPTZ,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger
CREATE TRIGGER set_niches_updated_at
BEFORE UPDATE ON niches
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comentários de tabela e colunas
COMMENT ON TABLE niches IS
'Nichos de mercado disponíveis na plataforma. A memória de nicho (niche_memory) '
'é compartilhada entre todos os usuários — representa a inteligência coletiva acumulada '
'sobre aquele mercado ao longo de todas as execuções. Não possui user_id nem RLS.';

COMMENT ON COLUMN niches.name IS
'Nome legível do nicho para exibição na interface. Exemplos: Emagrecimento, '
'Crescimento Capilar, Diabetes, Renda Extra, Relacionamentos.';

COMMENT ON COLUMN niches.slug IS
'Identificador de URL do nicho, em snake_case sem acentos. Exemplos: '
'emagrecimento, crescimento_capilar, diabetes, renda_extra. '
'Usado como chave de lookup nos agentes via query_niche_memory(niche).';

COMMENT ON COLUMN niches.status IS
'Estado do treinamento do nicho: '
'untrained = sem dados coletados; '
'training = agente de imersão em execução no momento; '
'trained = memória disponível e aprovada para uso pelos agentes.';

COMMENT ON COLUMN niches.trained_at IS
'Data e hora da conclusão do treinamento mais recente. '
'Nulo enquanto status = untrained. Atualizado a cada novo ciclo de treinamento.';

COMMENT ON COLUMN niches.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN niches.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_niches_updated_at.';


-- ============================================================
-- TABLE: niche_memory
-- Purpose: Base de conhecimento acumulada por nicho de mercado
-- Written by: Agente 5 (Benchmark), ferramentas auxiliares de nicho,
--             aprovação humana via tela de Nichos
-- Read by: Agentes 3 (Persona), 4 (Ângulo), 5 (Benchmark),
--          6 (Estratégia), 7 (Roteiro) — via query_niche_memory()
-- ============================================================

CREATE TABLE niche_memory (
  -- Primary key
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  niche_id             UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  approved_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Tipo e conteúdo do conhecimento
  memory_type          VARCHAR(100) NOT NULL,
  content              TEXT         NOT NULL,

  -- Rastreabilidade da fonte
  source_url           TEXT,
  source_type          VARCHAR(100),

  -- Qualidade e uso
  confidence_score     NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  knowledge_status     knowledge_status NOT NULL DEFAULT 'pending_approval',
  times_validated      INTEGER NOT NULL DEFAULT 0,
  times_invalidated    INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_niche_memory_niche_type
  ON niche_memory(niche_id, memory_type);

CREATE INDEX idx_niche_memory_approved
  ON niche_memory(niche_id)
  WHERE knowledge_status = 'approved';

CREATE INDEX idx_niche_memory_confidence
  ON niche_memory(niche_id, confidence_score DESC)
  WHERE knowledge_status = 'approved';

-- Trigger
CREATE TRIGGER set_niche_memory_updated_at
BEFORE UPDATE ON niche_memory
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS — leitura para todos autenticados; escrita restrita ao service role
ALTER TABLE niche_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_niche_memory" ON niche_memory
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_write_niche_memory" ON niche_memory
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comentários de tabela e colunas
COMMENT ON TABLE niche_memory IS
'Base de conhecimento acumulada por nicho. Alimentada pelos agentes de benchmark '
'e pelas ferramentas auxiliares. Compartilhada entre todos os projetos do mesmo nicho — '
'não pertence a nenhum usuário específico. Requer aprovação humana (knowledge_status = approved) '
'antes de ser consultada pelos agentes via query_niche_memory().';

COMMENT ON COLUMN niche_memory.niche_id IS
'Nicho ao qual este conhecimento pertence. Cascade delete: se o nicho for removido, '
'toda a memória associada é removida junto.';

COMMENT ON COLUMN niche_memory.approved_by_user_id IS
'Usuário que aprovou este item na tela de Nichos → Fila de aprovação. '
'Nulo enquanto knowledge_status = pending_approval. SET NULL se o usuário for deletado.';

COMMENT ON COLUMN niche_memory.memory_type IS
'Categoria do conhecimento armazenado. Valores esperados: '
'hook_pattern = padrão de abertura que performa bem; '
'angle_type = tipo de ângulo validado no nicho; '
'audience_verbatim = expressão real do público coletada de comentários/reviews; '
'format_preference = formato de criativo que performa melhor; '
'objection = objeção recorrente do público; '
'cta_pattern = padrão de CTA eficaz; '
'audience_language = estilo de linguagem do público.';

COMMENT ON COLUMN niche_memory.content IS
'Conteúdo textual do conhecimento. Pode ser uma frase, um padrão descrito, '
'uma expressão verbatim do público ou uma estrutura narrativa. '
'Injetado diretamente no contexto dos agentes durante a execução.';

COMMENT ON COLUMN niche_memory.source_url IS
'URL da fonte original onde o conhecimento foi coletado. '
'Obrigatório para hook_pattern e audience_verbatim — garante que nenhum dado foi inventado. '
'Exibido na tela de fila de aprovação para o usuário verificar antes de aprovar.';

COMMENT ON COLUMN niche_memory.source_type IS
'Tipo da fonte de coleta. Exemplos: facebook_ad, youtube_video, youtube_comment, '
'amazon_review, mercadolivre_review, forum_post, manual_input.';

COMMENT ON COLUMN niche_memory.confidence_score IS
'Score de confiança de 0.00 a 100.00. Score inicial atribuído pelo agente coletor. '
'Aumenta +5 quando uma campanha usando este dado tem ROAS acima da meta. '
'Diminui -10 quando uma campanha usando este dado tem ROAS abaixo do mínimo. '
'Agentes retornam itens com score < 30 com flag low_confidence = true. '
'Nunca ultrapassa 100 nem vai abaixo de 0.';

COMMENT ON COLUMN niche_memory.knowledge_status IS
'pending_approval: coletado pelo agente, aguardando revisão na tela de Nichos. '
'approved: revisado e disponível para consulta pelos agentes. '
'rejected: descartado pelo usuário — mantido no banco para fins de auditoria, '
'nunca retornado pelas queries dos agentes.';

COMMENT ON COLUMN niche_memory.times_validated IS
'Contador de vezes que campanhas usando este dado atingiram ROAS acima da meta. '
'Incrementado pelo Agente 17 (Performance) no ciclo diário de análise.';

COMMENT ON COLUMN niche_memory.times_invalidated IS
'Contador de vezes que campanhas usando este dado ficaram abaixo do ROAS mínimo. '
'Incrementado pelo Agente 17 (Performance) no ciclo diário de análise.';

COMMENT ON COLUMN niche_memory.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN niche_memory.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_niche_memory_updated_at.';

COMMIT;
