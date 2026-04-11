# app/api/
# Route handlers FastAPI organizados por recurso.
# Cada módulo registra um APIRouter que é incluído em app/main.py.
#
# Módulos:
#   projects.py   — CRUD de projetos (GET/POST/PATCH/DELETE /projects)
#   executions.py — Ciclo de vida de execuções (criar, aprovar nó, retomar, cancelar)
#   assets.py     — Biblioteca de ativos (listar, aprovar, deletar)
#   campaigns.py  — Campanhas e métricas (listar, pausar, ativar, refresh)
#   niches.py     — Nichos e fila de aprovação de conhecimento
#   tools.py      — Ferramentas auxiliares (prospecção, benchmark, tendências)
#   assistant.py  — Assistente consultivo (query em linguagem natural)
#   health.py     — Healthcheck (Redis, Supabase, FFmpeg)
#   webhooks.py   — Webhooks de plataformas externas (Facebook, Google)
