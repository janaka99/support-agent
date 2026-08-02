from langchain_core.tools import tool
from typing import Dict, Any, List

# Realistic database of mock customer orders
ORDERS_DATABASE: Dict[str, Dict[str, Any]] = {
    "1042": {
        "order_id": "1042",
        "customer_id": "cust_9910",
        "status": "shipped",
        "carrier": "UPS",
        "tracking_number": "1Z9999999999999999",
        "tracking_url": "https://www.ups.com/track?tracknum=1Z9999999999999999",
        "shipped_date": "2026-08-18",
        "estimated_delivery": "2026-08-24",
        "items": [
            {"sku": "KEY-PRO-01", "name": "Ergonomic Mechanical Keyboard (Tactile Brown)", "quantity": 1, "price": 129.00},
            {"sku": "WRIST-REST-02", "name": "Memory Foam Ergonomic Wrist Rest", "quantity": 1, "price": 29.00}
        ],
        "shipping_address": "742 Evergreen Terrace, Springfield, OR 97477",
        "subtotal": 158.00,
        "tax": 12.64,
        "shipping_fee": 0.00,
        "total": 170.64,
        "payment_status": "paid",
        "is_returnable": True
    },
    "2089": {
        "order_id": "2089",
        "customer_id": "cust_9910",
        "status": "delivered",
        "carrier": "FedEx",
        "tracking_number": "781294819201",
        "tracking_url": "https://www.fedex.com/fedextrack/?trknbr=781294819201",
        "shipped_date": "2026-08-10",
        "delivered_date": "2026-08-14",
        "estimated_delivery": "2026-08-14",
        "items": [
            {"sku": "HEADPHONE-ANC-09", "name": "Pro Active Noise Cancelling Headphones", "quantity": 1, "price": 249.00}
        ],
        "shipping_address": "742 Evergreen Terrace, Springfield, OR 97477",
        "subtotal": 249.00,
        "tax": 19.92,
        "shipping_fee": 0.00,
        "total": 268.92,
        "payment_status": "paid",
        "is_returnable": True
    },
    "3301": {
        "order_id": "3301",
        "customer_id": "cust_4821",
        "status": "processing",
        "carrier": "DHL Express",
        "tracking_number": "Pending dispatch",
        "tracking_url": None,
        "shipped_date": None,
        "estimated_delivery": "2026-08-27",
        "items": [
            {"sku": "DOCK-USB4-03", "name": "Thunderbolt 4 / USB-C 12-in-1 Dual 4K Dock", "quantity": 1, "price": 149.50}
        ],
        "shipping_address": "100 Broadway, New York, NY 10005",
        "subtotal": 149.50,
        "tax": 13.20,
        "shipping_fee": 9.99,
        "total": 172.69,
        "payment_status": "paid",
        "is_returnable": False
    },
    "4412": {
        "order_id": "4412",
        "customer_id": "cust_9910",
        "status": "cancelled",
        "carrier": None,
        "tracking_number": None,
        "tracking_url": None,
        "shipped_date": None,
        "estimated_delivery": None,
        "items": [
            {"sku": "MOUSE-VERT-05", "name": "Vertical Wireless Gaming Mouse", "quantity": 1, "price": 69.99}
        ],
        "shipping_address": "742 Evergreen Terrace, Springfield, OR 97477",
        "subtotal": 69.99,
        "tax": 5.60,
        "shipping_fee": 0.00,
        "total": 75.59,
        "payment_status": "refunded",
        "is_returnable": False
    }
}


@tool
async def get_order_status(order_id: str) -> dict:
    """
    Look up the live fulfillment, carrier tracking number, delivery estimate, and line items for a given order ID.
    """
    clean_id = str(order_id).replace("#", "").strip()
    order = ORDERS_DATABASE.get(clean_id)
    
    if not order:
        return {
            "found": False,
            "order_id": order_id,
            "error": f"Order #{clean_id} was not found in our order management database. Please verify the order number."
        }
    
    return {
        "found": True,
        "order_id": order["order_id"],
        "status": order["status"],
        "carrier": order["carrier"],
        "tracking_number": order["tracking_number"],
        "tracking_url": order["tracking_url"],
        "estimated_delivery": order["estimated_delivery"],
        "delivered_date": order.get("delivered_date"),
        "items": order["items"],
        "total": order["total"],
        "is_returnable": order["is_returnable"]
    }


@tool
async def get_order_history(user_id: str = "cust_9910") -> list[dict]:
    """
    Retrieve all past orders and tracking summaries associated with a customer account.
    """
    clean_user = str(user_id).strip()
    
    matching_orders = [
        {
            "order_id": order["order_id"],
            "status": order["status"],
            "date": order.get("shipped_date") or "2026-08-12",
            "item_count": len(order["items"]),
            "items_summary": ", ".join([f"{item['quantity']}x {item['name']}" for item in order["items"]]),
            "total": order["total"],
            "carrier": order["carrier"]
        }
        for order in ORDERS_DATABASE.values()
        if order.get("customer_id") == clean_user or clean_user in ["cust_9910", "default", "me", "current_user"]
    ]
    
    return matching_orders
