import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import async_session_maker
from app.db.models import Org, Agent

async def update_agents():
    async with async_session_maker() as session:
        # Fetch the default org
        result = await session.execute(select(Org).where(Org.name == "Admin Corp"))
        org = result.scalar_one_or_none()
        
        if not org:
            print("Default org not found.")
            return

        print("Updating agents...")

        # Fetch order agent
        order_agent_res = await session.execute(select(Agent).where(Agent.org_id == org.id, Agent.name == "order_agent"))
        order_agent = order_agent_res.scalar_one_or_none()
        
        if order_agent:
            if "escalate_to_human" not in order_agent.tools:
                order_agent.tools = order_agent.tools + ["escalate_to_human"]
            
            append_str = " If you cannot resolve the user's issue, or if they explicitly ask for a human, you MUST use the escalate_to_human tool and explain why."
            if append_str not in order_agent.system_prompt:
                order_agent.system_prompt += append_str
        
        # Fetch payment agent
        payment_agent_res = await session.execute(select(Agent).where(Agent.org_id == org.id, Agent.name == "payment_agent"))
        payment_agent = payment_agent_res.scalar_one_or_none()
        
        if payment_agent:
            if "escalate_to_human" not in payment_agent.tools:
                payment_agent.tools = payment_agent.tools + ["escalate_to_human"]
            
            append_str = " If you cannot resolve the user's issue, or if they explicitly ask for a human, you MUST use the escalate_to_human tool and explain why."
            if append_str not in payment_agent.system_prompt:
                payment_agent.system_prompt += append_str

        await session.commit()
        print("Successfully updated Order Agent and Payment Agent with escalation tools and prompts.")

if __name__ == "__main__":
    asyncio.run(update_agents())
