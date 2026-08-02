import asyncio
import sys
import os

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent.tools.orders import get_order_status, get_order_history
from app.agent.tools.payment import check_payment_status, process_refund
from app.agent.tools.system import escalate_to_human


async def main():
    print("=== 1. Testing Order Status Lookups ===")
    
    # Test shipped order
    res_1042 = await get_order_status.ainvoke({"order_id": "1042"})
    print(f"Order #1042 -> Carrier: {res_1042.get('carrier')}, Status: {res_1042.get('status')}, Items: {len(res_1042.get('items', []))}")
    assert res_1042.get("carrier") == "UPS"
    assert res_1042.get("status") == "shipped"

    # Test delivered order
    res_2089 = await get_order_status.ainvoke({"order_id": "#2089"})
    print(f"Order #2089 -> Carrier: {res_2089.get('carrier')}, Status: {res_2089.get('status')}, Delivered: {res_2089.get('delivered_date')}")
    assert res_2089.get("status") == "delivered"

    # Test non-existent order
    res_9999 = await get_order_status.ainvoke({"order_id": "9999"})
    print(f"Order #9999 -> Found: {res_9999.get('found')}, Error: {res_9999.get('error')}")
    assert res_9999.get("found") is False

    print("\n=== 2. Testing Order History ===")
    history = await get_order_history.ainvoke({"user_id": "cust_9910"})
    print(f"Order history count: {len(history)}")
    assert len(history) >= 2

    print("\n=== 3. Testing Payment Status Lookups ===")
    pay_1042 = await check_payment_status.ainvoke({"payment_id": "ch_1042"})
    print(f"Payment ch_1042 -> Status: {pay_1042.get('status')}, Method: {pay_1042.get('payment_method')}, Amount: {pay_1042.get('amount')}")
    assert pay_1042.get("status") == "succeeded"

    pay_789 = await check_payment_status.ainvoke({"payment_id": "ch_789"})
    print(f"Payment ch_789 -> Status: {pay_789.get('status')}, Decline: {pay_789.get('decline_code')}, Message: {pay_789.get('decline_message')}")
    assert pay_789.get("status") == "failed"
    assert pay_789.get("decline_code") == "insufficient_funds"

    print("\n=== 4. Testing Dynamic Idempotent Refund ===")
    ref_1 = await process_refund.ainvoke({"order_id": "2089", "idempotency_key": "test_idemp_key_01"})
    print(f"Refund 1 -> ID: {ref_1.get('refund_id')}, Status: {ref_1.get('status')}, Amount: {ref_1.get('amount_refunded')}")
    assert ref_1.get("status") == "refund_approved"
    assert "$268.92" in ref_1.get("amount_refunded")

    # Repeat call with same idempotency key
    ref_2 = await process_refund.ainvoke({"order_id": "2089", "idempotency_key": "test_idemp_key_01"})
    print(f"Refund 2 (Idempotent) -> Note: {ref_2.get('note')}, ID matches: {ref_1.get('refund_id') == ref_2.get('refund_id')}")
    assert ref_1.get("refund_id") == ref_2.get("refund_id")

    print("\n✅ All realistic integration tests PASSED!")


if __name__ == "__main__":
    asyncio.run(main())
