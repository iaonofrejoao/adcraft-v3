"""
Notifier — publica notificações de execução via tabela `notifications`.

O Supabase Realtime propaga automaticamente os INSERTs para o frontend,
que escuta via hook `useNotifications` e exibe no sino de notificações (PRD seção 10.11).

Dois tipos de notificação (PRD seção 7 — tabela notifications):
  - "completion": fluxo concluído com sucesso
  - "failure":    erro em algum nó da execução

As funções são assíncronas mas a escrita no Supabase é síncrona (cliente supabase-py).
O try/except garante que falhas de notificação nunca derrubam o fluxo principal.
"""

import logging

logger = logging.getLogger(__name__)


async def notify_completion(
    execution_id: str,
    user_id: str,
    total_cost_usd: float,
) -> None:
    """
    Publica notificação de conclusão bem-sucedida de uma execução.

    Publicada via Supabase Realtime para o hook useNotifications no frontend.
    Aparece no sino com badge de não lida e link direto para a execução.

    Args:
        execution_id:   UUID da execução concluída.
        user_id:        UUID do usuário dono da execução.
        total_cost_usd: Custo total acumulado da execução em USD.
    """
    if not user_id:
        return

    try:
        from app.database import get_supabase
        supabase = get_supabase()
        supabase.table("notifications").insert({
            "user_id":      user_id,
            "execution_id": execution_id,
            "type":         "completion",
            "title":        "Execução concluída",
            "message":      (
                f"Fluxo finalizado com sucesso. "
                f"Custo total: ${total_cost_usd:.4f}"
            ),
            "read": False,
        }).execute()

        logger.debug(
            "Notificação de conclusão criada para execução %s (usuário %s).",
            execution_id, user_id,
        )
    except Exception as exc:
        # Falha de notificação nunca deve derrubar o fluxo principal
        logger.warning(
            "Falha ao criar notificação de conclusão para execução %s: %s",
            execution_id, str(exc),
        )


async def notify_failure(
    execution_id: str,
    user_id: str,
    node_name: str,
    error: str,
) -> None:
    """
    Publica notificação de falha de um nó da execução.

    Publicada via Supabase Realtime para o hook useNotifications no frontend.
    Aparece no sino com badge de não lida e link direto para a execução.

    Args:
        execution_id: UUID da execução que falhou.
        user_id:      UUID do usuário dono da execução.
        node_name:    Nome legível do nó ou agente que falhou (ex: "PersonaBuilderAgent").
        error:        Mensagem de erro — truncada em 500 chars para caber na coluna TEXT.
    """
    if not user_id:
        return

    try:
        from app.database import get_supabase
        supabase = get_supabase()
        supabase.table("notifications").insert({
            "user_id":      user_id,
            "execution_id": execution_id,
            "type":         "failure",
            "title":        f"Falha no nó: {node_name}",
            "message":      error[:500],
            "read":         False,
        }).execute()

        logger.debug(
            "Notificação de falha criada para execução %s, nó %s (usuário %s).",
            execution_id, node_name, user_id,
        )
    except Exception as exc:
        logger.warning(
            "Falha ao criar notificação de erro para execução %s, nó %s: %s",
            execution_id, node_name, str(exc),
        )
