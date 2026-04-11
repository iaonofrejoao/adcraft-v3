-- Migration: 008_create_templates
-- Created: 2026-04-05
-- Description: Cria a tabela templates — definições de fluxo reutilizáveis
--              que determinam a sequência e configuração dos agentes
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users

BEGIN;

-- ============================================================
-- TABLE: templates
-- Purpose: Templates de fluxo de trabalho com a estrutura de nós e edges
-- Written by: Tela de Templates (editor React Flow dedicado)
-- Read by: Modal "Novo projeto" ao criar uma execução;
--          Orquestrador ao iniciar uma execução (salvo como snapshot)
-- ============================================================

CREATE TABLE templates (
  -- Primary key
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identificação
  name         VARCHAR(255) NOT NULL,
  description  TEXT,

  -- Definição do fluxo
  flow_schema  JSONB        NOT NULL,

  -- Estado
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_templates_user_id
  ON templates(user_id)
  WHERE is_active = TRUE;

-- Trigger
CREATE TRIGGER set_templates_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_templates" ON templates
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE templates IS
'Templates de fluxo de trabalho. Define a estrutura de nós e conexões do React Flow '
'que será usada como base para novos projetos. Modificações no template não afetam '
'projetos já criados — cada execução salva um snapshot imutável do template no momento '
'da sua criação (executions.template_snapshot).';

COMMENT ON COLUMN templates.user_id IS
'Dono do template. RLS garante que cada usuário acessa apenas seus próprios templates. '
'Cascade delete: remover o usuário remove todos os seus templates.';

COMMENT ON COLUMN templates.name IS
'Nome de exibição do template na interface. Exemplos: '
'"Marketing Direto Afiliado v1", "VSL Longa com Personagem", "Google Ads Search".';

COMMENT ON COLUMN templates.description IS
'Descrição opcional do template explicando seu propósito, '
'para qual tipo de produto é mais adequado e quantos agentes contém.';

COMMENT ON COLUMN templates.flow_schema IS
'JSON com a definição completa do fluxo React Flow. Estrutura esperada:
{
  "nodes": [
    {
      "id": "string — identificador único do nó no canvas",
      "type": "agent — tipo de nó registrado no React Flow",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "string — nome exibido no nó",
        "agent_name": "string — identificador do agente no backend",
        "default_model": "string — modelo Claude padrão para este nó",
        "approval_required_default": "boolean — aprovação ligada por padrão",
        "active_default": "boolean — nó ativo por padrão"
      }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string — id do nó de origem",
      "target": "string — id do nó de destino",
      "type": "animated"
    }
  ],
  "default_node_config": {
    "{node_id}": {
      "model": "string",
      "approval_required": "boolean",
      "quantity": "integer",
      "active": "boolean"
    }
  }
}';

COMMENT ON COLUMN templates.is_active IS
'Indica se o template está disponível para seleção no modal de Novo Projeto. '
'FALSE = template arquivado, não aparece na listagem mas não é deletado. '
'O índice parcial idx_templates_user_id filtra apenas templates ativos.';

COMMENT ON COLUMN templates.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMENT ON COLUMN templates.updated_at IS
'Data e hora da última modificação do registro, com fuso horário. '
'Atualizado automaticamente pelo trigger set_templates_updated_at. '
'Alterações no template não propagam para execuções existentes — '
'cada execução usa seu próprio template_snapshot.';

COMMIT;
