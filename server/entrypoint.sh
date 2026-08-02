#!/bin/sh
set -e

# If RUN_MIGRATIONS is true (default in entrypoint if not explicitly disabled)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[entrypoint] Checking and applying database migrations..."
    python -m alembic upgrade head || {
        echo "[entrypoint] Migration failed or database not ready yet."
    }
fi

# If RUN_SEED is explicitly requested
if [ "${RUN_SEED:-false}" = "true" ]; then
    echo "[entrypoint] Seeding initial database data..."
    python -m scripts.seed || echo "[entrypoint] Seed step skipped or already seeded."
fi

exec "$@"
