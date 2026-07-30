import time
import subprocess
import redis
import sys
import os

# Ensure we are running from the project root
if not os.path.exists("infra/docker-compose.yml"):
    print("Error: Please run this script from the project root (where the infra/ folder is).")
    sys.exit(1)

print("Connecting to Redis at localhost:6379...")
try:
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    r.ping()
except Exception as e:
    print(f"Error connecting to Redis: {e}")
    sys.exit(1)

# Configuration
STREAM_NAME = "chat_jobs"
CHECK_INTERVAL = 2  # seconds
SCALE_UP_THRESHOLD = 5  # If queue is longer than this, scale up
MIN_REPLICAS = 4
MAX_REPLICAS = 10

current_replicas = MIN_REPLICAS

print(f"🚀 Auto-scaler started! Monitoring Redis stream '{STREAM_NAME}'...", flush=True)
print(f"Base workers: {MIN_REPLICAS}, Max workers: {MAX_REPLICAS}, Threshold: {SCALE_UP_THRESHOLD} pending jobs.", flush=True)

def scale_workers(count):
    global current_replicas
    if count == current_replicas:
        return
    
    action = "Scaling UP ⬆️" if count > current_replicas else "Scaling DOWN ⬇️"
    print(f"\n{action} to {count} workers...", flush=True)
    
    # Run docker-compose scale command
    # We use --no-deps to avoid recreating other services
    cmd = [
        "docker-compose", 
        "-f", "infra/docker-compose.yml", 
        "up", 
        "-d", 
        "--no-deps",
        "--scale", f"worker={count}", 
        "worker"
    ]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        current_replicas = count
        print(f"✅ Successfully scaled to {count} workers!", flush=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to scale: {e}", flush=True)

loops = 0
try:
    while True:
        try:
            # Check the group stats using XINFO GROUPS
            groups = r.xinfo_groups(STREAM_NAME)
            
            queue_length = 0
            for g in groups:
                if g['name'] == 'chat_workers':
                    # 'pending' is jobs currently being worked on
                    # 'lag' is jobs waiting in the stream that haven't been delivered yet
                    pending = g.get('pending', 0)
                    lag = g.get('lag', 0)
                    queue_length = pending + lag
                    break
            
            if queue_length >= SCALE_UP_THRESHOLD:
                if current_replicas < MAX_REPLICAS:
                    print(f"\n🚨 Traffic Spike Detected! Queue length: {queue_length}", flush=True)
                    scale_workers(MAX_REPLICAS)
            elif queue_length == 0:
                if current_replicas > MIN_REPLICAS:
                    print(f"\n📉 Traffic subsided. Queue length: {queue_length}", flush=True)
                    scale_workers(MIN_REPLICAS)
            
            # Print a heartbeat every 5 iterations (10 seconds)
            if queue_length == 0 and loops % 5 == 0:
                print(f"⏱️ Waiting for traffic... (Queue: 0, Workers: {current_replicas})", flush=True)
                
        except redis.exceptions.ResponseError as e:
            # Stream or group might not exist yet if no messages have been sent
            if loops % 5 == 0:
                print(f"⏱️ Waiting for traffic... (Stream not found yet: {e}, Workers: {current_replicas})", flush=True)
            pass
            
        time.sleep(CHECK_INTERVAL)
        loops += 1
except KeyboardInterrupt:
    print("\n🛑 Auto-scaler stopped.", flush=True)
    scale_workers(MIN_REPLICAS)
