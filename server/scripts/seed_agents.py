import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.db.models import Org, Agent
from sqlalchemy import select
import uuid

async def seed_agents():
    async with async_session_maker() as session:
        # Get the first org
        result = await session.execute(select(Org).limit(1))
        org = result.scalar_one_or_none()
        
        if not org:
            print("No org found. Run python -m scripts.seed first.")
            return

        # Check if agents already exist for this org
        existing = await session.execute(select(Agent).where(Agent.org_id == org.id))
        if existing.scalars().first():
            print("Agents already seeded for this org.")
            return
            
        agent1 = Agent(
            id=uuid.uuid4(),
            org_id=org.id,
            name="order_agent",
            specialization="orders, order status, or order history",
            system_prompt="You are an order specialist. Use the tools below to get order information",
            model="gpt-4o-mini",
            tools=["get_order_status", "get_order_history"],
            routing_examples=["where is my order", "order status"]
        )
        
        agent2 = Agent(
            id=uuid.uuid4(),
            org_id=org.id,
            name="payment_agent",
            specialization="payments or payment status",
            system_prompt="You are a payment specialist. Use the tools below to get payment information",
            model="gpt-4o-mini",
            tools=["check_payment_status"],
            routing_examples=["did my payment go through", "payment status"]
        )
        
        session.add(agent1)
        session.add(agent2)
        await session.commit()
        
        print("Agents seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_agents())
