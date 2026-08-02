import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models import AuditLog
from app.core.config import settings

url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(url)
async_session = async_sessionmaker(engine)

async def main():
    async with async_session() as session:
        res = await session.execute(select(AuditLog))
        logs = res.scalars().all()
        print(f"Total audit logs captured: {len(logs)}")
        if logs:
            print(f"Sample log: Tool: {logs[0].tool_name}, Input: {logs[0].input}, Output: {logs[0].output}")

asyncio.run(main())
