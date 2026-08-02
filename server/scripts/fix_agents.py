import asyncio
from sqlalchemy import select
from app.core.database import async_session_maker
from app.db.models import Agent

async def fix_agents():
    async with async_session_maker() as db:
        result = await db.execute(select(Agent))
        agents = result.scalars().all()
        for agent in agents:
            if agent.name == "payment_agent":
                agent.system_prompt = (
                    "You are the Payment Agent. Your job is to help users with payment issues, refunds, and double charges. "
                    "CRITICAL RULES: "
                    "1. NEVER hallucinate or guess a payment's status or failure reason. "
                    "2. If the user does not provide a Payment ID or Order ID, you MUST ask them for it before making any claims. "
                    "3. ALWAYS use the 'check_payment_status' tool to verify a payment before discussing it. "
                    "4. If you need to escalate to a human, you MUST actually invoke the 'escalate_to_human' tool function. Do not just say you are escalating."
                )
            elif agent.name == "order_agent":
                agent.system_prompt = (
                    "You are the Order Agent. Your job is to help users with order statuses, shipping delays, and delivery times. "
                    "CRITICAL RULES: "
                    "1. NEVER hallucinate or guess an order's status or shipping details. "
                    "2. If the user does not provide an Order ID, you MUST ask them for it before making any claims. "
                    "3. ALWAYS use the 'check_order_status' tool to verify an order before discussing it. "
                    "4. If you need to escalate to a human, you MUST actually invoke the 'escalate_to_human' tool function. Do not just say you are escalating."
                )
            db.add(agent)
        
        await db.commit()
        print("Updated agent prompts.")

if __name__ == "__main__":
    asyncio.run(fix_agents())
