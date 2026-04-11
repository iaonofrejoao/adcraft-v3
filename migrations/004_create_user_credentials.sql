-- Migration: 004_create_user_credentials
-- Created: 2026-04-05
-- Description: Cria a tabela user_credentials para armazenar credenciais
--              de APIs externas criptografadas com AES-256
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users

BEGIN;

-- ============================================================
-- TABLE: user_credentials
-- Purpose: Armazena credenciais de APIs externas criptografadas
-- Written by: Tela de Configurações (tab Integrações e tab Modelos e APIs)
-- Read by: CredentialManager (server-side apenas) — nunca exposto ao frontend
-- ============================================================

CREATE TABLE user_credentials (
  -- Primary key
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identificação da credencial
  key_name         VARCHAR(255) NOT NULL,
  service          VARCHAR(100) NOT NULL,

  -- Valor criptografado
  encrypted_value  TEXT NOT NULL,

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garantia de unicidade por usuário e chave
  UNIQUE (user_id, key_name)
);

-- Índices
CREATE INDEX idx_user_credentials_user_id
  ON user_credentials(user_id);

CREATE INDEX idx_user_credentials_service
  ON user_credentials(user_id, service);

-- Trigger
CREATE TRIGGER set_user_credentials_updated_at
BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_user_credentials" ON user_credentials
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE user_credentials IS
'Credenciais de APIs externas criptografadas com AES-256-CBC via Fernet. '
'Nunca armazenadas em texto puro, nunca expostas ao frontend, nunca aparecem em logs. '
'O CredentialManager no backend é o único ponto de acesso para decrypt.';

COMMENT ON COLUMN user_credentials.user_id IS
'Dono da credencial. Chave estrangeira para users(id). '
'RLS garante que cada usuário acessa apenas suas próprias credenciais.';

COMMENT ON COLUMN user_credentials.key_name IS
'Identificador semântico da credencial dentro do serviço. Exemplos: '
'facebook_access_token, facebook_refresh_token, google_refresh_token, '
'anthropic_api_key, youtube_api_key, hotmart_client_id, hotmart_client_secret, '
'clickbank_api_key, runway_api_key, elevenlabs_api_key. '
'Único por usuário — UNIQUE(user_id, key_name).';

COMMENT ON COLUMN user_credentials.service IS
'Agrupador do serviço ao qual a credencial pertence. Exemplos: '
'facebook, google, anthropic, hotmart, clickbank, runway, kling, elevenlabs. '
'Usado para listar todas as credenciais de um serviço de uma só vez.';

COMMENT ON COLUMN user_credentials.encrypted_value IS
'Valor da credencial criptografado com Fernet (AES-256-CBC). '
'A chave de criptografia é lida exclusivamente da variável de ambiente '
'CREDENTIAL_ENCRYPTION_KEY — nunca armazenada no banco. '
'Para gerar a chave: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"';

COMMENT ON COLUMN user_credentials.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN user_credentials.updated_at IS
'Data e hora da última rotação ou atualização da credencial, com fuso horário. '
'Atualizado automaticamente pelo trigger set_user_credentials_updated_at.';

COMMIT;
