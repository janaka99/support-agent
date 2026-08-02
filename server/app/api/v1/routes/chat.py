import uuid
from typing import Optional
from fastapi.responses import StreamingResponse
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.db.models import Org, Conversation, Message, Bot
from app.schemas.chat import ChatRequest
from app.core.redis import redis_client

router = APIRouter()

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

    # Get org
    if conversation:
        org_id = conversation.org_id
        target_bot_id = conversation.bot_id or body.bot_id
    else:
        # Resolve bot or fallback to first org bot
        if body.bot_id:
            bot_res = await db.execute(select(Bot).where(Bot.id == body.bot_id))
            bot_obj = bot_res.scalar_one_or_none()
            if bot_obj:
                org_id = bot_obj.org_id
                target_bot_id = bot_obj.id
            else:
                target_bot_id = None
                org_res = await db.execute(select(Org).limit(1))
                org_id = org_res.scalar_one().id
        else:
            target_bot_id = None
            org_res = await db.execute(select(Org).limit(1))
            org_obj = org_res.scalar_one_or_none()
            if not org_obj:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No organization found in database. Please run seed script first."
                )
            org_id = org_obj.id

    if not conversation:
        title = body.message[:50] + "..." if len(body.message) > 50 else body.message
        conversation = Conversation(
            id=uuid.uuid4(),
            org_id=org_id,
            bot_id=target_bot_id,
            status="open",
            title=title
        )
        db.add(conversation)
        await db.flush()

    # Save incoming user message
    user_msg = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        org_id=conversation.org_id,
        role="user",
        content=body.message
    )
    db.add(user_msg)
    await db.flush()
    await db.commit()

    # Push to Redis stream for worker
    await redis_client.xadd(
        "chat_jobs",
        {
            "conversation_id": str(conversation.id),
            "org_id": str(conversation.org_id),
            "bot_id": str(target_bot_id) if target_bot_id else "",
            "user_message": body.message
        }
    )

    return {
        "status": "accepted",
        "conversation_id": str(conversation.id),
        "bot_id": str(target_bot_id) if target_bot_id else None,
        "message_id": str(user_msg.id)
    }

@router.get("/conversations", status_code=status.HTTP_200_OK)
async def list_conversations(
    bot_id: Optional[uuid.UUID] = Query(None, description="Filter conversations by Bot ID"),
    db: AsyncSession = Depends(get_db)
):
    """Fetch conversations, optionally filtered by Bot."""
    org_result = await db.execute(select(Org).limit(1))
    org = org_result.scalar_one_or_none()
    if not org:
        return []

    stmt = select(Conversation).where(Conversation.org_id == org.id)
    if bot_id:
        stmt = stmt.where(Conversation.bot_id == bot_id)

    stmt = stmt.order_by(Conversation.created_at.desc())
    result = await db.execute(stmt)
    conversations = result.scalars().all()
    
    return [
        {
            "id": str(c.id),
            "bot_id": str(c.bot_id) if c.bot_id else None,
            "status": c.status, 
            "title": c.title or "New Conversation",
            "created_at": c.created_at
        } for c in conversations
    ]

@router.get("/conversations/{conversation_id}/messages", status_code=status.HTTP_200_OK)
async def get_messages(conversation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
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
async def chat_stream(conversation_id: uuid.UUID, request: Request):
    """Server-Sent Events (SSE) stream subscribed to Redis Pub/Sub."""
    async def event_generator():
        pubsub = redis_client.pubsub()
        channel_name = f"chat_{conversation_id}"
        await pubsub.subscribe(channel_name)
        
        try:
            yield "data: connected\n\n"
            async for message in pubsub.listen():
                if await request.is_disconnected():
                    break
                if message["type"] == "message":
                    data = message["data"]
                    if data == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")