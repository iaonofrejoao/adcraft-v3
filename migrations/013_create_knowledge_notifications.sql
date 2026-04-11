-- Migration: 013_create_knowledge_notifications
-- Created: 2026-04-05
-- Description: Cria as tabelas notifications e knowledge_approval_queue —
--              notificações do sistema e fila de aprovação de conhecimento
-- Depends on: 001_create_enums, 002_create_functions, 003_create_users,
--             005_create_niches, 010_create_executions

BEGIN;

-- ============================================================
-- TABLE: notifications
-- Purpose: Notificações de conclusão e falha de execuções para o usuário
-- Written by: Orquestrador via notifier.notify_completion() e
--             notifier.notify_failure() ao término de cada execução
-- Read by: Sino de notificações (frontend) via Supabase Realtime;
--          hook useNotifications
-- ============================================================

CREATE TABLE notifications (
  -- Primary key
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id       UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  execution_id  UUID              REFERENCES executions(id) ON DELETE SET NULL,

  -- Conteúdo
  type          notification_type NOT NULL,
  title         VARCHAR(255)      NOT NULL,
  message       TEXT              NOT NULL,

  -- Estado de leitura
  read          BOOLEAN           NOT NULL DEFAULT FALSE,

  -- Timestamp de criação (sem updated_at — notificações são imutáveis)
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read = FALSE;

CREATE INDEX idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL
  USING (user_id = auth.uid());

-- Comentários de tabela e colunas
COMMENT ON TABLE notifications IS
'Notificações de conclusão e falha de execuções. Apenas dois tipos existem: '
'failure (erro permanente em algum nó — requer ação do usuário) e '
'completion (fluxo concluído com sucesso — informativa). '
'Publicadas via Supabase Realtime no momento da inserção — o hook useNotifications '
'no frontend escuta INSERT nesta tabela e exibe no sino de notificações em tempo real. '
'Imutáveis após inserção — sem updated_at.';

COMMENT ON COLUMN notifications.user_id IS
'Destinatário da notificação. RLS garante que cada usuário vê apenas as suas. '
'Cascade delete: remover o usuário remove todas as suas notificações.';

COMMENT ON COLUMN notifications.execution_id IS
'Execução relacionada à notificação. Clicável no dropdown — navega para '
'a tela de Fluxo da execução correspondente. '
'SET NULL se a execução for deletada — a notificação permanece como histórico.';

COMMENT ON COLUMN notifications.type IS
'Tipo da notificação: '
'failure = falha permanente em um nó, execução interrompida, requer ação manual; '
'completion = fluxo concluído com sucesso, todos os nós aprovados.';

COMMENT ON COLUMN notifications.title IS
'Título curto exibido no dropdown do sino. Exemplos: '
'"Execução concluída", "Falha no nó: Agente de Persona".';

COMMENT ON COLUMN notifications.message IS
'Mensagem detalhada com contexto da notificação. Exemplos: '
'"Fluxo finalizado com sucesso. Custo total: $0.4821. 14 nós concluídos."; '
'"Erro permanente após 3 tentativas: quota da YouTube Data API esgotada. '
'Retome a execução amanhã ou ajuste o budget de ferramentas."';

COMMENT ON COLUMN notifications.read IS
'Indica se o usuário visualizou a notificação. '
'FALSE = não lida, exibida no badge de contagem do sino. '
'TRUE = lida, removida do dropdown (mas mantida no banco para histórico). '
'Atualizado via PATCH ao clicar em "marcar como lida" ou ao abrir o dropdown.';

COMMENT ON COLUMN notifications.created_at IS
'Data e hora de criação da notificação, com fuso horário. Imutável após inserção. '
'Exibido no dropdown como tempo relativo: "há 5 minutos", "há 2 horas".';


-- ============================================================
-- TABLE: knowledge_approval_queue
-- Purpose: Fila de conhecimento coletado pelos agentes aguardando revisão humana
-- Written by: Agente 5 (Benchmark) e ferramentas auxiliares de nicho
--             ao final de cada execução com novos dados coletados
-- Read by: Tela de Nichos → seção "Fila de aprovação";
--          POST /knowledge/{id}/approve e /knowledge/{id}/reject
-- ============================================================

CREATE TABLE knowledge_approval_queue (
  -- Primary key
  id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  niche_id             UUID             NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  execution_id         UUID             REFERENCES executions(id) ON DELETE SET NULL,
  reviewed_by          UUID             REFERENCES users(id) ON DELETE SET NULL,

  -- Conteúdo do conhecimento
  memory_type          VARCHAR(100)     NOT NULL,
  content              TEXT             NOT NULL,
  source_url           TEXT,

  -- Score automático do agente coletor
  auto_score           NUMERIC(5,2)     NOT NULL,
  auto_score_rationale TEXT,

  -- Estado de revisão
  status               knowledge_status NOT NULL DEFAULT 'pending_approval',
  reviewed_at          TIMESTAMPTZ,

  -- Timestamp de criação (sem updated_at — o status muda mas o conteúdo não)
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_knowledge_queue_niche_status
  ON knowledge_approval_queue(niche_id, status)
  WHERE status = 'pending_approval';

CREATE INDEX idx_knowledge_queue_niche_score
  ON knowledge_approval_queue(niche_id, auto_score DESC)
  WHERE status = 'pending_approval';

CREATE INDEX idx_knowledge_queue_execution
  ON knowledge_approval_queue(execution_id)
  WHERE execution_id IS NOT NULL;

-- RLS — leitura e escrita para todos autenticados (qualquer usuário pode aprovar conhecimento)
ALTER TABLE knowledge_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_knowledge_queue" ON knowledge_approval_queue
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Comentários de tabela e colunas
COMMENT ON TABLE knowledge_approval_queue IS
'Fila de informações coletadas pelos agentes aguardando aprovação humana antes de '
'entrar na base de conhecimento (niche_memory). Garante qualidade dos dados — '
'nada entra na niche_memory sem revisão explícita na tela de Nichos. '
'Itens rejeitados permanecem no banco com status rejected para fins de auditoria — '
'nunca deletados. Itens aprovados são copiados para niche_memory pelo backend '
'no momento da aprovação via POST /knowledge/{id}/approve.';

COMMENT ON COLUMN knowledge_approval_queue.niche_id IS
'Nicho ao qual este conhecimento pertence. '
'Cascade delete: remover o nicho remove toda a fila pendente associada.';

COMMENT ON COLUMN knowledge_approval_queue.execution_id IS
'Execução que coletou este dado. Permite rastrear de qual campanha e produto '
'o conhecimento foi originado. SET NULL se a execução for deletada.';

COMMENT ON COLUMN knowledge_approval_queue.reviewed_by IS
'Usuário que revisou (aprovou ou rejeitou) este item. '
'Nulo enquanto status = pending_approval. SET NULL se o usuário for deletado.';

COMMENT ON COLUMN knowledge_approval_queue.memory_type IS
'Categoria do conhecimento. Valores esperados: '
'hook_pattern = padrão de abertura que performa bem no nicho; '
'angle_type = tipo de ângulo validado; '
'audience_verbatim = expressão real do público (de comentários/reviews); '
'format_preference = formato de criativo que performa melhor; '
'objection = objeção recorrente do público; '
'cta_pattern = padrão de CTA eficaz; '
'audience_language = estilo de linguagem característico do nicho.';

COMMENT ON COLUMN knowledge_approval_queue.content IS
'Conteúdo textual do conhecimento a ser revisado. Exibido na tela de Nichos '
'para o usuário avaliar antes de aprovar ou rejeitar. '
'Exemplos: "gordura teimosa que não sai nem com dieta" (audience_verbatim); '
'"Você sabia que 90% das dietas falham por um motivo que ninguém fala?" (hook_pattern).';

COMMENT ON COLUMN knowledge_approval_queue.source_url IS
'URL da fonte onde o dado foi coletado. Exibida como link clicável na fila '
'para o usuário verificar a autenticidade antes de aprovar. '
'Obrigatório para hook_pattern e audience_verbatim. '
'Nulo para dados sintetizados pelo agente sem fonte direta.';

COMMENT ON COLUMN knowledge_approval_queue.auto_score IS
'Score de 0.00 a 100.00 atribuído automaticamente pelo agente coletor '
'com base em critérios objetivos: '
'- Tempo de exibição do anúncio (>30 dias = score alto); '
'- Engajamento do vídeo (likes, comments, views); '
'- Especificidade da informação (verbatim específico > genérico); '
'- Consistência com padrões já aprovados no nicho. '
'Exibido na fila para guiar a priorização da revisão humana.';

COMMENT ON COLUMN knowledge_approval_queue.auto_score_rationale IS
'Justificativa textual do score automático gerada pelo agente. Exemplos: '
'"Anúncio rodando há 47 dias com alta frequência — indica que está convertendo. '
'Hook muito específico e verbatim real do público."; '
'"Score baixo: fonte é comentário com apenas 2 likes — pode não ser representativo."';

COMMENT ON COLUMN knowledge_approval_queue.status IS
'Estado de revisão do item: '
'pending_approval = aguardando revisão na tela de Nichos (estado inicial); '
'approved = aprovado pelo usuário e copiado para niche_memory; '
'rejected = descartado pelo usuário — mantido para auditoria, '
'           nunca retornado em queries de conhecimento para os agentes.';

COMMENT ON COLUMN knowledge_approval_queue.reviewed_at IS
'Timestamp de quando o usuário aprovou ou rejeitou o item. '
'Nulo enquanto status = pending_approval.';

COMMENT ON COLUMN knowledge_approval_queue.created_at IS
'Data e hora de criação do registro, com fuso horário. Imutável após inserção.';

COMMIT;
