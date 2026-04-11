-- Migration: 001_create_enums
-- Created: 2026-04-05
-- Description: Cria todos os tipos enumerados do projeto AdCraft
-- Depends on: (nenhum)

BEGIN;

-- ============================================================
-- STATUS DE EXECUÇÃO DO FLUXO DE AGENTES
-- ============================================================
CREATE TYPE execution_status AS ENUM (
  'pending',              -- Execução criada, ainda não iniciada
  'running',              -- Execução em andamento
  'paused_for_approval',  -- Aguardando aprovação humana em algum nó
  'completed',            -- Fluxo concluído com sucesso
  'failed',               -- Falha permanente em algum nó
  'cancelled'             -- Cancelada manualmente pelo usuário
);

COMMENT ON TYPE execution_status IS
'Status do ciclo de vida de uma execução do fluxo de agentes. '
'Transições válidas: pending → running → paused_for_approval ⇄ running → completed | failed | cancelled.';


-- ============================================================
-- TIPO DE ATIVO GERADO PELOS AGENTES
-- ============================================================
CREATE TYPE asset_type AS ENUM (
  'character',        -- Imagem de referência do personagem visual
  'keyframe',         -- Imagem do primeiro frame de uma cena
  'video_clip',       -- Clipe de vídeo gerado para uma cena
  'final_video',      -- Vídeo final montado pelo Diretor de Criativo
  'script',           -- Roteiro escrito pelo Roteirista
  'copy',             -- Textos de anúncio (headline, body, CTA)
  'hook',             -- Variação de hook testável
  'audio_narration'   -- Áudio de narração gerado por TTS
);

COMMENT ON TYPE asset_type IS
'Tipo de arquivo ou conteúdo gerado durante uma execução. '
'Determina como o ativo é exibido na Biblioteca e quais metadados são relevantes.';


-- ============================================================
-- STATUS DE APROVAÇÃO DE ATIVOS E NÓS
-- ============================================================
CREATE TYPE approval_status AS ENUM (
  'pending',                -- Aguardando revisão humana
  'approved',               -- Aprovado sem ressalvas
  'rejected',               -- Reprovado — agente deve reexecutar com feedback
  'approved_with_feedback'  -- Aprovado com comentários opcionais registrados
);

COMMENT ON TYPE approval_status IS
'Status do ciclo de revisão humana de um ativo ou output de nó. '
'rejected dispara reexecução do agente com o feedback como contexto adicional.';


-- ============================================================
-- TIPO DE NOTIFICAÇÃO DO SISTEMA
-- ============================================================
CREATE TYPE notification_type AS ENUM (
  'failure',    -- Falha permanente em um nó — execução interrompida
  'completion'  -- Fluxo concluído com sucesso
);

COMMENT ON TYPE notification_type IS
'Apenas dois tipos de notificação push existem no sistema: falha (requer ação) '
'e conclusão (informativa). Notificações são publicadas via Supabase Realtime.';


-- ============================================================
-- STATUS DE CONHECIMENTO NA FILA DE APROVAÇÃO
-- ============================================================
CREATE TYPE knowledge_status AS ENUM (
  'pending_approval', -- Coletado pelo agente, aguardando revisão humana
  'approved',         -- Aprovado pelo usuário, disponível para os agentes
  'rejected'          -- Rejeitado pelo usuário, mantido para auditoria
);

COMMENT ON TYPE knowledge_status IS
'Status de um item na knowledge_approval_queue ou na niche_memory. '
'Apenas itens com status approved são consultados pelos agentes durante execuções.';


-- ============================================================
-- COMPORTAMENTO DO ORQUESTRADOR EM CASO DE FALHA DE VIABILIDADE
-- ============================================================
CREATE TYPE orchestrator_behavior AS ENUM (
  'stop',          -- Para o fluxo e notifica o usuário para decisão manual
  'continue',      -- Continua a execução com flag viability_warning em todos os nós
  'agent_decides'  -- Orquestrador analisa o laudo e decide baseado em critérios objetivos
);

COMMENT ON TYPE orchestrator_behavior IS
'Define a reação do Orquestrador (Agente 0) quando o Agente de Viabilidade emite '
'veredicto not_viable. Configurável por projeto em projects.orchestrator_behavior_on_failure. '
'agent_decides: margem positiva = continua; restrição legal = para.';

COMMIT;
