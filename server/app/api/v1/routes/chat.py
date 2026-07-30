from fastapi.responses import StreamingResponse
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.db.models import Org, Conversation, Message
from app.schemas.chat import ChatRequest
from app.agent.graph import build_graph
from app.core.redis import redis_client
from fastapi import Request


router = APIRouter()

import time

TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = 1

local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
local tokens = tonumber(bucket[1])
local last_update = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_update = now
else
    local time_passed = now - last_update
    tokens = math.min(capacity, tokens + (time_passed * refill_rate))
end

if tokens >= requested then
    redis.call('HMSET', key, 'tokens', tokens - requested, 'last_update', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)
    return 1
else
    return 0
end
"""

@router.post("/chat", status_code=status.HTTP_200_OK)
async def chat_endpoint(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    conversation = None
    if body.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == body.conversation_id)
        )
        conversation = result.scalar_one_or_none()

    # Get org to rate limit against
    if conversation:
        org_id_str = str(conversation.org_id)
    else:
        # Get default seeded org
        org_result = await db.execute(select(Org).limit(1))
        org = org_result.scalar_one_or_none()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No organization found in database. Please run seed script first."
            )
        org_id_str = str(org.id)

    # Perform rate limiting: e.g., 5 requests capacity, 1 request per 2 seconds (0.5 rate)
    now = time.time()
    allowed = await redis_client.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        f"rate_limit:chat:{org_id_str}",
        5,    # capacity
        0.5,  # refill_rate (tokens/sec)
        now
    )
    if not allowed:
        pass # Disabled for load testing
        # raise HTTPException(
        #     status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        #     detail="Rate limit exceeded. Please try again later."
        # )

    if not conversation:
        # Generate a simple title from the first message
        title = body.message[:50] + "..." if len(body.message) > 50 else body.message
        
        conversation = Conversation(org_id=org.id, status="open", title=title)
        db.add(conversation)
        await db.flush()

    # Save incoming user message
    user_msg = Message(
        conversation_id=conversation.id,
        org_id=conversation.org_id,
        role="user",
        content=body.message
    )
    db.add(user_msg)
    await db.flush()
    await db.commit()

    await redis_client.xadd(
        "chat_jobs",
        {
            "conversation_id": str(conversation.id),
            "org_id": str(conversation.org_id),
            "user_message": body.message
        }
    )

    return {
        "status": "accepted",
        "conversation_id": str(conversation.id),
        "message_id": str(user_msg.id)
    }

@router.get("/conversations", status_code=status.HTTP_200_OK)
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """Fetch all conversations for the default org (for now)."""
    # Get default seeded org
    org_result = await db.execute(select(Org).limit(1))
    org = org_result.scalar_one_or_none()
    if not org:
        return []

    # Get conversations ordered by creation
    result = await db.execute(
        select(Conversation)
        .where(Conversation.org_id == org.id)
        .order_by(Conversation.id) # UUIDs are somewhat temporal but really should use created_at
    )
    
    conversations = result.scalars().all()
    
    return [
        {
            "id": str(c.id), 
            "status": c.status, 
            "title": c.title or "New Conversation"
        } for c in conversations
    ]

@router.get("/conversations/{conversation_id}/messages", status_code=status.HTTP_200_OK)
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch history for a conversation."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in messages
    ]


@router.get("/chat/{conversation_id}")
async def chat_stream(conversation_id: str, request: Request):
    """
    Server-Sent Events (SSE) endpoint. 
    Subscribes to the Redis Pub/Sub channel for the given conversation.
    """
    async def event_generator():
        pubsub = redis_client.pubsub()
        channel_name = f"chat_{conversation_id}"
        await pubsub.subscribe(channel_name)
        
        try:
            # Yield an initial message to establish the connection quickly
            yield "data: connected\n\n"
            
            async for message in pubsub.listen():
                # If the client disconnected, request.is_disconnected() will be true
                if await request.is_disconnected():
                    break
                if message["type"] == "message":
                    data = message["data"]
                    if data == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    # SSE format requires "data: <content>\n\n"
                    yield f"data: {data}\n\n"
                    
        except asyncio.CancelledError:
            # Happens if the client drops the connection
            pass
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
    return StreamingResponse(event_generator(), media_type="text/event-stream")