import asyncio
import uuid

from app.core.redis import redis_client
from app.worker.tasks import process_chat_job

STREAM_KEY = "chat_jobs"
GROUP_NAME = "chat_workers"
# Generate a unique name for this specific worker instance
WORKER_NAME = f"worker-{uuid.uuid4().hex[:6]}"

async def run_worker():
    print(f"[{WORKER_NAME}] Starting worker...")
    
    # Ensure the consumer group exists
    try:
        await redis_client.xgroup_create(name=STREAM_KEY, groupname=GROUP_NAME, id="0", mkstream=True)
    except Exception:
        # Usually it means the group already exists, which is fine
        pass

    # Before listening for new jobs, check for any unacknowledged jobs from CRASHED workers
    # XAUTOCLAIM claims jobs that have been idle for more than 10 seconds (10000 ms)
    try:
        # returns: (next_start_id, messages, deleted_message_ids)
        claim_result = await redis_client.xautoclaim(
            name=STREAM_KEY,
            groupname=GROUP_NAME,
            consumername=WORKER_NAME,
            min_idle_time=10000, 
            start_id="0-0",
            count=100
        )
        if claim_result and len(claim_result) >= 2:
            messages = claim_result[1]
            if messages:
                print(f"[{WORKER_NAME}] Found {len(messages)} pending jobs from crashed workers, resuming...")
                for job_id, data in messages:
                    print(f"[{WORKER_NAME}] Resuming pending job {job_id}")
                    await process_chat_job(job_id, data, WORKER_NAME)
                    await redis_client.xack(STREAM_KEY, GROUP_NAME, job_id)
    except Exception as e:
        print(f"[{WORKER_NAME}] Error checking pending jobs: {e}")

    print(f"[{WORKER_NAME}] Listening for jobs on '{STREAM_KEY}'...")

    while True:
        try:
            # Block and wait for new jobs using XREADGROUP
            # count=1 means take 1 job at a time
            # ">" means "give me jobs that have never been delivered to any consumer in this group"
            stream_entries = await redis_client.xreadgroup(
                groupname=GROUP_NAME,
                consumername=WORKER_NAME,
                streams={STREAM_KEY: ">"},
                count=1,
                block=5000  # wait up to 5 seconds
            )
            
            if not stream_entries:
                continue

            for stream, messages in stream_entries:
                for job_id, data in messages:
                    # Process the job
                    await process_chat_job(job_id, data, WORKER_NAME)
                    # Acknowledge the job so it isn't processed again
                    await redis_client.xack(STREAM_KEY, GROUP_NAME, job_id)
                    
        except Exception as e:
            if "Timeout reading from" in str(e):
                continue
            print(f"[{WORKER_NAME}] Loop error: {e}")
            await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(run_worker())
