import asyncio
import uuid
import sys
from langchain_core.messages import HumanMessage
from app.core.database import async_session_maker
from app.db.models import Org
from sqlalchemy import select
from app.agent.graph import build_graph

async def main():
    async with async_session_maker() as session:
        result = await session.execute(select(Org).where(Org.name == "Admin Corp"))
        org = result.scalar_one_or_none()
        
        graph = await build_graph(str(org.id), session)
        
        from app.db.models import Conversation
        
        conv_id = uuid.uuid4()
        session.add(Conversation(id=conv_id, org_id=org.id, title="Single Test"))
        await session.commit()
        
        print("Invoking graph...")
        state_input = {
            "messages": [HumanMessage(content="My payment failed and I really need to speak to a human right now.")],
            "conversation_id": str(conv_id)
        }
        
        async for event in graph.astream(state_input):
            for node, val in event.items():
                print(f"Node: {node}")
                
if __name__ == "__main__":
    asyncio.run(main())
