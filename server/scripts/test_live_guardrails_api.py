import httpx
import json

def test_api():
    base_url = "http://localhost:8000/api/v1"
    
    # 1. Login
    login_res = httpx.post(f"{base_url}/auth/login", data={"username": "admin@example.com", "password": "admin"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Authenticated successfully.")

    # 2. List guardrails
    list_res = httpx.get(f"{base_url}/guardrails/", headers=headers, follow_redirects=True)
    print(f"Status code: {list_res.status_code}")
    assert list_res.status_code == 200, f"List failed: {list_res.text}"
    guardrails = list_res.json()
    print(f"2. Retrieved {len(guardrails)} guardrail policies from library:")
    for g in guardrails:
        print(f"   - [{g['guardrail_type']}] {g['display_name']} ({g['stage']})")

    # 3. Test inline guardrail evaluation via /guardrails/test
    test_payload = {
        "test_message": "Hello, my secret credit card is 4532 1234 5678 9010",
        "guardrail": {
            "name": "inline_pii",
            "display_name": "Inline PII",
            "guardrail_type": "pii",
            "stage": "ingress",
            "config": {"block_credit_cards": True, "block_ssn": True},
            "action_on_violation": "block_and_respond",
            "refusal_message": "Credit card blocked"
        }
    }
    test_res = httpx.post(f"{base_url}/guardrails/test", json=test_payload, headers=headers)
    assert test_res.status_code == 200, f"Test failed: {test_res.text}"
    verdict = test_res.json()
    print(f"3. Live Sandbox Test Verdict: passed={verdict['passed']}, action={verdict['suggested_action']}, response={verdict['rendered_response']}")
    assert verdict["passed"] is False

    print("\nALL LIVE REST API TESTS PASSED!")

if __name__ == "__main__":
    test_api()
