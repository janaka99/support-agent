import time
from locust import HttpUser, task, between

class ChatUser(HttpUser):
    # Wait between 1 to 5 seconds between tasks
    wait_time = between(1, 5)

    @task
    def chat_scenario(self):
        # 1. Send the chat message
        payload = {
            "message": "Hello! Please tell me a very short joke."
        }
        
        # Start a custom timer for the whole flow
        start_time = time.time()
        
        with self.client.post("/api/v1/chat", json=payload, catch_response=True) as post_response:
            if post_response.status_code != 200:
                post_response.failure(f"Failed to post chat: {post_response.status_code}")
                return
            
            data = post_response.json()
            conversation_id = data.get("conversation_id")
            
            if not conversation_id:
                post_response.failure("No conversation_id returned")
                return
            
            post_response.success()

        # 2. Read the SSE stream
        stream_url = f"/api/v1/chat/{conversation_id}"
        
        # We use stream=True so we can process chunks as they arrive.
        # We also add timeout=30 so it fails if the workers are too slow (just like k6 did)
        with self.client.get(stream_url, stream=True, catch_response=True, timeout=30) as stream_response:
            if stream_response.status_code != 200:
                stream_response.failure(f"Failed to connect to stream: {stream_response.status_code}")
                return

            try:
                completed = False
                for line in stream_response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        if "[DONE]" in decoded_line:
                            completed = True
                            break
                
                if completed:
                    stream_response.success()
                else:
                    stream_response.failure("Stream ended without [DONE]")
            except Exception as e:
                stream_response.failure(f"Stream timeout/error: {type(e).__name__}")
