import redis as redis_client
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import get_supabase

# ---------------------------------------------------------------------------
# Aplicação FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AdCraft API",
    description="""
## AdCraft — Plataforma de Marketing Direto com Agentes de IA

Automatiza todo o ciclo de vida de uma campanha de afiliado:

1. **Análise** — transcreve a VSL do produtor e avalia viabilidade de mercado
2. **Persona e Ângulo** — constrói o público-alvo com linguagem real e define o ângulo criativo
3. **Criação** — gera roteiros, copies, personagem visual, keyframes e vídeos por cena
4. **Montagem** — monta o criativo final via FFmpeg com narração, trilha e legendas
5. **Lançamento** — cria campanhas no Facebook Ads e Google Ads (sempre em `PAUSED`)
6. **Otimização** — analisa performance diária e escala criativos vencedores

### Regras críticas de segurança

- Toda campanha é criada em **status PAUSED** — ativação somente após aprovação humana explícita
- Credenciais de APIs externas armazenadas com **AES-256** via `CredentialManager`
- Nunca chegam ao frontend
- Todo ativo salvo no R2 tem metadado salvo atomicamente no Supabase (`save_asset_atomically`)

### Versão

`v1.0.0` — single-tenant, uso pessoal. Multi-tenant / SaaS previsto para v2.0.
""",
    version="1.0.0",
    contact={
        "name": "AdCraft",
        "url": "http://localhost:3000",
    },
    license_info={
        "name": "Privado — uso interno",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Projetos",    "description": "CRUD de projetos e seus metadados"},
        {"name": "Execuções",   "description": "Ciclo de vida do fluxo de agentes: criar, aprovar nó, retomar, cancelar"},
        {"name": "Ativos",      "description": "Biblioteca de mídia e conteúdo gerados pelas execuções"},
        {"name": "Campanhas",   "description": "Campanhas no Facebook/Google Ads e snapshots de performance"},
        {"name": "Nichos",      "description": "Base de conhecimento por nicho e fila de aprovação"},
        {"name": "Ferramentas", "description": "Ferramentas auxiliares: prospecção, benchmark, tendências"},
        {"name": "Assistente",  "description": "Assistente consultivo em linguagem natural (somente leitura)"},
        {"name": "Webhooks",    "description": "Callbacks de plataformas externas (Facebook, Google)"},
        {"name": "Sistema",     "description": "Healthcheck e utilitários de infraestrutura"},
    ],
)

# ---------------------------------------------------------------------------
# CORS — permite chamadas do frontend Next.js em desenvolvimento
# ---------------------------------------------------------------------------

settings = get_settings()

_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

if settings.is_production:
    # Em produção substituir pelo domínio real
    _origins = ["https://adcraft.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
# Importados aqui para evitar circular imports — cada módulo define seu próprio
# APIRouter que é incluído com o prefixo correspondente ao PRD seção 8.

from app.api import (  # noqa: E402
    assets,
    assistant,
    campaigns,
    executions,
    health,
    niches,
    projects,
    tools,
    webhooks,
)

app.include_router(projects.router,   prefix="/projects",   tags=["Projetos"])
app.include_router(executions.router, prefix="/executions", tags=["Execuções"])
app.include_router(assets.router,     prefix="/assets",     tags=["Ativos"])
app.include_router(campaigns.router,  prefix="/campaigns",  tags=["Campanhas"])
app.include_router(niches.router,     prefix="/niches",     tags=["Nichos"])
app.include_router(niches.router_knowledge, prefix="/knowledge", tags=["Nichos"])
app.include_router(tools.router,      prefix="/tools",      tags=["Ferramentas"])
app.include_router(assistant.router,  prefix="/assistant",  tags=["Assistente"])
app.include_router(webhooks.router,   prefix="/webhooks",   tags=["Webhooks"])
app.include_router(health.router,     tags=["Sistema"])


# ---------------------------------------------------------------------------
# WebSocket — eventos de alta frequência (custo acumulando, fila de API)
# ---------------------------------------------------------------------------

from app.api import websocket as ws_module  # noqa: E402

app.include_router(ws_module.router)


# ---------------------------------------------------------------------------
# GET /health — healthcheck principal
# ---------------------------------------------------------------------------
# Duplicado aqui como rota raiz de diagnóstico rápido para o Docker Compose.
# A implementação completa (com breakdown por serviço) fica em app/api/health.py.

@app.get("/health", tags=["Sistema"], summary="Healthcheck rápido")
async def health_check() -> dict:
    """
    Verifica disponibilidade dos serviços críticos:
    - Redis: ping via redis-py
    - Supabase: query mínima na tabela projects
    - FFmpeg: verificado na inicialização do container (não re-checado aqui)

    Retorna HTTP 200 com status=healthy se tudo ok,
    ou HTTP 200 com status=degraded listando o serviço com problema.
    O load balancer e o Docker healthcheck usam este endpoint.
    """
    checks: dict[str, str] = {}

    # Redis
    try:
        r = redis_client.from_url(settings.redis_url, socket_connect_timeout=2)
        r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    # Supabase
    try:
        get_supabase().table("projects").select("id").limit(1).execute()
        checks["supabase"] = "ok"
    except Exception as exc:
        checks["supabase"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "healthy" if all_ok else "degraded",
        "services": checks,
        "version": app.version,
        "environment": settings.environment,
    }
