# app/workers/
# Tarefas Celery para execução assíncrona e agendada.
#
# Módulos:
#   celery_app.py        — Instância do Celery com configuração de broker (Redis),
#                          serialização JSON, acks_late=True, worker_prefetch_multiplier=1
#                          e beat_schedule com daily-performance-analysis às 5h.
#   execution_tasks.py   — run_execution(execution_id): task principal que chama
#                          ExecutionEngine.run() — decoupled do ciclo HTTP.
#                          reject_on_worker_lost=True garante re-enfileiramento
#                          automático se o worker morrer durante a execução.
#   scheduled_tasks.py   — run_daily_performance(): disparado pelo Celery Beat às 5h,
#                          busca todas as campanhas ativas e chama o Agente 17.
