from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.models import User
from app.core.database import async_session_maker
from app.core.auth import current_active_user, current_superuser

async def get_tenant_db(
    user: User = Depends(current_active_user)
) -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        if user.is_superuser:
            await session.execute(text("SET app.is_superuser = 'true'"))
        else:
            await session.execute(text("SET app.is_superuser = 'false'"))
            await session.execute(
                text("SELECT set_config('app.current_org', :org_id, false)"), 
                {"org_id": str(user.org_id)}
            )
        yield session

async def get_superuser_db(
    user: User = Depends(current_superuser)
) -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        await session.execute(text("SET app.is_superuser = 'true'"))
        yield session
