-- Migration: 007_create_products
-- Created: 2026-04-05
-- Description: Cria a tabela products — produtos afiliados cadastrados na plataforma
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             005_create_niches

BEGIN;

-- ============================================================
-- TABLE: products
-- Purpose: Produtos afiliados cadastrados pelo usuário
-- Written by: Modal "Novo projeto" (frontend) via POST /projects;
--             Agente 1 (Analisador de VSL) atualiza vsl_transcript
-- Read by: Todos os agentes do fluxo via shared_state.product;
--          tela de Projetos; tela de Biblioteca
-- ============================================================

CREATE TABLE products (
  -- Primary key
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  niche_id            UUID        REFERENCES niches(id) ON DELETE SET NULL,

  -- Identificação do produto
  name                VARCHAR(255) NOT NULL,
  platform            VARCHAR(100) NOT NULL,

  -- URLs
  product_url         TEXT        NOT NULL,
  affiliate_link      TEXT        NOT NULL,
  vsl_url             TEXT,

  -- Dados financeiros
  commission_percent  NUMERIC(5,2)  NOT NULL,
  ticket_price        NUMERIC(10,2) NOT NULL,

  -- Segmentação
  target_country      VARCHAR(10)   NOT NULL DEFAULT 'BR',
  target_language     VARCHAR(20)   NOT NULL DEFAULT 'pt-BR',

  -- Conteúdo extraído pelo Agente 1
  vsl_transcript      TEXT,

  -- Soft delete
  deleted_at          TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_products_user_id
  ON products(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_niche_id
  ON products(niche_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_platform
  ON products(user_id, platform)
  WHERE deleted_at IS NULL;

-- Trigger
CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_products" ON products
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE products IS
'Produtos afiliados cadastrados na plataforma. Um produto pode fazer parte de múltiplos '
'projetos. Os ativos e aprendizados gerados ficam vinculados ao produto, não ao projeto, '
'permitindo reutilização de criativos e personagens entre campanhas diferentes do mesmo produto.';

COMMENT ON COLUMN products.user_id IS
'Dono do produto. RLS garante que cada usuário acessa apenas seus próprios produtos. '
'Cascade delete: remover o usuário remove todos os seus produtos.';

COMMENT ON COLUMN products.niche_id IS
'Nicho de mercado ao qual o produto pertence. Usado para consultar a niche_memory '
'durante a execução dos agentes. SET NULL se o nicho for deletado — o produto permanece.';

COMMENT ON COLUMN products.name IS
'Nome comercial do produto conforme cadastrado pelo usuário. '
'Exemplos: Suplemento Detox Pro, Método Emagrecer de Vez, Fórmula Capilar X.';

COMMENT ON COLUMN products.platform IS
'Plataforma de afiliado onde o produto está cadastrado. Valores esperados: '
'hotmart, clickbank, monetizze, eduzz. Determina qual API usar para '
'buscar dados financeiros complementares (EPC, temperatura, conversão).';

COMMENT ON COLUMN products.product_url IS
'URL da página de vendas do produtor. Lida pelo Agente 1 via tool read_page(). '
'Deve apontar para a landing page principal, não para o checkout.';

COMMENT ON COLUMN products.affiliate_link IS
'Link de afiliado com o ID do usuário embutido. Usado pelo Agente 14 (UTM) '
'como base para construir o final_affiliate_url com parâmetros UTM. '
'Nunca exposto ao frontend em texto puro — apenas utilizado server-side.';

COMMENT ON COLUMN products.vsl_url IS
'URL da VSL (Video Sales Letter) do produtor. Pode ser YouTube, Vturb, Panda ou player próprio. '
'Nulo se o produto não tiver VSL ou se o usuário optar por upload manual do arquivo. '
'Processado pelo Agente 1 via tool transcribe_vsl().';

COMMENT ON COLUMN products.commission_percent IS
'Percentual de comissão do afiliado sobre o ticket_price. '
'Exemplos: 40.00 = 40%, 50.00 = 50%. Usado pelo Agente 2 para calcular '
'a margem estimada e pelo Agente 6 para definir ROAS mínimo viável.';

COMMENT ON COLUMN products.ticket_price IS
'Preço de venda ao consumidor final na moeda local (BRL por padrão). '
'Usado em conjunto com commission_percent para calcular a margem bruta por venda.';

COMMENT ON COLUMN products.target_country IS
'Código ISO 3166-1 alpha-2 do país alvo da campanha. Exemplos: BR, US, PT. '
'Determina o geo usado nas buscas do Google Trends, Ad Library e YouTube.';

COMMENT ON COLUMN products.target_language IS
'Código BCP 47 do idioma dos criativos e copies gerados. Exemplos: pt-BR, en-US, es-MX. '
'Todos os agentes de conteúdo (Roteirista, Copywriter) geram output neste idioma.';

COMMENT ON COLUMN products.vsl_transcript IS
'Transcrição completa da VSL do produtor em texto puro. '
'Extraída automaticamente pelo Agente 1 via Whisper ou similar, ou via upload manual '
'quando o player usa DRM ou não permite extração de áudio. '
'Nulo enquanto não processado. Pode ter vários milhares de caracteres.';

COMMENT ON COLUMN products.deleted_at IS
'Timestamp de soft delete. Nulo = produto ativo. '
'Registros com deleted_at preenchido são ignorados em todas as queries do sistema. '
'Hard delete disponível apenas via ação explícita do usuário nas configurações.';

COMMENT ON COLUMN products.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN products.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_products_updated_at.';

COMMIT;
