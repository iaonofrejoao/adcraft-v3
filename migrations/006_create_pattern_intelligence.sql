-- Migration: 006_create_pattern_intelligence
-- Created: 2026-04-05
-- Description: Cria a tabela pattern_intelligence — inteligência de padrões
--              cross-nicho inferida automaticamente dos dados de performance
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users

BEGIN;

-- ============================================================
-- TABLE: pattern_intelligence
-- Purpose: Padrões de performance que transcendem nichos específicos
-- Written by: Agente 17 (Analista de Performance) no ciclo diário de análise
-- Read by: Agentes 4 (Ângulo), 5 (Benchmark), 6 (Estratégia)
--          via query_pattern_intelligence(pattern_type, pattern_value)
-- ============================================================

CREATE TABLE pattern_intelligence (
  -- Primary key
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do padrão
  pattern_type        VARCHAR(100)  NOT NULL,
  pattern_value       VARCHAR(255)  NOT NULL,

  -- Escopo de aplicação
  applicable_niches   TEXT[],

  -- Métricas de performance agregadas
  avg_roas            NUMERIC(5,2),
  sample_size         INTEGER       NOT NULL DEFAULT 0,
  confidence_score    NUMERIC(5,2)  NOT NULL DEFAULT 50.0,

  -- Timestamps
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pattern_intelligence_type_value
  ON pattern_intelligence(pattern_type, pattern_value);

CREATE INDEX idx_pattern_intelligence_confidence
  ON pattern_intelligence(pattern_type, confidence_score DESC)
  WHERE sample_size >= 5;

-- Trigger
CREATE TRIGGER set_pattern_intelligence_updated_at
BEFORE UPDATE ON pattern_intelligence
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS — leitura para todos autenticados; escrita exclusiva ao service role
ALTER TABLE pattern_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_pattern_intelligence" ON pattern_intelligence
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_write_pattern_intelligence" ON pattern_intelligence
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comentários de tabela e colunas
COMMENT ON TABLE pattern_intelligence IS
'Padrões de performance que transcendem nichos específicos. Exemplos: '
'ângulo de autoridade traída tem ROAS médio 3.8x em nichos de saúde; '
'formato UGC converte melhor que VSL em produtos de ticket abaixo de R$200. '
'Alimentado automaticamente pelo Agente 17 ao final de cada ciclo de análise de performance. '
'Não requer aprovação humana — inferido de dados reais de campanhas.';

COMMENT ON COLUMN pattern_intelligence.pattern_type IS
'Dimensão do padrão observado. Valores esperados: '
'angle_type = tipo de ângulo criativo (betrayed_authority, transformation, fear, etc.); '
'creative_format = formato do vídeo (ugc, vsl, interview, demo, podcast); '
'narrative_structure = estrutura narrativa (pas, aida, bab, storytelling); '
'hook_type = tipo de abertura (question, shocking_statement, story, fact); '
'audience_gender = gênero predominante do público (masculino, feminino, misto); '
'audience_age_range = faixa etária predominante (18-24, 25-34, 35-45, 45+).';

COMMENT ON COLUMN pattern_intelligence.pattern_value IS
'Valor específico do padrão dentro do pattern_type. Exemplos: '
'para pattern_type=angle_type → "betrayed_authority"; '
'para pattern_type=creative_format → "ugc"; '
'para pattern_type=narrative_structure → "pas".';

COMMENT ON COLUMN pattern_intelligence.applicable_niches IS
'Array de slugs de nichos onde este padrão foi observado e validado. '
'Nulo ou array vazio indica padrão universal (válido em todos os nichos). '
'Exemplos: [''emagrecimento'', ''diabetes''] ou [''renda_extra''].';

COMMENT ON COLUMN pattern_intelligence.avg_roas IS
'ROAS médio observado em campanhas que utilizaram este padrão. '
'Calculado como média ponderada pelo spend de todas as campanhas do sample. '
'Nulo enquanto sample_size < 3 (dados insuficientes para média confiável).';

COMMENT ON COLUMN pattern_intelligence.sample_size IS
'Número de campanhas distintas que compõem a base de cálculo deste padrão. '
'O índice de confiança só é consultado pelos agentes quando sample_size >= 5.';

COMMENT ON COLUMN pattern_intelligence.confidence_score IS
'Score de confiança de 0.00 a 100.00, calculado pelo Agente 17 com base em: '
'consistência do ROAS entre as campanhas do sample (baixa variância = score alto), '
'tamanho do sample (mais campanhas = mais confiança), '
'recência dos dados (dados recentes têm peso maior). '
'Nunca ultrapassa 100 nem vai abaixo de 0.';

COMMENT ON COLUMN pattern_intelligence.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN pattern_intelligence.updated_at IS
'Data e hora da última atualização das métricas agregadas, com fuso horário. '
'Atualizado automaticamente pelo trigger set_pattern_intelligence_updated_at '
'cada vez que o Agente 17 recalcula avg_roas, sample_size ou confidence_score.';

COMMIT;
