# tests/integration/
# Testes de integração — fluxo ponta a ponta sem mocks de banco.
# Requerem variáveis de ambiente com Supabase test project configurado.
# Marcados com @pytest.mark.integration para exclusão em CI rápido.
#
#   test_execution_flow.py    — Cria execução, roda agentes sequenciais,
#                               valida shared_state após cada nó.
#   test_state_persistence.py — Simula crash de worker e verifica retomada
#                               a partir do último nó salvo.
