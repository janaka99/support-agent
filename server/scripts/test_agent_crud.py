import requests

base_url = "http://localhost:8000/api/v1"

def test_crud():
    print("1. Logging in...")
    resp = requests.post(
        f"{base_url}/auth/login",
        data={"username": "admin@acme.com", "password": "admin"}
    )
    if resp.status_code != 200:
        print("Failed to login", resp.text)
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("2. Listing agents...")
    resp = requests.get(f"{base_url}/agents/", headers=headers)
    print("List:", resp.json())
    
    print("3. Creating a new agent...")
    agent_data = {
        "name": "test_agent",
        "specialization": "testing things",
        "system_prompt": "You are a test agent.",
        "tools": ["get_order_status"]
    }
    resp = requests.post(f"{base_url}/agents/", json=agent_data, headers=headers)
    if resp.status_code != 201:
        print("Failed to create", resp.text)
        return
    new_agent = resp.json()
    print("Created:", new_agent)
    agent_id = new_agent["id"]
    
    print("4. Testing invalid tools validation...")
    invalid_agent_data = agent_data.copy()
    invalid_agent_data["tools"] = ["invalid_tool"]
    resp = requests.post(f"{base_url}/agents/", json=invalid_agent_data, headers=headers)
    print("Invalid Tool Response:", resp.status_code, resp.json())
    
    print("5. Updating the agent...")
    update_data = {"name": "updated_test_agent"}
    resp = requests.put(f"{base_url}/agents/{agent_id}", json=update_data, headers=headers)
    print("Updated:", resp.json())
    
    print("6. Deleting the agent...")
    resp = requests.delete(f"{base_url}/agents/{agent_id}", headers=headers)
    print("Delete Status:", resp.status_code)

if __name__ == "__main__":
    test_crud()
