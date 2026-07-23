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


    
    