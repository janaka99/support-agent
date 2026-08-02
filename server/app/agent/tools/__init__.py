from .orders import get_order_status, get_order_history
from .payment import check_payment_status, process_refund
from .system import escalate_to_human

TOOL_REGISTRY = {
    "get_order_status": get_order_status,
    "get_order_history": get_order_history,
    "check_payment_status": check_payment_status,
    "process_refund": process_refund,
    "escalate_to_human": escalate_to_human,
}
