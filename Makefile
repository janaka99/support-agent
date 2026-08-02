.PHONY: up down down-v restart build dev logs logs-api logs-web logs-worker prod-up prod-down prod-build prod-logs migrate upgrade seed test evals shell-api shell-web

# ==============================================================================
# Local Development Stack (Self-Contained Postgres + Redis + Apps)
# ==============================================================================
up:
	docker compose -f infra/docker-compose.yml up -d

dev:
	docker compose -f infra/docker-compose.yml up -d --build

down:
	docker compose -f infra/docker-compose.yml down

down-v:
	docker compose -f infra/docker-compose.yml down -v

restart:
	docker compose -f infra/docker-compose.yml restart

build:
	docker compose -f infra/docker-compose.yml build

logs:
	docker compose -f infra/docker-compose.yml logs -f

logs-api:
	docker compose -f infra/docker-compose.yml logs -f api

logs-web:
	docker compose -f infra/docker-compose.yml logs -f web

logs-worker:
	docker compose -f infra/docker-compose.yml logs -f worker

# ==============================================================================
# Production App Stack (Targeting External Managed DB & Redis)
# ==============================================================================
prod-up:
	docker compose -f infra/docker-compose.prod.yml up -d

prod-build:
	docker compose -f infra/docker-compose.prod.yml build

prod-down:
	docker compose -f infra/docker-compose.prod.yml down

prod-logs:
	docker compose -f infra/docker-compose.prod.yml logs -f

# ==============================================================================
# Database & Utility Commands
# ==============================================================================
migrate:
	docker compose -f infra/docker-compose.yml exec api python -m alembic revision --autogenerate -m "$(MSG)"

upgrade:
	docker compose -f infra/docker-compose.yml exec api python -m alembic upgrade head

seed:
	docker compose -f infra/docker-compose.yml exec api python -m scripts.seed

test:
	cd server && python -m scripts.test_chat

evals:
	docker compose -f infra/docker-compose.yml exec api python -m scripts.run_evals

shell-api:
	docker compose -f infra/docker-compose.yml exec api sh

shell-web:
	docker compose -f infra/docker-compose.yml exec web sh
