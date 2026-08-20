from fastapi import APIRouter
from app.api.v1.routes import (
    health,
    chat,
    auth,
    platform_admin,
    org_admin,
    agents,
    bots,
    tools,
    escalations,
    analytics,
    guardrails,
    models,
    knowledge_bases,
    telegram,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(platform_admin.router, prefix="/platform-admin", tags=["platform-admin"])
api_router.include_router(org_admin.router, prefix="/org-admin", tags=["org-admin"])
api_router.include_router(bots.router, tags=["bots"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(tools.router, tags=["tools"])
api_router.include_router(knowledge_bases.router, tags=["knowledge-bases"])
api_router.include_router(models.router, tags=["models"])
api_router.include_router(guardrails.router, prefix="/guardrails", tags=["guardrails"])
api_router.include_router(escalations.router, prefix="/escalations", tags=["escalations"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
