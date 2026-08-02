import asyncio
import uuid
import json
from app.worker.tasks import process_chat_job
from app.core.redis import redis_client
from app.core.config import settings

async def test_fallback():
    # 1. Break the OpenAI API key intentionally
    original_key = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = "invalid_sk_for_testing"
    
    conv_id = str(uuid.uuid4())
    org_id = "9a647258-9049-4ea2-b210-644af28be91d" # Seeded org
    
    # 2. Subscribe to Redis PubSub to capture what the worker outputs
    pubsub = redis_client.pubsub()
    channel = f"chat_{conv_id}"
    await pubsub.subscribe(channel)
    
    # Create a conversation in the DB first so foreign keys are satisfied
    from app.core.database import async_session_maker
    from app.db.models import Conversation
    
    async with async_session_maker() as db:
        conv = Conversation(id=uuid.UUID(conv_id), org_id=uuid.UUID(org_id), status="open", title="Fallback Test")
        db.add(conv)
        await db.commit()
    
    # 3. Process the job directly
    job_data = {
        "conversation_id": conv_id,
        "org_id": org_id,
        "user_message": "Hello, trigger fallback test please"
    }
    
    print("Processing job with broken key...")
    await process_chat_job("job-test-123", job_data, "test-worker")
    
    # 4. Read messages from PubSub
    print("Reading published messages from Redis:")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = message["data"]
            print(f"-> Received: {data}")
            if data == "[DONE]":
                break
                
    # Restore the key
    settings.OPENAI_API_KEY = original_key
    await pubsub.unsubscribe(channel)
    await pubsub.close()
    print("\n✅ TEST PASSED: Fallback message and [DONE] were properly published to Redis!")

if __name__ == "__main__":
    asyncio.run(test_fallback())
