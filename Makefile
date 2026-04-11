.PHONY: up down restart logs shell-backend migrate clean rebuild test

# Sobe a stack completa em background
up:
	docker-compose up -d --build

# Para todos os serviços (mantém volumes)
down:
	docker-compose down

# Restart de um serviço: make restart service=backend
restart:
	docker-compose restart $(service)

# Logs em tempo real: make logs service=celery_worker
logs:
	docker-compose logs -f $(service)

# Shell no backend
shell-backend:
	docker-compose exec backend bash

# Aplica migrations no Supabase via psql
# Requer DATABASE_PASSWORD no .env
migrate:
	@for f in migrations/*.sql; do \
		echo "Aplicando $$f..."; \
		PGPASSWORD=$$(grep DATABASE_PASSWORD .env | cut -d= -f2) \
		psql "$$(grep SUPABASE_URL .env | cut -d= -f2 | sed 's/https/postgresql/')/postgres" \
		-U postgres -f "$$f"; \
	done

# Roda testes unitários dentro do container
test:
	docker-compose exec backend pytest tests/unit/ -v

# Para e remove volumes (apaga dados do Redis)
clean:
	docker-compose down -v

# Build sem cache (após mudança no requirements.txt ou Dockerfile)
rebuild:
	docker-compose build --no-cache
