import asyncio
import os
import uuid
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("../.env")

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, func, text

from app.core.config import settings
from app.db.models import Org, User, KnowledgeBase, KnowledgeDocument, DocumentChunk, Tool
from app.services.document_parser import chunk_text, generate_embeddings_batch, generate_single_embedding
from app.agent.tools.dynamic import create_langchain_tool


async def run_kb_lifecycle_test():
    print("🚀 Starting Knowledge Base & Document Lifecycle Test...")
    engine = create_async_engine(settings.async_database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as session:
        # 1. Fetch or create a test Org & User
        org_res = await session.execute(select(Org).limit(1))
        org = org_res.scalar_one_or_none()
        if not org:
            org = Org(id=uuid.uuid4(), name="Test KB Org")
            session.add(org)
            await session.commit()
            print(f"Created Org: {org.id}")

        org_id = org.id

        # Enable RLS context in session
        await session.execute(text(f"SET LOCAL app.current_org = '{org_id}';"))

        # 2. Create Knowledge Base
        kb = KnowledgeBase(
            id=uuid.uuid4(),
            org_id=org_id,
            name="Policy Knowledge Base",
            description="Company return and warranty policies",
            embedding_model="text-embedding-3-small",
            chunk_size=300,
            chunk_overlap=30,
        )
        session.add(kb)
        await session.commit()
        print(f"✅ Created Knowledge Base: {kb.name} (id: {kb.id})")

        # 3. Add Document v1
        v1_text = (
            "Return Policy Version 1 (2024):\n"
            "Customers may return eligible items within 14 days of purchase date.\n"
            "Open-box electronics are subject to a 10% restocking fee.\n"
            "Shipping fees are non-refundable."
        )
        v1_doc = KnowledgeDocument(
            id=uuid.uuid4(),
            kb_id=kb.id,
            org_id=org_id,
            title="Return_Policy_v1.txt",
            source_type="raw_text",
            file_size_bytes=len(v1_text),
            status="indexing"
        )
        session.add(v1_doc)
        await session.flush()

        v1_chunks = chunk_text(v1_text, chunk_size=kb.chunk_size, chunk_overlap=kb.chunk_overlap)
        print(f"Generated {len(v1_chunks)} chunks for v1 document.")
        v1_embeddings = await generate_embeddings_batch([c["content"] for c in v1_chunks], model_name=kb.embedding_model)

        for chunk_data, emb in zip(v1_chunks, v1_embeddings):
            chunk_rec = DocumentChunk(
                id=uuid.uuid4(),
                document_id=v1_doc.id,
                kb_id=kb.id,
                org_id=org_id,
                content=chunk_data["content"],
                chunk_index=chunk_data["chunk_index"],
                embedding=emb,
                chunk_metadata={"doc_title": v1_doc.title}
            )
            session.add(chunk_rec)

        v1_doc.chunk_count = len(v1_chunks)
        v1_doc.status = "ready"
        await session.commit()
        print(f"✅ Indexed Document v1 (id: {v1_doc.id}, chunks: {v1_doc.chunk_count})")

        # 4. Search against v1
        query = "What is the return window and restocking fee?"
        q_emb = await generate_single_embedding(query, model_name=kb.embedding_model)
        
        cosine_dist = DocumentChunk.embedding.cosine_distance(q_emb)
        stmt = (
            select(DocumentChunk, KnowledgeDocument.title, cosine_dist)
            .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
            .where(DocumentChunk.kb_id == kb.id)
            .order_by(cosine_dist.asc())
            .limit(2)
        )
        res = await session.execute(stmt)
        top_matches = res.all()
        print(f"\n🔍 Search Query: '{query}'")
        for chunk_obj, title, dist in top_matches:
            sim = 1.0 - float(dist)
            print(f"   Match from [{title}] (Similarity: {sim:.2%}): {chunk_obj.content[:80]}...")
            assert "14 days" in chunk_obj.content

        # 5. Delete Document v1 (Simulating policy replacement)
        print(f"\n🗑️ Deleting Document v1 ({v1_doc.id}) to replace with v2...")
        await session.delete(v1_doc)
        await session.commit()

        # Verify chunks are 0 in DB
        chunk_count_check = await session.execute(
            select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == v1_doc.id)
        )
        remaining_chunks = chunk_count_check.scalar()
        print(f"✅ Verified cascade deletion: remaining chunks for v1 = {remaining_chunks}")
        assert remaining_chunks == 0, "Error: Chunks were not cascade-deleted!"

        # 6. Add Document v2
        v2_text = (
            "Return Policy Version 2 (2026):\n"
            "Customers may return all eligible items within 30 days of delivery date.\n"
            "No restocking fees apply to open-box electronics.\n"
            "Return shipping is completely free for all members."
        )
        v2_doc = KnowledgeDocument(
            id=uuid.uuid4(),
            kb_id=kb.id,
            org_id=org_id,
            title="Return_Policy_v2.txt",
            source_type="raw_text",
            file_size_bytes=len(v2_text),
            status="indexing"
        )
        session.add(v2_doc)
        await session.flush()

        v2_chunks = chunk_text(v2_text, chunk_size=kb.chunk_size, chunk_overlap=kb.chunk_overlap)
        v2_embeddings = await generate_embeddings_batch([c["content"] for c in v2_chunks], model_name=kb.embedding_model)

        for chunk_data, emb in zip(v2_chunks, v2_embeddings):
            chunk_rec = DocumentChunk(
                id=uuid.uuid4(),
                document_id=v2_doc.id,
                kb_id=kb.id,
                org_id=org_id,
                content=chunk_data["content"],
                chunk_index=chunk_data["chunk_index"],
                embedding=emb,
                chunk_metadata={"doc_title": v2_doc.title}
            )
            session.add(chunk_rec)

        v2_doc.chunk_count = len(v2_chunks)
        v2_doc.status = "ready"
        await session.commit()
        print(f"✅ Indexed Document v2 (id: {v2_doc.id}, chunks: {v2_doc.chunk_count})")

        # 7. Search again - verify ONLY v2 matches with 30 days
        res_v2 = await session.execute(stmt)
        top_matches_v2 = res_v2.all()
        print(f"\n🔍 Search Query after v2 upgrade: '{query}'")
        for chunk_obj, title, dist in top_matches_v2:
            sim = 1.0 - float(dist)
            print(f"   Match from [{title}] (Similarity: {sim:.2%}): {chunk_obj.content[:80]}...")
            assert "30 days" in chunk_obj.content
            assert "14 days" not in chunk_obj.content

        # 8. Test Dynamic Tool Integration
        tool_model = Tool(
            id=uuid.uuid4(),
            org_id=org_id,
            name="search_return_policies",
            display_name="Search Return Policies",
            description="Search company policy knowledge base for return windows, restocking fees, and shipping details.",
            tool_type="rag_retriever",
            config={
                "kb_id": str(kb.id),
                "top_k": 3,
                "similarity_threshold": 0.0
            },
            parameters_schema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up in the policy knowledge base."
                    }
                },
                "required": ["query"]
            }
        )
        session.add(tool_model)
        await session.commit()
        print(f"\n🛠️ Created dynamic RAG Tool: {tool_model.name}")

        langchain_tool = create_langchain_tool(
            tool_model=tool_model,
            db=session,
            org_id=str(org_id)
        )

        tool_result = await langchain_tool.ainvoke({"query": "How many days do I have to return an item?"})
        print("🤖 Tool Execution Result:")
        print(f"   Knowledge Base: {tool_result.get('knowledge_base')}")
        print(f"   Results Count: {tool_result.get('results_count')}")
        for r in tool_result.get("results", []):
            print(f"   - Match [{r['document_title']}] (Score: {r['similarity_score']}): {r['content']}")

        assert tool_result.get("results_count", 0) > 0

        # Clean up test KB and Tool
        await session.delete(tool_model)
        await session.delete(kb)
        await session.commit()
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Knowledge Base & Tool-connected RAG is fully operational.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_kb_lifecycle_test())
