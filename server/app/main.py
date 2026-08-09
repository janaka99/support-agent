from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.v1.main import api_router
from scripts.seed_models import seed_models

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed_models()
    except Exception as e:
        logger.warning(f"Auto-seed models on startup skipped: {e}")
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standard API v1 routes
app.include_router(api_router, prefix="/api/v1")

@app.middleware("http")
async def log_request_body(request: Request, call_next):
    if "/api/v1/guardrails" in request.url.path and request.method == "POST":
        body = await request.body()
        print("====== INCOMING RAW BODY ======")
        print(body.decode("utf-8"))
        print("===============================")
        # Recreate the stream for downstream processing
        async def receive():
            return {"type": "http.request", "body": body}
        request._receive = receive
    return await call_next(request)

# Root path for health check
