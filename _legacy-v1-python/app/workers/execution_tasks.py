"""
Celery tasks — tarefas de execução do fluxo de agentes.

A task run_execution() é o ponto de entrada assíncrono para todas as execuções.
É completamente desacoplada do ciclo de vida da requisição HTTP — o endpoint
POST /executions retorna imediatamente após enfileirar a task via .delay().

Garantias de confiabilidade (PRD seção 13.3):
  - acks_late=True:             Não confirma até concluir
  - reject_on_worker_lost=True: Re-enfileira se o worker morrer
  - max_retries=0:              Retentativas são gerenciadas internamente pelo ExecutionEngine

O estado é persistido após cada nó via StateManager — seguro para retomada após crash.
"""

import asyncio
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.execution_tasks.run_execution",
    max_retries=0,               # Retentativas internas no ExecutionEngine
    acks_late=True,              # Não remove da fila até concluir
    reject_on_worker_lost=True,  # Re-enfileira se o worker morrer
)
def run_execution(self, execution_id: str) -> dict:
    """
    Task principal de execução do fluxo de agentes.

    Criada via run_execution.delay(execution_id) pelo endpoint POST /executions.
    Retorna imediatamente ao enfileirar — a execução ocorre de forma assíncrona.

    O ExecutionEngine cuida de:
      - Carregar o state do banco
      - Sequenciar os agentes conforme o template
      - Persistir o state após cada nó aprovado
      - Notificar o usuário ao concluir ou falhar

    Args:
        execution_id: UUID da execução (tabela executions.id).

    Returns:
        Dict com status final e metadados da execução.
    """
    logger.info("Iniciando execução %s no worker Celery.", execution_id)

    try:
        result = asyncio.run(_run_execution_async(execution_id))
        logger.info("Execução %s concluída com sucesso.", execution_id)
        return result
    except Exception as exc:
        logger.error("Execução %s falhou: %s", execution_id, str(exc), exc_info=True)
        # Não re-raise — o ExecutionEngine já notificou o usuário e persistiu o erro.
        # Re-raise apenas se for um erro inesperado fora do fluxo do agente.
        raise


async def _run_execution_async(execution_id: str) -> dict:
    """
    Ponto de entrada async para o ExecutionEngine.
    Separado da task síncrona para facilitar testes e evitar aninhamento de event loops.
    """
    # Import local para evitar circular imports e só carregar quando necessário
    from app.orchestration.executor import ExecutionEngine

    engine = ExecutionEngine()
    return await engine.run(execution_id)


@celery_app.task(
    bind=True,
    name="app.workers.execution_tasks.resume_execution",
    max_retries=0,
    acks_late=True,
    reject_on_worker_lost=True,
)
def resume_execution(self, execution_id: str) -> dict:
    """
    Retoma uma execução a partir do nó que falhou.
    Chamada via POST /executions/{id}/resume.

    O ExecutionEngine detecta automaticamente o último nó aprovado
    e reinicia a partir do próximo.

    Args:
        execution_id: UUID da execução a ser retomada.
    """
    logger.info("Retomando execução %s.", execution_id)

    try:
        return asyncio.run(_resume_execution_async(execution_id))
    except Exception as exc:
        logger.error("Falha ao retomar execução %s: %s", execution_id, str(exc), exc_info=True)
        raise


async def _resume_execution_async(execution_id: str) -> dict:
    from app.orchestration.executor import ExecutionEngine

    engine = ExecutionEngine()
    return await engine.resume(execution_id)


