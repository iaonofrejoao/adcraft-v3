# tests/unit/orchestration/
# Testes unitários dos componentes de orquestração.
# Cobre: ContextBuilder (campos mínimos por agente),
# CostTracker (acumulação correta de tokens e USD),
# RateLimiter (quotas por API sem competição entre APIs distintas),
# StateManager (leitura e escrita isolada do shared_state).
