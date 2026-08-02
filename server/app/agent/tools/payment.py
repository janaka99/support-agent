import json
import uuid
from langchain_core.tools import tool
from typing import Dict, Any
from app.core.redis import redis_client
from .orders import ORDERS_DATABASE

# Realistic database of mock customer transactions
PAYMENTS_DATABASE: Dict[str, Dict[str, Any]] = {
    "ch_1042": {
        "charge_id": "ch_1042",
        "order_id": "1042",
        "status": "succeeded",
        "amount": 170.64,
        "currency": "USD",
        "payment_method": "Visa ending in 4242",
        "captured_at": "2026-08-18T14:22:10Z",
        "decline_code": None,
        "decline_message": None,
        "receipt_url": "https://pay.example.com/receipts/ch_1042"
    },
    "ch_2089": {
        "charge_id": "ch_2089",
        "order_id": "2089",
        "status": "succeeded",
        "amount": 268.92,
        "currency": "USD",
        "payment_method": "Visa ending in 4242",
        "captured_at": "2026-08-10T09:15:30Z",
        "decline_code": None,
        "decline_message": None,
        "receipt_url": "https://pay.example.com/receipts/ch_2089"
    },
    "ch_789": {
        "charge_id": "ch_789",
        "order_id": "pending_retry",
        "status": "failed",
        "amount": 170.64,
        "currency": "USD",
        "payment_method": "Mastercard ending in 1122",
        "captured_at": "2026-08-19T18:44:02Z",
        "decline_code": "insufficient_funds",
        "decline_message": "The issuing bank reported insufficient funds to complete the transaction (Code 51).",
        "receipt_url": None
    },
    "ch_3301": {
        "charge_id": "ch_3301",
        "order_id": "3301",
        "status": "succeeded",
        "amount": 172.69,
        "currency": "USD",
        "payment_method": "Amex ending in 8890",
        "captured_at": "2026-08-20T11:05:12Z",
        "decline_code": None,
        "decline_message": None,
        "receipt_url": "https://pay.example.com/receipts/ch_3301"
    }
}


@tool
async def check_payment_status(payment_id: str) -> dict:
    """
    Look up the payment status, charge outcome, decline reason, or receipt for a payment ID or associated order ID.
    """
    clean_id = str(payment_id).replace("#", "").strip()
    if not clean_id.startswith("ch_") and clean_id in ["1042", "2089", "789", "3301"]:
        clean_id = f"ch_{clean_id}"
        
    payment = PAYMENTS_DATABASE.get(clean_id)
    
    if not payment:
        # Check by order_id lookup
        for ch in PAYMENTS_DATABASE.values():
            if ch.get("order_id") == str(payment_id).replace("#", "").strip():
                payment = ch
                break
                
    if not payment:
        return {
            "found": False,
            "payment_id": payment_id,
            "error": f"No payment transaction found matching identifier '{payment_id}'."
        }
        
    return {
        "found": True,
        "charge_id": payment["charge_id"],
        "order_id": payment["order_id"],
        "status": payment["status"],
        "amount": f"${payment['amount']:.2f} {payment['currency']}",
        "payment_method": payment["payment_method"],
        "captured_at": payment["captured_at"],
        "decline_code": payment["decline_code"],
        "decline_message": payment["decline_message"],
        "receipt_url": payment["receipt_url"]
    }


@tool
async def process_refund(order_id: str, reason: str = "Customer return request", idempotency_key: str = None) -> dict:
    """
    Process a refund for a given order ID. An idempotency key is generated or used to prevent duplicate refunds.
    """
    clean_id = str(order_id).replace("#", "").strip()
    
    # Generate idempotency key if not provided
    if not idempotency_key:
        idempotency_key = f"auto_ref_{clean_id}"
        
    cache_key = f"refund_idempotency:{idempotency_key}"
    
    # Check if this refund operation was already processed
    cached_result = await redis_client.get(cache_key)
    if cached_result:
        result = json.loads(cached_result)
        result["note"] = "Idempotent response: this refund was already submitted."
        return result
        
    # Lookup order total if available
    order = ORDERS_DATABASE.get(clean_id)
    refund_amount = order["total"] if order else 42.00
    
    refund_id = f"ref_{uuid.uuid4().hex[:10]}"
    
    result = {
        "refund_id": refund_id,
        "order_id": clean_id,
        "status": "refund_approved",
        "amount_refunded": f"${refund_amount:.2f} USD",
        "reason": reason,
        "payout_timeline": "5-10 business days depending on customer's financial institution",
        "idempotency_key": idempotency_key
    }
    
    # Cache the result with a 24-hour expiration in Redis
    await redis_client.set(cache_key, json.dumps(result), ex=86400)
    
    return result