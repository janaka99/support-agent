import asyncio
import sys
import os
import uuid

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.cost import calculate_cost, record_usage_log
from app.core.database import async_session_maker
from app.db.models import Org, Conversation, UsageLog, User
from sqlalchemy import select, func


async def main():
    print("=== 1. Testing Cost Calculation Engine ===")
    cost_mini = calculate_cost("gpt-4o-mini", prompt_tokens=1000, completion_tokens=200)
    print(f"gpt-4o-mini (1000 prompt, 200 comp) -> Cost: ${cost_mini:.8f}")
    assert cost_mini > 0
    # 1000 * 0.15/1M = 0.00015, 200 * 0.60/1M = 0.00012, total = 0.00027
    assert round(cost_mini, 5) == 0.00027

    cost_embed = calculate_cost("text-embedding-3-small", prompt_tokens=5000, completion_tokens=0)
    print(f"text-embedding-3-small (5000 prompt) -> Cost: ${cost_embed:.8f}")
    assert round(cost_embed, 7) == 0.0001

    print("\n=== 2. Testing UsageLog Database Logging ===")
    async with async_session_maker() as db:
        # Find or create test org
        res = await db.execute(select(Org).limit(1))
        org = res.scalars().first()
        if not org:
            org = Org(name="Cost Test Org")
            db.add(org)
            await db.commit()
            await db.refresh(org)

        print(f"Using Org ID: {org.id}")

        # Create a test conversation
        conv = Conversation(org_id=org.id, title="Billing and Tracking Inquiry")
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

        # Log multiple usage steps (supervisor, guardrail, agent, embedding)
        await record_usage_log(
            db=db,
            org_id=str(org.id),
            conversation_id=conv.id,
            node_name="Supervisor Router",
            model="gpt-4o-mini",
            prompt_tokens=85,
            completion_tokens=15,
        )

        await record_usage_log(
            db=db,
            org_id=str(org.id),
            conversation_id=conv.id,
            node_name="Security Guardrail",
            model="gpt-4o-mini",
            prompt_tokens=110,
            completion_tokens=10,
        )

        await record_usage_log(
            db=db,
            org_id=str(org.id),
            conversation_id=conv.id,
            node_name="Order Specialist",
            model="gpt-4o-mini",
            prompt_tokens=350,
            completion_tokens=80,
        )

        # Query back total usage for this conversation
        stmt = (
            select(
                func.sum(UsageLog.total_tokens),
                func.sum(UsageLog.cost_usd),
                func.count(UsageLog.id)
            )
            .where(UsageLog.conversation_id == conv.id)
        )
        q_res = await db.execute(stmt)
        tot_toks, tot_cost, log_count = q_res.one()

        print(f"Logged {log_count} execution steps for Conversation {conv.id}")
        print(f"Total Tokens: {tot_toks} | Total Cost: ${float(tot_cost):.6f}")

        assert log_count == 3
        assert tot_toks == (100 + 120 + 430)
        assert float(tot_cost) > 0.0

    print("\n✅ Cost tracking & database logging tests PASSED!")


if __name__ == "__main__":
    asyncio.run(main())
