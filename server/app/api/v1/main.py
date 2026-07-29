from fastapi import APIRouter
from app.api.v1.routes import health, chat, auth, platform_admin, org_admin, agents

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(platform_admin.router, prefix="/platform-admin", tags=["platform-admin"])
api_router.include_router(org_admin.router, prefix="/org-admin", tags=["org-admin"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])

