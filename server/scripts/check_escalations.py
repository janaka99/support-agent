import asyncio
from app.core.database import async_session_maker
from sqlalchemy import select
from app.db.models import Escalation

async def check_escalations():
    async with async_session_maker() as session:
        result = await session.execute(select(Escalation))
        escalations = result.scalars().all()
        print(f"Total escalations: {len(escalations)}")
        for esc in escalations:
            print(f"Reason: {esc.reason}")

if __name__ == "__main__":
    asyncio.run(check_escalations())
