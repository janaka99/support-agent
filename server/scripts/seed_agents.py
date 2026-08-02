import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import async_session_maker
from app.db.models import Org, Agent
import uuid

async def seed_agents():
    async with async_session_maker() as session:
        # Fetch the default org
        result = await session.execute(select(Org).where(Org.name == "Admin Corp"))
        org = result.scalar_one_or_none()
        
        if not org:
            print("Default org not found. Please run seed.py first.")
            return

        # Check if agents already exist
        existing_agents = await session.execute(select(Agent).where(Agent.org_id == org.id))
        if existing_agents.scalars().first():
            print("Agents already exist for this org.")
            return

        print("Seeding agents...")

        # 1. Order Agent
        order_agent = Agent(
            id=uuid.uuid4(),
            org_id=org.id,
            name="order_agent",
            specialization="order issues, shipping delays, missing items, and delivery status.",
            system_prompt="You are a helpful customer support agent specializing in order issues. Always ask for an order ID if not provided, and use the get_order_status tool to check the order.",
            model="gpt-4o-mini",
            tools=["get_order_status", "get_order_history"]
        )

        # 2. Payment Agent
        payment_agent = Agent(
            id=uuid.uuid4(),
            org_id=org.id,
            name="payment_agent",
            specialization="payment failures, refunds, double charges, and billing questions.",
            system_prompt="You are a helpful customer support agent specializing in payments and billing. If a user asks for a refund or has a payment issue, use the check_payment_status or process_refund tools.",
            model="gpt-4o-mini",
            tools=["check_payment_status", "process_refund"]
        )

        session.add(order_agent)
        session.add(payment_agent)
        
        await session.commit()
        print("Successfully seeded Order Agent and Payment Agent.")

if __name__ == "__main__":
    asyncio.run(seed_agents())
