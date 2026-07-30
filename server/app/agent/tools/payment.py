from langchain_core.tools import tool


@tool
async def check_payment_status(payment_id: str) -> dict:
    """
    Get payment status by payment ID
    """
    return {
        "payment_id": payment_id,
        "status": "failed",
        "reason": "Insufficient funds",
        "date": "2026-07-20"
    }

import json
from app.core.redis import redis_client

@tool
async def process_refund(order_id: str, idempotency_key: str) -> dict:
    """
    Process a refund for a given order ID.
    An idempotency key is required to prevent double refunds.
    """
    cache_key = f"refund_idempotency:{idempotency_key}"
    
    # Check if this operation was already processed
    cached_result = await redis_client.get(cache_key)
    if cached_result:
        return json.loads(cached_result)
        
    # Simulate processing the refund
    result = {
        "order_id": order_id,
        "status": "refunded",
        "amount": 42.00,
        "idempotency_key": idempotency_key
    }
    
    # Cache the result with a 24-hour expiration
    await redis_client.set(cache_key, json.dumps(result), ex=86400)
    
    return result