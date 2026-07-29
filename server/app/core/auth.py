import uuid
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from app.core.config import settings
from fastapi_users import FastAPIUsers
from app.db.models import User
from app.core.user_manager import get_user_manager

bearer_transport = BearerTransport(tokenUrl="/api/v1/auth/login")

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.SECRET_KEY, lifetime_seconds=3600 * 24) # 24 hours

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users_app = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users_app.current_user(active=True)
current_superuser = fastapi_users_app.current_user(active=True, superuser=True)
