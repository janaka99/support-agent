from langchain_core.tools import tool 



@tool
async def get_order_status(order_id: str) -> dict:
    """
    Get order status by order ID
    """
    return {
        "status": "shipped",
        "estimated_delivery": "2026-12-29"
    }

@tool
async def get_order_history(user_id: str) -> list[dict]:
    """
    Get order history by user ID
    """
    return [
        {
            "order_id": "1",
            "status": "shipped",
            "estimated_delivery": "2026-12-29"
        },
        {
            "order_id": "2",
            "status": "delivered",
            "estimated_delivery": "2026-12-29"
        }
    ]
