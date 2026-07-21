import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.db.models import Org, User
import uuid

async def seed():
    async with async_session_maker() as session:
        # Check if user already exists
        from sqlalchemy import select
        existing_user = await session.execute(select(User).where(User.email == "admin@acme.com"))
        if existing_user.scalar_one_or_none():
            print("Database is already seeded with admin@acme.com.")
            return

        # Create an org
        org_id = uuid.uuid4()
        org = Org(id=org_id, name="Acme Corp")
        
        # Create a user
        user = User(id=uuid.uuid4(), org_id=org_id, email="admin@acme.com")
        
        session.add(org)
        session.add(user)
        
        await session.commit()
        print("Database seeded successfully with one org and one user.")

if __name__ == "__main__":
    asyncio.run(seed())
