.PHONY: migrate upgrade seed test dev fix-alembic up down logs logs-api logs-web shell-api shell-web build recreate recreate-api restart

# ==========================================
# Local Server Commands
# ==========================================
migrate:
	cd server && python -m alembic revision --autogenerate -m "$(MSG)"

upgrade:
	cd server && python -m alembic upgrade head

seed:
	docker-compose -f infra/docker-compose.yml exec api python -m scripts.seed

test:
	cd server && python -m scripts.test_chat

dev:
	cd server && python -m uvicorn app.main:app --reload

down:
	docker-compose -f infra/docker-compose.yml down -v


# Fixes "Can't locate revision identified by X" by wiping the migration table and restamping to head
fix-alembic:
	cd server && python -m alembic stamp head

# ==========================================
# Docker Commands
# ==========================================
# Start all services
up:
	docker-compose -f infra/docker-compose.yml up -d

# Stop all services
down:
	docker-compose -f infra/docker-compose.yml down

# View logs for all services
logs:
	docker-compose -f infra/docker-compose.yml logs -f

# View logs for just the API (server)
logs-api:
	docker-compose -f infra/docker-compose.yml logs -f api

# View logs for just the web frontend
logs-web:
	docker-compose -f infra/docker-compose.yml logs -f web

# Open a shell in the API container
shell-api:
	docker-compose -f infra/docker-compose.yml exec api sh

# Open a shell in the web container
shell-web:
	docker-compose -f infra/docker-compose.yml exec web sh

# Build docker images
build:
	docker-compose -f infra/docker-compose.yml build

# Build docker images
build-web:
	docker-compose -f infra/docker-compose.yml build web

# Deploy a local development environment
dev:
	docker-compose -f infra/docker-compose.yml up -d --build

# Run the autoscaler demo
autoscaler:
	pip install redis
	python server/scripts/autoscaler.py

# Rebuild and recreate all containers
recreate:
	docker-compose -f infra/docker-compose.yml up -d --force-recreate --build -V

# Rebuild and recreate just the API container
recreate-api:
	docker-compose -f infra/docker-compose.yml up -d --force-recreate --build -V api

# Rebuild and recreate just the web container
recreate-web:
	docker-compose -f infra/docker-compose.yml up -d --force-recreate --build -V web
recreate-worker:
	docker-compose -f infra/docker-compose.yml up -d --force-recreate --build -V worker

# Restart all services without rebuilding
restart:
	docker-compose -f infra/docker-compose.yml restart

# View logs
logs:
	docker-compose -f infra/docker-compose.yml logs -f

logs-api:
	docker-compose -f infra/docker-compose.yml logs -f api

logs-web:
	docker-compose -f infra/docker-compose.yml logs -f web

logs-worker:
	docker-compose -f infra/docker-compose.yml logs -f worker
