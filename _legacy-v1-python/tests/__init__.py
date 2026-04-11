# tests/
# Suite de testes do backend AdCraft.
# Organizada em três camadas conforme a skill pytest-agents:
#
#   unit/        — Testes unitários com mocks de Claude API e Supabase.
#                  Rápidos, sem dependências externas, rodam em CI.
#   integration/ — Testes de integração do fluxo ponta a ponta.
#                  Usam banco real (Supabase test project) via variáveis de ambiente.
#   fixtures/    — Dados de teste: estados de execução prontos, transcrições de VSL
#                  de exemplo, respostas mockadas de APIs externas.
#
# Executar:
#   pytest tests/unit/ -v                    # unitários
#   pytest tests/ -v --cov=app               # com cobertura
#   pytest tests/ -n auto                    # paralelo
