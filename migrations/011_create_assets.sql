-- Migration: 011_create_assets
-- Created: 2026-04-05
-- Description: Cria a tabela assets — todos os arquivos de mídia e conteúdo
--              gerados pelas execuções dos agentes
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             007_create_products, 009_create_projects, 010_create_executions

BEGIN;

-- ============================================================
-- TABLE: assets
-- Purpose: Armazena referências e metadados de todos os ativos gerados
-- Written by: Agentes 9 (Personagem), 10 (Keyframes), 11 (Vídeo por Cena),
--             12 (Diretor de Criativo) — via save_asset_atomically();
--             Agente 8 (Copywriter) para ativos de texto
-- Read by: Tela de Biblioteca; Agente 17 (Performance) para cruzamento
--          de métricas; modal de nova execução composta; Agente 12
--          para montar o vídeo final
-- ============================================================

CREATE TABLE assets (
  -- Primary key
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id            UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id         UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id         UUID            NOT NULL REFERENCES products(id),
  execution_id       UUID            NOT NULL REFERENCES executions(id),

  -- Tipo e classificação
  asset_type         asset_type      NOT NULL,

  -- Arquivo físico no R2
  file_url           TEXT,
  file_extension     VARCHAR(20),
  file_size_bytes    BIGINT,

  -- Ciclo de aprovação
  approval_status    approval_status NOT NULL DEFAULT 'pending',
  approved_at        TIMESTAMPTZ,

  -- Histórico de tentativas e feedback
  feedback_history   JSONB           NOT NULL DEFAULT '[]',

  -- Metadados de marketing (ativos de vídeo final)
  marketing_metadata JSONB           NOT NULL DEFAULT '{}',

  -- Integridade do arquivo (R2 + Supabase em sincronia)
  integrity_status   VARCHAR(50)     NOT NULL DEFAULT 'valid',

  -- Soft delete
  deleted_at         TIMESTAMPTZ     DEFAULT NULL,

  -- Timestamps
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_assets_project_id
  ON assets(project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assets_product_id
  ON assets(product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assets_execution_id
  ON assets(execution_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assets_type
  ON assets(project_id, asset_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assets_approved
  ON assets(project_id, asset_type)
  WHERE approval_status = 'approved' AND deleted_at IS NULL;

CREATE INDEX idx_assets_product_type_approved
  ON assets(product_id, asset_type)
  WHERE approval_status = 'approved' AND deleted_at IS NULL;

-- Trigger
CREATE TRIGGER set_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_assets" ON assets
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- COMENTÁRIOS DE TABELA E COLUNAS
-- ============================================================

COMMENT ON TABLE assets IS
'Todos os arquivos de mídia e conteúdo gerados pelas execuções. Pertence ao produto '
'(não ao projeto), permitindo reutilização entre projetos do mesmo produto. '
'O projeto e a execução de origem são registrados para rastreabilidade completa. '
'Todo ativo com arquivo físico é salvo atomicamente: R2 + Supabase na mesma operação '
'via save_asset_atomically() — nunca há registro sem arquivo nem arquivo sem registro.';

COMMENT ON COLUMN assets.user_id IS
'Dono do ativo. RLS garante que cada usuário acessa apenas seus próprios ativos. '
'Cascade delete: remover o usuário remove todos os seus ativos (registro no banco). '
'O arquivo físico no R2 permanece e deve ser removido separadamente.';

COMMENT ON COLUMN assets.project_id IS
'Projeto no contexto do qual o ativo foi gerado. Cascade delete: '
'remover o projeto remove todos os registros de ativos vinculados.';

COMMENT ON COLUMN assets.product_id IS
'Produto ao qual o ativo pertence. Sem cascade delete — ativos sobrevivem '
'independentemente do projeto. Permite reutilizar um personagem gerado em '
'um projeto em outro projeto do mesmo produto via execução composta.';

COMMENT ON COLUMN assets.execution_id IS
'Execução que gerou este ativo. Sem cascade delete — mantém rastreabilidade '
'mesmo após a execução ser finalizada.';

COMMENT ON COLUMN assets.asset_type IS
'Tipo do ativo conforme enum asset_type: '
'character = imagem de referência do personagem visual (PNG); '
'keyframe = imagem do primeiro frame de uma cena (PNG); '
'video_clip = clipe de vídeo gerado para uma cena (MP4); '
'final_video = vídeo final montado pelo Diretor de Criativo (MP4); '
'script = roteiro em texto gerado pelo Roteirista (sem file_url); '
'copy = textos de anúncio — headline, body, CTA (sem file_url); '
'hook = variação de hook testável (sem file_url); '
'audio_narration = áudio de narração gerado por TTS (MP3).';

COMMENT ON COLUMN assets.file_url IS
'URL permanente do arquivo no Cloudflare R2. '
'Nulo apenas para ativos de texto (script, copy, hook) que não têm arquivo físico. '
'Para todos os demais tipos: nunca nulo após criação — salvo atomicamente.';

COMMENT ON COLUMN assets.file_extension IS
'Extensão do arquivo sem ponto. Exemplos: mp4, png, mp3. '
'Nulo para ativos de texto.';

COMMENT ON COLUMN assets.file_size_bytes IS
'Tamanho do arquivo em bytes. Usado para exibir tamanho na Biblioteca '
'e para validar o limite de 500MB do Facebook Ads para vídeos.';

COMMENT ON COLUMN assets.approval_status IS
'Status do ciclo de revisão humana: '
'pending = aguardando revisão (estado inicial); '
'approved = aprovado pelo usuário, disponível para uso em campanhas e novas execuções; '
'rejected = reprovado — agente reexecuta com o último feedback como contexto; '
'approved_with_feedback = aprovado com comentários registrados no feedback_history.';

COMMENT ON COLUMN assets.approved_at IS
'Timestamp da última aprovação. Nulo enquanto approval_status = pending ou rejected.';

COMMENT ON COLUMN assets.feedback_history IS
'Array JSON com o histórico completo de tentativas e feedbacks de revisão. '
'Cada elemento representa uma tentativa de geração. Estrutura:
[
  {
    "attempt":         "integer — número da tentativa (1, 2, 3...)",
    "feedback":        "string — texto do feedback fornecido pelo usuário ao reprovar",
    "auto_eval_passed":"boolean — se a auto-avaliação do agente foi aprovada",
    "auto_eval_notes": "string | null — notas da auto-avaliação interna do agente",
    "created_at":      "ISO8601 — timestamp desta tentativa"
  }
]
Nulo ou array vazio = ativo aprovado na primeira tentativa sem feedback.';

COMMENT ON COLUMN assets.marketing_metadata IS
'JSON com metadados de marketing do criativo. Preenchido pelo Agente 12 '
'(Diretor de Criativo) para ativos do tipo final_video. Vazio para outros tipos. '
'Usado pelo Agente 17 (Performance) para correlacionar padrões de criativo com ROAS. '
'Estrutura completa:
{
  "angle_type":             "string — ex: betrayed_authority, transformation, fear, curiosity",
  "emotional_trigger":      "string — emoção primária ativada no espectador",
  "hook_text":              "string — frase de abertura verbatim",
  "narrative_structure":    "string — ex: pas, aida, bab, storytelling, direct",
  "format":                 "string — ex: ugc, vsl, interview, demo, podcast, testimonial",
  "duration_seconds":       "number — duração real do vídeo final",
  "target_audience_summary":"string — resumo do público-alvo em 1 frase",
  "pain_addressed":         "string — dor principal endereçada no criativo",
  "objections_broken":      "array de strings — objeções quebradas no vídeo",
  "cta_text":               "string — texto do call-to-action verbatim",
  "confidence_score":       "number 0-100 — score de qualidade auto-atribuído pelo Agente 12"
}';

COMMENT ON COLUMN assets.integrity_status IS
'Status de integridade entre o registro no banco e o arquivo no R2: '
'valid = arquivo no R2 confirmado (estado normal); '
'orphan = arquivo no R2 existe mas sem registro correspondente no banco '
'         (pode ocorrer se o save_asset_atomically() for interrompido antes do INSERT); '
'corrupted = registro no banco existe mas arquivo no R2 não foi encontrado '
'            (pode ocorrer se o arquivo foi deletado manualmente no R2). '
'Verificado periodicamente por job de integridade (a implementar).';

COMMENT ON COLUMN assets.deleted_at IS
'Timestamp de soft delete. Nulo = ativo disponível na Biblioteca. '
'O arquivo físico no R2 NÃO é deletado junto — permanece até ação explícita do usuário. '
'Hard delete do arquivo no R2 disponível apenas via confirmação explícita.';

COMMENT ON COLUMN assets.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN assets.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_assets_updated_at.';

COMMIT;
