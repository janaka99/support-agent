import asyncio
import uuid
import logging

from app.core.redis import redis_client
from app.worker.tasks import process_chat_job, process_document_job

logger = logging.getLogger(__name__)

CHAT_STREAM_KEY = "chat_jobs"
CHAT_GROUP_NAME = "chat_workers"

DOC_STREAM_KEY = "document_jobs"
DOC_GROUP_NAME = "document_workers"

WORKER_NAME = f"worker-{uuid.uuid4().hex[:6]}"


async def init_stream_group(stream_key: str, group_name: str):
    """Ensure stream consumer group exists."""
    try:
        await redis_client.xgroup_create(name=stream_key, groupname=group_name, id="0", mkstream=True)
    except Exception:
        # Consumer group already exists
        pass


async def claim_stale_jobs(stream_key: str, group_name: str, handler_fn):
    """Claim and resume jobs from crashed worker instances."""
    try:
        claim_result = await redis_client.xautoclaim(
            name=stream_key,
            groupname=group_name,
            consumername=WORKER_NAME,
            min_idle_time=10000, # 10 seconds idle
            start_id="0-0",
            count=100
        )
        if claim_result and len(claim_result) >= 2:
            messages = claim_result[1]
            if messages:
                print(f"[{WORKER_NAME}] Resuming {len(messages)} pending jobs on '{stream_key}' from crashed workers...")
                for job_id, data in messages:
                    await handler_fn(job_id, data, WORKER_NAME)
                    await redis_client.xack(stream_key, group_name, job_id)
    except Exception as e:
        print(f"[{WORKER_NAME}] Error claiming stale jobs on '{stream_key}': {e}")


async def run_chat_worker_loop():
    """Worker loop for chat agent jobs."""
    await init_stream_group(CHAT_STREAM_KEY, CHAT_GROUP_NAME)
    await claim_stale_jobs(CHAT_STREAM_KEY, CHAT_GROUP_NAME, process_chat_job)
    print(f"[{WORKER_NAME}] Listening for chat jobs on '{CHAT_STREAM_KEY}'...")

    while True:
        try:
            entries = await redis_client.xreadgroup(
                groupname=CHAT_GROUP_NAME,
                consumername=WORKER_NAME,
                streams={CHAT_STREAM_KEY: ">"},
                count=1,
                block=3000
            )
            if not entries:
                continue

            for stream, messages in entries:
                for job_id, data in messages:
                    await process_chat_job(job_id, data, WORKER_NAME)
                    await redis_client.xack(CHAT_STREAM_KEY, CHAT_GROUP_NAME, job_id)

        except Exception as e:
            if "Timeout reading from" not in str(e):
                print(f"[{WORKER_NAME}] Chat loop error: {e}")
            await asyncio.sleep(1)


async def run_doc_worker_loop():
    """Worker loop for document indexing, chunking & embedding jobs."""
    await init_stream_group(DOC_STREAM_KEY, DOC_GROUP_NAME)
    await claim_stale_jobs(DOC_STREAM_KEY, DOC_GROUP_NAME, process_document_job)
    print(f"[{WORKER_NAME}] Listening for document jobs on '{DOC_STREAM_KEY}'...")

    while True:
        try:
            entries = await redis_client.xreadgroup(
                groupname=DOC_GROUP_NAME,
                consumername=WORKER_NAME,
                streams={DOC_STREAM_KEY: ">"},
                count=1,
                block=3000
            )
            if not entries:
                continue

            for stream, messages in entries:
                for job_id, data in messages:
                    await process_document_job(job_id, data, WORKER_NAME)
                    await redis_client.xack(DOC_STREAM_KEY, DOC_GROUP_NAME, job_id)

        except Exception as e:
            if "Timeout reading from" not in str(e):
                print(f"[{WORKER_NAME}] Document loop error: {e}")
            await asyncio.sleep(1)


async def run_worker():
    print(f"[{WORKER_NAME}] Starting unified multi-queue worker...")
    await asyncio.gather(
        run_chat_worker_loop(),
        run_doc_worker_loop()
    )


if __name__ == "__main__":
    asyncio.run(run_worker())
