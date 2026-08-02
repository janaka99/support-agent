import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import async_session_maker
from app.db.models import User, Org
from sqlalchemy import select
from app.api.v1.routes.analytics import get_analytics_overview


async def test_analytics():
    print("Testing get_analytics_overview logic...")
    async with async_session_maker() as db:
        # Find first user
        res = await db.execute(select(User).limit(1))
        user = res.scalars().first()
        if not user:
            print("No user found in DB to test.")
            return

        overview = await get_analytics_overview(db=db, user=user)
        print("Overview Data:")
        print(f"Total Tokens: {overview.total_tokens}")
        print(f"Total Cost USD: ${overview.total_cost_usd:.6f}")
        print(f"Total Conversations: {overview.total_conversations}")
        print(f"Avg Cost/Conversation: ${overview.avg_cost_per_conversation:.6f}")
        print(f"Daily History Items: {len(overview.daily_cost_history)}")
        print(f"Model Breakdown Items: {len(overview.model_breakdown)}")
        print(f"Recent Conversations Count: {len(overview.recent_conversations)}")
        
        assert overview.total_tokens >= 0
        assert len(overview.daily_cost_history) == 14
        print("✅ Analytics endpoint logic PASSED!")


if __name__ == "__main__":
    asyncio.run(test_analytics())
