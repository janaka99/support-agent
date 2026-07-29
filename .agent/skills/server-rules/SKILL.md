---
name: server-rules
description: >
  Backend coding conventions for the support-agent FastAPI server. Use when
  writing or reviewing any Python file inside the server/ directory — route
  files, schemas, models, migrations, seeds, or LangGraph agent logic.
---

# Server Rules Skill

Read `server/AGENTS.md` for the full, authoritative reference. The summary below is a quick-reference checklist.

## Quick Checklist Before Writing Any Backend Code

1. **Where does this file go?**
   - Route handler → `server/app/api/v1/routes/<resource>.py`
   - Pydantic schema → `server/app/schemas/<resource>.py`
   - ORM model → `server/app/db/models.py`
   - Business logic shared across routes → `server/app/core/`
   - LangGraph nodes → `server/app/agent/nodes/`

2. **Which DB dependency?**
   - Org-scoped (99% of routes) → `get_tenant_db`
   - Platform superuser only → `get_superuser_db`
   - Scripts / background tasks → `async_session_maker` directly

3. **Did you filter by org_id in every query?** Even with RLS active, always add `.where(Model.org_id == user.org_id)`.

4. **Are schemas in the right place?** Never define a Pydantic model inside a route file.

5. **Config via settings?** No bare `os.getenv()` calls. Use `from app.core.config import settings`.

6. **Error shape correct?** All errors must use `raise HTTPException(status_code=..., detail="...")`.

7. **New resource? Run the checklist in `server/AGENTS.md`.**

## Key File Locations

| File | Purpose |
|------|---------|
| `server/AGENTS.md` | Full conventions reference |
| `server/app/db/models.py` | All ORM models |
| `server/app/api/deps.py` | `get_tenant_db`, `get_superuser_db` |
| `server/app/core/config.py` | All env vars via `settings` |
| `server/app/core/auth.py` | `current_active_user`, `current_superuser` |
| `server/app/agent/graph.py` | LangGraph dynamic graph builder |
| `server/app/agent/tools/__init__.py` | `TOOL_REGISTRY` dict |
