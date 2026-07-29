import asyncio
import os
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from pgvector.sqlalchemy import Vector
from langchain_openai import OpenAIEmbeddings

from app.core.config import settings
from app.db.models import Document, Agent

async def test_pgvector():
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient() as client:
        # 1. Login
        print("1. Logging in...")
        resp = await client.post(
            f"{base_url}/auth/login",
            data={"username": "admin@system.com", "password": "adminpassword"}
        )
        if resp.status_code != 200:
            # Let's try admin@acme.com if system admin fails
            resp = await client.post(
                f"{base_url}/auth/login",
                data={"username": "admin@acme.com", "password": "admin"}
            )
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create Agent
        print("2. Creating test agent...")
        agent_data = {
            "name": "Refund Agent",
            "specialization": "handling refund policies",
            "system_prompt": "You handle refunds.",
            "tools": ["get_order_status"]
        }
        resp = await client.post(f"{base_url}/agents/", json=agent_data, headers=headers)
        
        # If it already exists, let's just fetch all agents and pick one
        if resp.status_code != 201:
            resp = await client.get(f"{base_url}/agents/", headers=headers)
            agent_id = resp.json()[0]["id"]
        else:
            agent_id = resp.json()["id"]
        print(f"Using agent ID: {agent_id}")
            
        # 3. Upload Document
        print("3. Uploading document...")
        faq_text = (
            "Refund Policy FAQ:\n"
            "Q: How long do refunds take?\n"
            "A: Refunds typically take 5-7 business days to process and appear on your statement.\n\n"
            "Q: Can I get a refund in cash?\n"
            "A: No, refunds are only issued to the original payment method."
        )
        resp = await client.post(
            f"{base_url}/agents/{agent_id}/documents",
            json={"content": faq_text},
            headers=headers,
            timeout=30.0
        )
        print("Upload Response:", resp.status_code, resp.json())
        
        # 4. Perform direct DB similarity search
        print("4. Testing similarity search in DB...")
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY)
        query_embedding = await embeddings_model.aembed_query("When will I get my refund?")
        
        engine = create_async_engine(settings.async_database_url)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        
        async with async_session() as session:
            # We use L2 distance (<->) or Cosine distance (<=>). pgvector supports both.
            # Using <=> for cosine distance.
            stmt = select(Document).order_by(Document.embedding.cosine_distance(query_embedding)).limit(1)
            result = await session.execute(stmt)
            best_doc = result.scalar_one_or_none()
            
            if best_doc:
                print("--- BEST MATCH FOUND ---")
                print(best_doc.content)
                print("------------------------")
            else:
                print("No documents found in DB!")

if __name__ == "__main__":
    asyncio.run(test_pgvector())
