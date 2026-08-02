import json
import uuid
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from sqlalchemy import select
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.database import async_session_maker
from app.db.models import Message, Conversation
from app.agent.graph import build_bot_graph
from app.core.redis import redis_client
from app.core.config import settings

async def process_chat_job(job_id: str, data: dict, worker_name: str):
    """
    Consumes a chat job, runs dynamic multi-agent LangGraph for the specified Bot, and saves the AI response.
    """
    conv_id = data.get("conversation_id")
    org_id = data.get("org_id")
    bot_id = data.get("bot_id")

    print(f"[{worker_name}] Processing chat job: {job_id} for Conversation {conv_id} (Bot: {bot_id})")
    
    async with async_session_maker() as db:
        # If bot_id was not explicitly in data payload, look it up from conversation
        if not bot_id and conv_id:
            res = await db.execute(select(Conversation.bot_id).where(Conversation.id == uuid.UUID(str(conv_id))))
            bot_id_val = res.scalar_one_or_none()
            if bot_id_val:
                bot_id = str(bot_id_val)

        conn_string = str(settings.DATABASE_URL).replace('+asyncpg', '')
        
        async with AsyncPostgresSaver.from_conn_string(conn_string) as checkpointer:
            await checkpointer.setup()
            
            try:
                # Build dynamic graph for this bot & its specialist agents & tools
                dynamic_graph = await build_bot_graph(
                    org_id=org_id,
                    db=db,
                    bot_id=bot_id,
                    checkpointer=checkpointer
                )
                
                new_message = HumanMessage(content=data["user_message"])
                config = {
                    "configurable": {"thread_id": str(conv_id)},
                    "metadata": {
                        "session_id": str(conv_id),
                        "user_id": str(org_id),
                        "bot_id": str(bot_id) if bot_id else "default",
                    },
                    "run_name": "support-agent-chat",
                }
                
                graph_result = await dynamic_graph.ainvoke({
                    "messages": [new_message],
                    "conversation_id": conv_id
                }, config=config)

                last_message = graph_result["messages"][-1]
                assistant_content = str(last_message.content)
                
                # Save assistant reply
                assistant_msg = Message(
                    conversation_id=uuid.UUID(str(conv_id)),
                    org_id=uuid.UUID(str(org_id)),
                    role="assistant",
                    content=assistant_content
                )
                db.add(assistant_msg)
                await db.commit()

                # Publish result to Redis Pub/Sub
                channel_name = f"chat_{conv_id}"
                payload = json.dumps({
                    "id": str(assistant_msg.id),
                    "role": "assistant",
                    "content": assistant_content
                })
                await redis_client.publish(channel_name, payload)
                await redis_client.publish(channel_name, "[DONE]")
                
                print(f"[{worker_name}] Successfully saved reply for job {job_id}")

            except Exception as e:
                print(f"[{worker_name}] Error processing job: {e}")
                
                error_content = "I'm having trouble connecting right now. Please try again later."
                fallback_msg = Message(
                    conversation_id=uuid.UUID(str(conv_id)),
                    org_id=uuid.UUID(str(org_id)),
                    role="assistant",
                    content=error_content
                )
                db.add(fallback_msg)
                await db.commit()
                
                channel_name = f"chat_{conv_id}"
                payload = json.dumps({
                    "id": str(fallback_msg.id),
                    "role": "assistant",
                    "content": error_content
                })
                await redis_client.publish(channel_name, payload)
                await redis_client.publish(channel_name, "[DONE]")
