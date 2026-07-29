from fastapi import APIRouter
from app.core.auth import fastapi_users_app, auth_backend
from app.schemas.user import UserRead, UserUpdate

router = APIRouter()

router.include_router(
    fastapi_users_app.get_auth_router(auth_backend),
    prefix="",
)

router.include_router(
    fastapi_users_app.get_users_router(UserRead, UserUpdate),
    prefix="",
)
