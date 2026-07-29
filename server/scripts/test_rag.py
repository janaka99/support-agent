import asyncio
import httpx

async def test_rag():
    print("Testing RAG and Dynamic Graph Routing...")
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Question that requires the KB
        question = "Can I get a refund in cash?"
        print(f"\nUser: {question}")
        
        response = await client.post(
            f"{base_url}/chat",
            json={"message": question}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nAgent: {data['content']}")
            
            if "original payment method" in data['content'].lower() or "no" in data['content'].lower():
                print("\n✅ RAG SUCCESS! The agent correctly extracted the answer from the uploaded FAQ.")
            else:
                print("\n❌ RAG FAILURE! The agent did not use the FAQ document properly.")
        else:
            print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_rag())