@celery_app.task(
    bind=True,
    name="app.workers.execution_tasks.run_daily_performance",
    max_retries=0,
    acks_late=True,
    reject_on_worker_lost=True,
    queue="performance",  # Fila dedicada — não concorre com execuções de agentes
)
def run_daily_performance(self) -> dict:
    """
    Task agendada: executa o Agente 17 (Performance) para todas as campanhas ativas.

    Disparada automaticamente às 5h pelo Celery Beat (beat_schedule em celery_app.py).
    Pode ser disparada manualmente via POST /campaigns/{id}/refresh-metrics.

    Fluxo:
      1. Busca todos os projetos com campanhas ativas no banco
      2. Para cada projeto, instancia o PerformanceAnalystAgent
      3. O agente lê métricas das plataformas e persiste em performance_snapshots
      4. Se há ação recomendada, instancia o ScalerAgent para propor escala
         (as ações de escala nunca são executadas automaticamente — aguardam aprovação)

    Returns:
        Dict com projetos analisados, snapshots criados e erros encontrados.
    """
    logger.info("Iniciando análise diária de performance.")

    try:
        result = asyncio.run(_run_daily_performance_async())
        logger.info(
            "Análise diária concluída: %d projetos analisados.",
            result.get("projects_analyzed", 0),
        )
        return result
    except Exception as exc:
        logger.error("Falha na análise diária de performance: %s", str(exc), exc_info=True)
        raise


async def _run_daily_performance_async() -> dict:
    """
    Busca projetos com campanhas ativas e executa o agente de performance para cada um.
    """
    from app.database import get_supabase
    from app.orchestration.cost_tracker import CostTracker
    from app.orchestration.rate_limiter import RateLimiter

    supabase = get_supabase()

    # Busca projetos que têm campanhas ativas
    campaigns_result = (
        supabase.table("campaigns")
        .select("project_id")
        .eq("status", "active")
        .execute()
    )

    project_ids = list({
        row["project_id"]
        for row in (campaigns_result.data or [])
        if row.get("project_id")
    })

    if not project_ids:
        logger.info("Nenhuma campanha ativa encontrada. Nada a analisar.")
        return {"projects_analyzed": 0, "snapshots_created": 0, "errors": []}

    errors: list[dict] = []
    snapshots_created = 0

    for project_id in project_ids:
        try:
            snaps = await _analyze_project_performance(project_id)
            snapshots_created += snaps
        except Exception as exc:
            logger.error(
                "Falha ao analisar projeto %s: %s", project_id, str(exc), exc_info=True
            )
            errors.append({"project_id": project_id, "error": str(exc)})

    return {
        "projects_analyzed": len(project_ids),
        "snapshots_created": snapshots_created,
        "errors": errors,
    }


async def _analyze_project_performance(project_id: str) -> int:
    """
    Executa o Agente 17 para um projeto específico.
    Retorna o número de snapshots de performance criados.
    """
    import importlib
    from app.orchestration.cost_tracker import CostTracker
    from app.orchestration.rate_limiter import RateLimiter
    from app.database import get_supabase

    supabase = get_supabase()

    # Carrega a execução mais recente do projeto para obter o shared_state
    row = (
        supabase.table("executions")
        .select("id, shared_state, user_id")
        .eq("project_id", project_id)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(1)
        .single()
        .execute()
    )

    if not row.data:
        logger.warning("Projeto %s sem execução concluída — pulando análise.", project_id)
        return 0

    execution_id: str = row.data["id"]
    state: dict       = row.data.get("shared_state", {})

    cost_tracker = CostTracker(execution_id)
    rate_limiter = RateLimiter()

    # Instancia e executa o PerformanceAnalystAgent
    module = importlib.import_module("app.agents.performance_analyst")
    agent_class = getattr(module, "PerformanceAnalystAgent")
    agent = agent_class(model="claude-sonnet-4-6")

    updated_state, _metadata = await agent.run(
        state=state,
        cost_tracker=cost_tracker,
        rate_limiter=rate_limiter,
        node_id="node-17",
        execution_id=execution_id,
    )

    # Persiste custo da análise
    supabase.table("executions").update({
        "total_cost_usd": (
            supabase.table("executions")
            .select("total_cost_usd")
            .eq("id", execution_id)
            .single()
            .execute()
            .data.get("total_cost_usd", 0)
        ) + cost_tracker.total_cost_usd
    }).eq("id", execution_id).execute()

    # Conta snapshots criados hoje
    from datetime import date
    today = date.today().isoformat()
    snaps = (
        supabase.table("performance_snapshots")
        .select("id", count="exact")
        .eq("project_id", project_id)
        .eq("snapshot_date", today)
        .execute()
    )
    return snaps.count or 0
