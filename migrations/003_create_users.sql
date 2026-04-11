-- Migration: 003_create_users
-- Created: 2026-04-05
-- Description: Cria a tabela users — base de identidade da plataforma
-- Depends on: 001_create_enums, 002_create_functions

BEGIN;

-- ============================================================
-- TABLE: users
-- Purpose: Armazena os usuários da plataforma
-- Written by: Sistema de autenticação (Supabase Auth) / seed manual na v1.0
-- Read by: Todos os agentes e serviços que precisam de user_id para RLS
-- ============================================================

CREATE TABLE users (
  -- Primary key
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidade
  email       VARCHAR(255) UNIQUE,
  name        VARCHAR(255),

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comentários de tabela e colunas
COMMENT ON TABLE users IS
'Usuários da plataforma. Na v1.0 há apenas 1 usuário operado localmente — sem sistema '
'de autenticação exposto. Estrutura preparada para multi-tenant na v2.0 com Supabase Auth.';

COMMENT ON COLUMN users.id IS
'Identificador único do usuário. Usado como chave estrangeira em todas as tabelas '
'que possuem RLS (user_id = auth.uid()).';

COMMENT ON COLUMN users.email IS
'Endereço de e-mail do usuário. Único na tabela. Nulo permitido na v1.0 (uso local sem auth). '
'Obrigatório na v2.0 com sistema de login via Supabase Auth.';

COMMENT ON COLUMN users.name IS
'Nome de exibição do usuário na interface. Sem restrições de formato.';

COMMENT ON COLUMN users.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN users.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_users_updated_at.';

COMMIT;
