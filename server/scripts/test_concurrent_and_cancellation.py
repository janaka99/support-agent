"""
Automated Verification Suite: High-Concurrency Document Processing, Cancellation & Idempotent Vector Chunking
Tests:
1. Concurrent multi-document processing.
2. Mid-process cancellation handling with zero orphan/duplicate chunks.
3. Safe retries and idempotency (0 duplicate chunks).
"""
import asyncio
import uuid
import sys
import os
from sqlalchemy import select, func, delete

# Setup path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import async_session_maker
from app.core.redis import redis_client
from app.db.models import Org, KnowledgeBase, KnowledgeDocument, DocumentChunk
from app.worker.tasks import process_document_job


async def run_tests():
    print("=" * 70)
    print("STARTING TEST SUITE: CONCURRENCY, CANCELLATION & IDEMPOTENCY")
    print("=" * 70)

    async with async_session_maker() as db:
        # Get or create test org
        org_res = await db.execute(select(Org).limit(1))
        org = org_res.scalar_one_or_none()
        if not org:
            org = Org(id=uuid.uuid4(), name="Test Org Concurrency")
            db.add(org)
            await db.commit()
            await db.refresh(org)

        # Create test Knowledge Base
        kb = KnowledgeBase(
            id=uuid.uuid4(),
            org_id=org.id,
            name="Concurrency & Reliability Test KB",
            description="Testing concurrent queueing and mid-stream cancellation handling.",
            chunk_size=300,
            chunk_overlap=30,
            embedding_model="text-embedding-3-small"
        )
        db.add(kb)
        await db.commit()
        await db.refresh(kb)
        print(f"[Setup] Created Knowledge Base '{kb.name}' ({kb.id})")

    try:
        # -------------------------------------------------------------
        # TEST 1: Concurrency (Process 5 documents in parallel)
        # -------------------------------------------------------------
        print("\n--- TEST 1: Concurrent Multi-Document Processing ---")
        num_docs = 5
        doc_ids = []

        async with async_session_maker() as db:
            for i in range(num_docs):
                doc = KnowledgeDocument(
                    id=uuid.uuid4(),
                    kb_id=kb.id,
                    org_id=org.id,
                    title=f"Concurrent Policy Document #{i+1}",
                    source_type="raw_text",
                    raw_content=f"Policy #{i+1}: Every customer order is subject to standard processing terms. Delivery occurs within {i+2} business days. Cancellations are accepted within 24 hours of purchase.",
                    status="pending",
                    processing_progress=0
                )
                db.add(doc)
                doc_ids.append(doc.id)
            await db.commit()

        print(f"[Test 1] Spawned {num_docs} documents with status='pending'. Running worker tasks concurrently...")
        tasks = [
            process_document_job(
                job_id=f"job-concurrent-{i}",
                data={
                    "doc_id": str(d_id),
                    "kb_id": str(kb.id),
                    "org_id": str(org.id),
                    "title": f"Concurrent Policy Document #{i+1}"
                },
                worker_name=f"worker-{i}"
            )
            for i, d_id in enumerate(doc_ids)
        ]
        await asyncio.gather(*tasks)

        # Verify all 5 documents are 'ready' with chunks
        async with async_session_maker() as db:
            for d_id in doc_ids:
                res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == d_id))
                doc = res.scalar_one()
                assert doc.status == "ready", f"Document {d_id} expected 'ready', got '{doc.status}'"
                assert doc.chunk_count > 0, f"Document {d_id} has 0 chunks"
                assert doc.processing_progress == 100, f"Document {d_id} progress expected 100, got {doc.processing_progress}"
                
                chunk_res = await db.execute(select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == d_id))
                chunk_count = chunk_res.scalar()
                assert chunk_count == doc.chunk_count, f"DB chunk count {chunk_count} mismatch with doc.chunk_count {doc.chunk_count}"
        
        print(f"PASSED: All {num_docs} concurrent documents processed to 'ready' with accurate vector chunks!")

        # -------------------------------------------------------------
        # TEST 2: Mid-Process / Pre-Process Cancellation
        # -------------------------------------------------------------
        print("\n--- TEST 2: Cancellation Handling ---")
        async with async_session_maker() as db:
            cancel_doc = KnowledgeDocument(
                id=uuid.uuid4(),
                kb_id=kb.id,
                org_id=org.id,
                title="Cancelled Policy Document",
                source_type="raw_text",
                raw_content="This document will be cancelled before or during vector generation.",
                status="pending",
                processing_progress=0
            )
            db.add(cancel_doc)
            await db.commit()

        # Set cancellation flag in Redis
        cancel_key = f"cancel_doc:{cancel_doc.id}"
        await redis_client.set(cancel_key, "1", ex=300)
        print(f"[Test 2] Set Redis cancellation key '{cancel_key}'. Executing worker task...")

        await process_document_job(
            job_id="job-cancel-test",
            data={
                "doc_id": str(cancel_doc.id),
                "kb_id": str(kb.id),
                "org_id": str(org.id),
                "title": cancel_doc.title
            },
            worker_name="worker-cancel"
        )

        async with async_session_maker() as db:
            res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == cancel_doc.id))
            doc = res.scalar_one()
            assert doc.status == "cancelled", f"Expected status 'cancelled', got '{doc.status}'"
            
            chunk_res = await db.execute(select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == cancel_doc.id))
            chunk_count = chunk_res.scalar()
            assert chunk_count == 0, f"Expected 0 chunks for cancelled document, got {chunk_count}"

        print("PASSED: Cancelled document cleanly transitioned to 'cancelled' with 0 orphan chunks!")

        # -------------------------------------------------------------
        # TEST 3: Retry & Idempotency (0 duplicate chunks)
        # -------------------------------------------------------------
        print("\n--- TEST 3: Safe Retry & Duplicate Prevention ---")
        # Clear cancel flag and trigger retry
        await redis_client.delete(cancel_key)
        async with async_session_maker() as db:
            res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == cancel_doc.id))
            doc = res.scalar_one()
            doc.status = "pending"
            doc.error_message = None
            doc.processing_progress = 0
            await db.commit()

        print("[Test 3] Retrying indexing on cancelled document...")
        await process_document_job(
            job_id="job-retry-test-1",
            data={
                "doc_id": str(cancel_doc.id),
                "kb_id": str(kb.id),
                "org_id": str(org.id),
                "title": cancel_doc.title
            },
            worker_name="worker-retry"
        )

        # Run a second time immediately to test idempotency (e.g. worker re-attempting same job)
        print("[Test 3] Re-running same job a second time to verify complete duplicate prevention...")
        await process_document_job(
            job_id="job-retry-test-2",
            data={
                "doc_id": str(cancel_doc.id),
                "kb_id": str(kb.id),
                "org_id": str(org.id),
                "title": cancel_doc.title
            },
            worker_name="worker-retry"
        )

        async with async_session_maker() as db:
            res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == cancel_doc.id))
            doc = res.scalar_one()
            assert doc.status == "ready", f"Expected status 'ready' after retry, got '{doc.status}'"
            
            chunk_res = await db.execute(select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == cancel_doc.id))
            chunk_count = chunk_res.scalar()
            assert chunk_count == doc.chunk_count, f"Expected {doc.chunk_count} chunks, got {chunk_count} (duplication detected if higher!)"

        print(f"PASSED: Retried document successfully indexed to 'ready' with {chunk_count} chunks and 0 duplicates after duplicate run!")

        print("\n" + "=" * 70)
        print("ALL CONCURRENCY, CANCELLATION & IDEMPOTENCY TESTS PASSED SUCCESSFULLY!")
        print("=" * 70)

    finally:
        # Cleanup
        async with async_session_maker() as db:
            res = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb.id))
            kb_obj = res.scalar_one_or_none()
            if kb_obj:
                await db.delete(kb_obj)
                await db.commit()
        print("\n[Cleanup] Test Knowledge Base and all documents cascade-purged.")


if __name__ == "__main__":
    asyncio.run(run_tests())
