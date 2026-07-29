import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.schemas.user import UserCreate
from app.core.user_manager import UserManager
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from app.db.models import User, Org

async def seed_superuser():
    async with async_session_maker() as session:
        # Create a "System" org for the superuser to belong to
        new_org = Org(name="System")
        session.add(new_org)
        await session.commit()
        await session.refresh(new_org)

        user_db = SQLAlchemyUserDatabase(session, User)
        user_manager = UserManager(user_db)
        
        user_create = UserCreate(
            email="admin@system.com",
            password="adminpassword",
            org_id=new_org.id,
            role="admin",
            is_superuser=True
        )
        
        user = await user_manager.create(user_create, safe=False)
        print(f"Superuser created successfully: {user.email} (Password: adminpassword)")
        print(f"System Org ID: {new_org.id}")

if __name__ == "__main__":
    asyncio.run(seed_superuser())
