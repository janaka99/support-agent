import uuid
from typing import Optional, AsyncGenerator
from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.core.database import get_db, async_session_maker
from sqlalchemy import text
from app.core.config import settings

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

async def get_system_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        await session.execute(text("SET app.is_superuser = 'true'"))
        yield session

async def get_user_db(session: AsyncSession = Depends(get_system_db)):
    yield SQLAlchemyUserDatabase(session, User)

async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)
