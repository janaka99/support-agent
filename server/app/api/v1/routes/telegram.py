import uuid
import httpx
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.db.models import Org, Conversation, Message, Bot
from app.core.redis import redis_client
from app.core.config import settings

router = APIRouter()

@router.post("/webhook/{bot_id}", status_code=status.HTTP_200_OK)
async def telegram_webhook(
    bot_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    payload = await request.json()
    
    # Extract chat_id and text from Telegram's payload
    chat_id = None
    text = None
    
    if "message" in payload and "text" in payload["message"]:
        chat_id = str(payload["message"]["chat"]["id"])
        text = payload["message"]["text"]
    elif "callback_query" in payload:
        chat_id = str(payload["callback_query"]["message"]["chat"]["id"])
        text = payload["callback_query"]["data"]
        
        # Acknowledge the callback query to Telegram so the button stops loading
        bot_res = await db.execute(select(Bot).where(Bot.id == bot_id))
        bot_obj = bot_res.scalar_one_or_none()
        if bot_obj and bot_obj.telegram_bot_token:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{bot_obj.telegram_bot_token}/answerCallbackQuery",
                    json={"callback_query_id": payload["callback_query"]["id"]}
                )

    if not chat_id or not text:
        return {"status": "ignored"}

    # Validate Bot exists
    bot_res = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_obj = bot_res.scalar_one_or_none()
    if not bot_obj:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Find active Conversation by external_chat_id
    conv_res = await db.execute(
        select(Conversation)
        .where(
            Conversation.bot_id == bot_id,
            Conversation.external_chat_id == chat_id,
            Conversation.channel == "telegram"
        )
        .order_by(Conversation.created_at.desc())
        .limit(1)
    )
    conversation = conv_res.scalar_one_or_none()

    if not conversation:
        title = text[:50] + "..." if len(text) > 50 else text
        conversation = Conversation(
            id=uuid.uuid4(),
            org_id=bot_obj.org_id,
            bot_id=bot_id,
            status="open",
            title=title,
            channel="telegram",
            external_chat_id=chat_id
        )
        db.add(conversation)
        await db.flush()

    # Save user message
    user_msg = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        org_id=conversation.org_id,
        role="user",
        content=text
    )
    db.add(user_msg)
    await db.flush()
    await db.commit()

    # Push to worker queue
    await redis_client.xadd(
        "chat_jobs",
        {
            "conversation_id": str(conversation.id),
            "org_id": str(conversation.org_id),
            "bot_id": str(bot_id),
            "user_message": text
        }
    )

    return {"status": "ok"}


@router.post("/register/{bot_id}", status_code=status.HTTP_200_OK)
async def register_telegram_webhook(
    bot_id: uuid.UUID,
    request: Request,
    telegram_bot_token: str = Body(None, embed=True),
    db: AsyncSession = Depends(get_db)
):
    bot_res = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_obj = bot_res.scalar_one_or_none()
    
    if not bot_obj:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    if telegram_bot_token:
        bot_obj.telegram_bot_token = telegram_bot_token
        await db.commit()
        await db.refresh(bot_obj)
        
    if not bot_obj.telegram_bot_token:
        raise HTTPException(status_code=400, detail="Bot does not have a telegram token configured")

    # The webhook URL needs to be the public URL of this server
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("host", request.url.netloc)
    webhook_url = f"{scheme}://{host}/api/v1/telegram/webhook/{bot_id}"
    
    # Or override with settings if defined
    public_url = getattr(settings, "PUBLIC_API_URL", None)
    if public_url:
        webhook_url = f"{public_url.rstrip('/')}/api/v1/telegram/webhook/{bot_id}"
        
    if not webhook_url.startswith("https://"):
        if "localhost" in webhook_url or "127.0.0.1" in webhook_url:
            raise HTTPException(
                status_code=400, 
                detail="Telegram requires a public HTTPS URL. For local testing, please run 'ngrok http 8000' and set PUBLIC_API_URL=https://your-ngrok-url in your server/.env file, then restart the server."
            )
        else:
            webhook_url = webhook_url.replace("http://", "https://", 1)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{bot_obj.telegram_bot_token}/setWebhook",
            json={"url": webhook_url}
        )
        
        data = resp.json()
        if not data.get("ok"):
            raise HTTPException(status_code=500, detail=f"Failed to set webhook: {data}")
            
    return {"status": "success", "webhook_url": webhook_url}
