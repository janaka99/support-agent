import asyncio
import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    print("Health check response:", response.status_code, response.json())
    assert response.status_code == 200

def test_chat_structure():
    # Verify endpoint exists and validates request body
    response = client.post("/api/v1/chat", json={})
    print("Empty payload response status (expected 422):", response.status_code)
    assert response.status_code == 422

if __name__ == "__main__":
    test_health()
    test_chat_structure()
    print("All route integration tests passed!")
