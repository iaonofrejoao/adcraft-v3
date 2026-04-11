"""
Celery — configuração da aplicação de tarefas assíncronas.

Configurações críticas (PRD seção 13.3):
  - acks_late=True:              Job não é removido da fila até concluir com sucesso.
  - reject_on_worker_lost=True:  Se o worker morrer, o job é re-enfileirado.
  - worker_prefetch_multiplier=1: Um job por worker (jobs longos de agentes de IA).
  - appendonly (Redis):           Persistência — jobs não são perdidos em restart.

Filas:
  - executions: jobs de execução de fluxo de agentes (alta prioridade)
  - performance: jobs de análise de performance (roda às 5h via beat)
  - default:     jobs de propósito geral

Tarefas agendadas (Celery Beat):
  - Análise de performance: todo dia às 5h (horário de Brasília)
"""

import os

from celery import Celery
from celery.schedules import crontab


# ---------------------------------------------------------------------------
# Inicialização da aplicação Celery
# ---------------------------------------------------------------------------

celery_app = Celery(
    "adcraft",
    broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    include=[
        "app.workers.execution_tasks",
        "app.workers.scheduled_tasks",
    ],
)

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

celery_app.conf.update(
    # Serialização
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone — Brasil
    timezone="America/Sao_Paulo",
    enable_utc=True,

    # Confiabilidade (PRD seção 13.3)
    task_acks_late=True,                 # Confirma apenas após conclusão com sucesso
    task_reject_on_worker_lost=True,     # Re-enfileira se o worker morrer
    worker_prefetch_multiplier=1,        # Um job por worker — jobs longos de IA

    # Rastreamento
    task_track_started=True,             # Estado "started" visível antes de "success"

    # Resultados — mantém por 24 horas
    result_expires=86400,

    # Filas
    task_default_queue="default",
    task_routes={
        "app.workers.execution_tasks.run_execution": {"queue": "executions"},
        "app.workers.scheduled_tasks.run_daily_performance": {"queue": "performance"},
    },

    # Tarefas agendadas (Celery Beat)
    beat_schedule={
        # Agente de performance roda todo dia às 5h no horário de Brasília
        # conforme PRD seção 4 (Agente 17) e seção 9 (fluxo agendado)
        "daily-performance-analysis": {
            "task": "app.workers.scheduled_tasks.run_daily_performance",
            "schedule": crontab(hour=5, minute=0),
            "options": {"queue": "performance"},
        },
    },
)
