from fastapi import APIRouter
from app.api.v1.routes import health, chat

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chat.router, tags=["chat"])

