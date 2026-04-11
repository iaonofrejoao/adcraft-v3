"""
Celery Beat — tarefas agendadas da plataforma AdCraft.

Tarefas:
  - run_daily_performance: análise diária de performance de todas as campanhas ativas.
    Roda às 5h (horário de Brasília) conforme PRD seção 9 e seção 4 (Agente 17).
    Dispara o Agente 17 (Analista de Performance) para cada campanha ativa.
"""

import asyncio
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.workers.scheduled_tasks.run_daily_performance",
    max_retries=0,
    acks_late=True,
)
def run_daily_performance() -> dict:
    """
    Analisa performance de todas as campanhas ativas — roda às 5h diariamente.

    Para cada projeto com campanhas ativas:
      1. Busca métricas do dia anterior via APIs do Facebook/Google
      2. Dispara o Agente 17 (Analista de Performance)
      3. Persiste o snapshot de performance
      4. Se houver ação recomendada, dispara notificação para o usuário

    Returns:
        Dict com contagem de campanhas analisadas e eventuais erros.
    """
    logger.info("Iniciando análise diária de performance (Celery Beat).")

    try:
        result = asyncio.run(_run_daily_performance_async())
        logger.info("Análise diária de performance concluída: %s", result)
        return result
    except Exception as exc:
        logger.error("Falha na análise diária de performance: %s", str(exc), exc_info=True)
        raise


async def _run_daily_performance_async() -> dict:
    """
    Lógica async da análise diária.
    Busca todas as campanhas ativas e dispara o Agente 17 para cada uma.
    """
    # TODO: implementar quando o Agente 17 (PerformanceAnalystAgent) estiver pronto
    # Sequência:
    #   1. supabase.table("campaigns").select("*").eq("status", "active")
    #   2. Para cada campanha, carrega o shared_state da execução de origem
    #   3. Instancia PerformanceAnalystAgent e chama agent.run(state, ...)
    #   4. Persiste snapshot em performance_snapshots
    #   5. Cria notificação se recommended_action for "scale" ou "pause"

    return {
        "status": "not_implemented",
        "message": "Agente 17 (PerformanceAnalystAgent) ainda não implementado.",
    }
