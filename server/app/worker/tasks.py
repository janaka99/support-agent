from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from sqlalchemy import select

from app.core.database import async_session_maker
from app.db.models import Message
from app.agent.graph import build_graph
import  json
from app.core.redis import redis_client

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.core.config import settings

async def process_chat_job(job_id: str, data: dict, worker_name: str):
    """
    Consumes a chat job, runs LangGraph, and saves the AI response.
    """
    print(f"[{worker_name}] Processing chat job: {job_id} for Conversation {data['conversation_id']}")
    
    # Open a new database session for this background job
    async with async_session_maker() as db:
        # Construct the checkpointer using the asyncpg connection string
        conn_string = str(settings.DATABASE_URL).replace('+asyncpg', '')
        
        async with AsyncPostgresSaver.from_conn_string(conn_string) as checkpointer:
            # Ensure checkpoint tables exist
            await checkpointer.setup()
            
            # 1. Invoke the LangGraph graph with checkpointing enabled
            try:
                dynamic_graph = await build_graph(data["org_id"], db, checkpointer=checkpointer)
                
                # Because the checkpointer stores history, we ONLY need to pass the new message
                new_message = HumanMessage(content=data["user_message"])
                config = {"configurable": {"thread_id": data["conversation_id"]}}
                
                graph_result = await dynamic_graph.ainvoke({
                    "messages": [new_message],
                    "conversation_id": data["conversation_id"]
                }, config=config)
                
                last_message = graph_result["messages"][-1]
                assistant_content = str(last_message.content)
                
                # 4. Save the assistant's reply to the database
                assistant_msg = Message(
                    conversation_id=data["conversation_id"],
                    org_id=data["org_id"],
                    role="assistant",
                    content=assistant_content
                )
                db.add(assistant_msg)
                await db.commit()

                # Publish the result to Redis Pub/Sub
                channel_name = f"chat_{data['conversation_id']}"
                payload = json.dumps({
                    "id": str(assistant_msg.id),
                    "role": "assistant",
                    "content": assistant_content
                })
                await redis_client.publish(channel_name, payload)
                
                # Signal the end of the stream
                await redis_client.publish(channel_name, "[DONE]")
                
                print(f"[{worker_name}] Successfully saved reply for job {job_id}")
            except Exception as e:
                print(f"[{worker_name}] Error processing job: {e}")
