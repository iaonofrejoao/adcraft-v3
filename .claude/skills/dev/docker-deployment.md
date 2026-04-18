---
name: docker-deployment
description: >
  Configure Docker, Docker Compose, and production deployment for full-stack applications
  combining Next.js frontend, Python FastAPI backend, Celery workers, and Redis.
  Use this skill whenever setting up local development environments, containerizing services,
  writing Dockerfiles, configuring docker-compose, or preparing a stack for production
  deployment. Triggers on: Docker, docker-compose, Dockerfile, containerize, deployment,
  production setup, local environment, Redis setup, Celery worker, or any request
  involving running multiple services together.
---

# Docker + Deployment — Stack Completa AdCraft

Skill para configurar o ambiente de desenvolvimento local e produção da stack
Next.js + FastAPI + Celery + Redis + Supabase.

---

## Visão Geral da Stack

```
┌─────────────────────────────────────────────────┐
│                   Docker Compose                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ frontend │  │ backend  │  │ celery_worker │  │
│  │ Next.js  │  │ FastAPI  │  │  (agentes)    │  │
│  │ :3000    │  │ :8000    │  │               │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│  ┌────▼──────────────▼────────────────▼───────┐  │
│  │              redis :6379                   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Supabase → serviço externo (não dockerizado)    │
│  Cloudflare R2 → serviço externo                │
└─────────────────────────────────────────────────┘
```

---

## Dockerfile — Frontend Next.js

```dockerfile
# frontend/Dockerfile

FROM node:20-alpine AS base

WORKDIR /app

# Instala dependências
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Build
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Produção
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

---

## Dockerfile — Backend FastAPI

```dockerfile
# backend/Dockerfile

FROM python:3.12-slim

WORKDIR /app

# Instala FFmpeg e dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --break-system-packages || pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .

# Usuário não-root para segurança
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## Dockerfile — Celery Worker

```dockerfile
# backend/Dockerfile.worker
# Mesmo ambiente do backend, mas inicia Celery

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser
USER appuser

# Celery worker com concorrência 4
CMD ["celery", "-A", "app.workers.celery_app", "worker",
     "--loglevel=info", "--concurrency=4",
     "--queues=executions,default"]
```

---

## Docker Compose — Desenvolvimento Local

```yaml
# docker-compose.yml
version: '3.9'

services:

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379/0
      - CLOUDFLARE_R2_ACCOUNT_ID=${CLOUDFLARE_R2_ACCOUNT_ID}
      - CLOUDFLARE_R2_ACCESS_KEY_ID=${CLOUDFLARE_R2_ACCESS_KEY_ID}
      - CLOUDFLARE_R2_SECRET_ACCESS_KEY=${CLOUDFLARE_R2_SECRET_ACCESS_KEY}
      - CLOUDFLARE_R2_BUCKET_NAME=${CLOUDFLARE_R2_BUCKET_NAME}
      - CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_ENCRYPTION_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - META_APP_ACCESS_TOKEN=${META_APP_ACCESS_TOKEN}
      - ENVIRONMENT=development
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app   # Hot reload em desenvolvimento
    restart: unless-stopped

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379/0
      - CLOUDFLARE_R2_ACCOUNT_ID=${CLOUDFLARE_R2_ACCOUNT_ID}
      - CLOUDFLARE_R2_ACCESS_KEY_ID=${CLOUDFLARE_R2_ACCESS_KEY_ID}
      - CLOUDFLARE_R2_SECRET_ACCESS_KEY=${CLOUDFLARE_R2_SECRET_ACCESS_KEY}
      - CLOUDFLARE_R2_BUCKET_NAME=${CLOUDFLARE_R2_BUCKET_NAME}
      - CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_ENCRYPTION_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    restart: unless-stopped

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    command: >
      celery -A app.workers.celery_app beat
      --loglevel=info
      --schedule=/tmp/celerybeat-schedule
    environment:
      - REDIS_URL=redis://redis:6379/0
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes  # Persistência
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  redis_data:
```

---

## Arquivo .env (raiz do projeto)

```bash
# .env — nunca commitar no git

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=adcraft-media

# Segurança
CREDENTIAL_ENCRYPTION_KEY=  # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# APIs de IA (server-side apenas)
ANTHROPIC_API_KEY=

# APIs externas
YOUTUBE_API_KEY=
META_APP_ACCESS_TOKEN=
```

---

## .gitignore

```gitignore
# Ambiente
.env
.env.local
.env.production
*.env

# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/

# Next.js
.next/
node_modules/
out/

# Docker
*.log

# Celery
celerybeat-schedule
celerybeat.pid

# Temporários
tmp/
temp/
```

---

## Makefile — Comandos de Desenvolvimento

```makefile
# Makefile

.PHONY: up down restart logs shell-backend shell-frontend migrate

# Sobe a stack completa
up:
	docker-compose up -d --build

# Para todos os serviços
down:
	docker-compose down

# Restart de um serviço específico
restart:
	docker-compose restart $(service)

# Logs em tempo real
logs:
	docker-compose logs -f $(service)

# Shell no backend
shell-backend:
	docker-compose exec backend bash

# Shell no frontend
shell-frontend:
	docker-compose exec frontend sh

# Roda migrações do banco
migrate:
	docker-compose exec backend python -m app.database.migrate

# Limpa volumes (cuidado — apaga dados do Redis)
clean:
	docker-compose down -v

# Build sem cache
rebuild:
	docker-compose build --no-cache
```

---

## Healthchecks dos Serviços

```python
# app/api/health.py
from fastapi import APIRouter
import redis
import os

router = APIRouter()

@router.get("/health")
async def health():
    """Endpoint de health check para o load balancer."""
    checks = {}

    # Redis
    try:
        r = redis.from_url(os.environ["REDIS_URL"])
        r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # Supabase
    try:
        from app.database import get_supabase
        get_supabase().table("projects").select("count").limit(1).execute()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "healthy" if all_ok else "degraded",
        "services": checks
    }
```

---

## Configuração do Celery com Tarefas Agendadas

```python
# app/workers/celery_app.py
from celery import Celery
from celery.schedules import crontab
import os

celery_app = Celery(
    "adcraft",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"],
    include=["app.workers.execution_tasks", "app.workers.scheduled_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # Um job por worker (jobs longos)
    task_track_started=True,

    beat_schedule={
        # Agente de performance roda todo dia às 5h
        "daily-performance-analysis": {
            "task": "app.workers.scheduled_tasks.run_daily_performance",
            "schedule": crontab(hour=5, minute=0),
        },
    }
)
```
