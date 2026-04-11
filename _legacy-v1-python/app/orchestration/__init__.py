# app/orchestration/
# Motor de execução do fluxo de agentes e utilitários de infraestrutura.
#
# Módulos:
#   executor.py        — ExecutionEngine: loop principal que percorre os nós do template,
#                        dispara agentes sequenciais e paralelos, persiste estado após cada nó
#   context_builder.py — ContextBuilder: extrai apenas os campos necessários do shared_state
#                        para cada agente — nunca passa o estado completo
#   state_manager.py   — StateManager: leitura e escrita do shared_state no Supabase,
#                        atualização de node_statuses com publicação via Realtime
#   rate_limiter.py    — RateLimiter: controle de quota por API com janelas deslizantes;
#                        emite eventos WebSocket para o tooltip do canvas quando em fila
#   cost_tracker.py    — CostTracker: registra tokens e custo USD por agente/nó;
#                        atualiza executions.total_cost_usd em tempo real
#   asset_saver.py     — save_asset_atomically(): garante que R2 e Supabase são
#                        escritos juntos ou nenhum dos dois
#   notifier.py        — notify_completion() e notify_failure(): insere em notifications
#                        para publicação via Supabase Realtime
