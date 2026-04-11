# app/memory/
# Camadas de memória acumulativa da plataforma.
# Implementa as três camadas descritas no PRD seção 11:
#
# Módulos:
#   niche_memory.py        — Camada 2: leitura e escrita da tabela niche_memory.
#                            query_niche_memory(niche_slug) retorna itens approved
#                            ordenados por confidence_score DESC.
#                            update_confidence_score() ajusta score após cada análise
#                            de performance (+5 ROAS acima da meta / -10 abaixo).
#   pattern_intelligence.py — Camada 3: leitura e escrita da tabela pattern_intelligence.
#                             query_pattern_intelligence(pattern_type, pattern_value)
#                             retorna padrões com sample_size >= 5.
#                             upsert_pattern() atualiza avg_roas e sample_size.
#   approval_queue.py      — Gerencia a knowledge_approval_queue: adiciona itens coletados
#                            pelos agentes, atualiza status após aprovação/rejeição,
#                            copia para niche_memory ao aprovar.
