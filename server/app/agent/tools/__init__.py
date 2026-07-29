from .orders import get_order_status, get_order_history
from .payment import check_payment_status

TOOL_REGISTRY = {
    "get_order_status": get_order_status,
    "get_order_history": get_order_history,
    "check_payment_status": check_payment_status
}
