# Backend Rules — Support Agent API

This file is the canonical reference for how the FastAPI server is structured and how all new backend code must be written. Read this before touching any file in `server/`.

---

## Project Structure

```
server/
├── app/
│   ├── main.py                  # FastAPI app + middleware only. No business logic.
│   ├── api/
│   │   ├── deps.py              # Shared FastAPI dependencies (DB sessions, auth guards)
│   │   └── v1/
│   │       ├── main.py          # Assembles all routers onto api_router
│   │       └── routes/
│   │           ├── agents.py    # One file per resource domain
│   │           ├── auth.py
│   │           ├── chat.py
│   │           ├── health.py
│   │           ├── org_admin.py
│   │           └── platform_admin.py
│   ├── core/
│   │   ├── auth.py              # fastapi-users setup, current_active_user, current_superuser
│   │   ├── config.py            # Pydantic Settings — all env vars live here
│   │   ├── database.py          # SQLAlchemy engine + async_session_maker
│   │   └── user_manager.py      # fastapi-users UserManager
│   ├── db/
│   │   └── models.py            # All SQLAlchemy ORM models
│   ├── schemas/
│   │   ├── agent.py             # Pydantic schemas for Agent resource
│   │   ├── chat.py              # Pydantic schemas for Chat resource
│   │   └── user.py              # Pydantic schemas for User resource
│   └── agent/
│       ├── graph.py             # LangGraph dynamic builder
│       ├── state.py             # AgentState TypedDict
│       ├── nodes/               # Individual LangGraph node callables
│       └── tools/               # Tool functions + TOOL_REGISTRY dict
├── alembic/
│   └── versions/                # One file per migration. Never edit past migrations.
├── scripts/
│   ├── seed.py                  # Seeds only platform superuser. Idempotent.
│   └── test_*.py                # Manual integration test scripts
└── requirements.txt
```

---

## Non-Negotiable Rules

### 1. Route Files — One resource per file
Each file in `routes/` owns exactly one resource domain. No cross-resource logic inside a route file.

```python
# ✅ Good — agents.py only touches Agent + Document models
# ❌ Bad  — agents.py reaching into Conversation or User tables
```

### 2. Schemas — Never inline in route files
All Pydantic models live in `app/schemas/`. If a route needs a request/response shape, it imports from there.

```python
# ✅ Good
from app.schemas.agent import AgentCreate, AgentResponse

# ❌ Bad — defining a Pydantic class inside a route file
class OrgCreate(BaseModel):  # This belongs in schemas/org.py
    name: str
```

### 3. Dependencies — Use the right DB session

| Scenario | Dependency to use |
|---|---|
| Org-scoped route (most routes) | `get_tenant_db` from `app.api.deps` |
| Platform superuser action only | `get_superuser_db` from `app.api.deps` |
| Background tasks / scripts | `async_session_maker` directly from `app.core.database` |

`get_tenant_db` automatically sets `app.current_org` in Postgres so Row-Level Security activates. Never bypass it.

### 4. Multi-Tenancy — Always filter by org_id
Even though RLS is active, every query must **also** explicitly filter by `org_id`. Defense in depth.

```python
# ✅ Good
select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id)

# ❌ Bad — relies solely on RLS, no explicit filter
select(Agent).where(Agent.id == agent_id)
```

### 5. Error Responses — Always use HTTPException with detail string

```python
# ✅ Good
raise HTTPException(status_code=404, detail="Agent not found")

# ❌ Bad — bare dict, non-standard shape
return {"error": "not found"}, 404
```

### 6. Config — All env vars go through Settings
No `os.getenv()` calls anywhere. Import `settings` from `app.core.config`.

```python
# ✅ Good
from app.core.config import settings
api_key = settings.OPENAI_API_KEY

# ❌ Bad
import os
api_key = os.getenv("OPENAI_API_KEY")
```

### 7. Migrations — Never edit a past migration
If the schema needs to change, create a new migration: `make migrate MSG="description"` inside the container.

The correct command is:
```bash
docker-compose -f infra/docker-compose.yml exec api python -m alembic revision --autogenerate -m "your message"
docker-compose -f infra/docker-compose.yml exec api python -m alembic upgrade head
```

Then inspect the generated file and add `op.execute('CREATE EXTENSION IF NOT EXISTS vector;')` if the migration touches `pgvector` columns.

### 8. Seed script — Idempotent and minimal
`scripts/seed.py` must be safe to run multiple times. It should only seed the platform superuser. Test data for individual orgs must **not** be in seed — create it through the API.

---

## Auth Roles

| Role | How to check | Can do |
|---|---|---|
| Platform superuser | `user.is_superuser` | Create/manage orgs, bypass RLS |
| Org admin | `user.role == "admin"` | Manage own org users, agents |
| Org member | Any authenticated user | Read/use agents, chat |

Use `current_active_user` for any org-scoped route. Use `current_superuser` only for platform-admin routes.

---

## Adding a New Resource (Checklist)

1. Add ORM model to `app/db/models.py`
2. Add Pydantic schemas to `app/schemas/<resource>.py` (Create, Update, Response classes)
3. Create `app/api/v1/routes/<resource>.py` with `router = APIRouter()`
4. Register the router in `app/api/v1/main.py` with the correct prefix and tag
5. Generate a migration: `make migrate MSG="add <resource> table"`
6. Inspect and apply the migration
