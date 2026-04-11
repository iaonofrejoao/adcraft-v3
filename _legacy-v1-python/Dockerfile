# backend/Dockerfile — FastAPI + Uvicorn
# Imagem de produção para o serviço backend do AdCraft.

FROM python:3.12-slim

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependências de sistema
# ffmpeg  — montagem de vídeo pelo Agente 12 (Diretor de Criativo)
# curl    — healthcheck do Docker Compose (GET /health)
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Dependências Python
# Copiadas antes do código para aproveitar o cache de layer do Docker:
# o layer de pip só é refeito quando requirements.txt mudar.
# ---------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Código da aplicação
# ---------------------------------------------------------------------------
COPY . .

# ---------------------------------------------------------------------------
# Segurança: usuário não-root
# ---------------------------------------------------------------------------
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

EXPOSE 8000

# ---------------------------------------------------------------------------
# 2 workers Uvicorn conforme PRD seção 13.3
# Em desenvolvimento o docker-compose.yml faz volume mount e o código
# é sobrescrito pelo host — sem necessidade de --reload aqui.
# ---------------------------------------------------------------------------
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2"]
