"""
Dynamic Model Registry & Capability Catalog.
Loads metadata, capabilities, context windows, and token pricing for models from PostgreSQL database,
with intelligent fallback to automated capability inference for on-the-fly custom models.
"""
from typing import List, Dict, Any, Optional
import time
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.db.models import AIModel

MODEL_PROVIDERS = [
    {"id": "openai", "name": "OpenAI", "description": "Industry standard GPT & reasoning models", "icon": "openai"},
    {"id": "anthropic", "name": "Anthropic", "description": "High intelligence Claude 3.5 & 3.7 models", "icon": "anthropic"},
    {"id": "google", "name": "Google", "description": "Gemini 2.0 & 1.5 multimodal long-context models", "icon": "google"},
    {"id": "deepseek", "name": "DeepSeek", "description": "DeepSeek V3 & R1 reasoning models", "icon": "deepseek"},
    {"id": "groq", "name": "Groq", "description": "Ultra-fast low-latency inference engine", "icon": "groq"},
    {"id": "meta", "name": "Meta (Llama)", "description": "Open-source Llama 3.3 and 3.1 models", "icon": "meta"},
    {"id": "mistral", "name": "Mistral", "description": "Mistral Large, Codestral and Pixtral", "icon": "mistral"},
    {"id": "openrouter", "name": "OpenRouter", "description": "Access 200+ models with unified routing", "icon": "openrouter"},
    {"id": "custom", "name": "Custom / Self-Hosted", "description": "Local Ollama, vLLM, or OpenAI-compatible endpoint", "icon": "custom"},
]

# In-memory fast cache for synchronous cost estimation and lookups
_CACHE_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 60.0 # 1 minute cache TTL
_MODEL_CACHE: Dict[str, Dict[str, Any]] = {}


def _serialize_model(m: AIModel) -> Dict[str, Any]:
    return {
        "id": m.model_id,
        "db_id": str(m.id),
        "name": m.name,
        "provider": m.provider,
        "provider_name": m.provider_name,
        "context_window": m.context_window,
        "supports_tools": m.supports_tools,
        "supports_vision": m.supports_vision,
        "supports_structured": m.supports_structured,
        "prompt_cost_per_million": m.prompt_cost_per_million,
        "completion_cost_per_million": m.completion_cost_per_million,
        "description": m.description,
        "tags": m.tags or [],
        "is_default": m.is_default,
        "is_active": m.is_active,
        "org_id": str(m.org_id) if m.org_id else None,
    }


def update_model_cache(models: List[Dict[str, Any]]):
    """Updates the internal in-memory cache."""
    global _MODEL_CACHE, _CACHE_TIMESTAMP
    for m in models:
        _MODEL_CACHE[m["id"].lower()] = m
    _CACHE_TIMESTAMP = time.time()


async def load_models_from_db(
    db: Optional[AsyncSession] = None,
    org_id: Optional[str] = None,
    provider: Optional[str] = None,
    supports_tools: Optional[bool] = None,
    search: Optional[str] = None,
    include_inactive: bool = False,
) -> List[Dict[str, Any]]:
    """
    Query models from the database table (system global models + org custom models).
    """
    close_session = False
    if db is None:
        db = async_session_maker()
        close_session = True

    try:
        query = select(AIModel)
        
        if not include_inactive:
            query = query.where(AIModel.is_active.is_(True))

        # Org filter: Include global models (org_id is None) and tenant models
        if org_id:
            query = query.where(or_(AIModel.org_id.is_(None), AIModel.org_id == org_id))
        else:
            query = query.where(AIModel.org_id.is_(None))

        if provider and provider != "all":
            query = query.where(AIModel.provider == provider.lower())

        if supports_tools is not None:
            query = query.where(AIModel.supports_tools.is_(supports_tools))

        res = await db.execute(query.order_by(AIModel.created_at.asc()))
        rows = res.scalars().all()

        # If table is completely empty, auto-seed baseline catalog on the fly
        if len(rows) == 0 and not provider and not search and supports_tools is None:
            try:
                from scripts.seed_models import seed_models
                await seed_models(db)
                res = await db.execute(query.order_by(AIModel.created_at.asc()))
                rows = res.scalars().all()
            except Exception:
                pass

        models_list = [_serialize_model(row) for row in rows]

        # In-memory search filtering if specified
        if search:
            q = search.lower().strip()
            models_list = [
                m for m in models_list
                if q in m["name"].lower()
                or q in m["id"].lower()
                or q in m["provider_name"].lower()
                or any(q in t.lower() for t in m.get("tags", []))
            ]

        # Update cache
        update_model_cache(models_list)
        return models_list
    finally:
        if close_session:
            await db.close()


def get_available_models(
    provider: Optional[str] = None,
    supports_tools: Optional[bool] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Returns available models from the memory cache (or static defaults if cache empty).
    """
    models = list(_MODEL_CACHE.values())
    if not models:
        # Fallback baseline catalog if DB not yet loaded into cache
        from scripts.seed_models import BASE_MODELS
        models = [dict(m, id=m["model_id"]) for m in BASE_MODELS]
        update_model_cache(models)

    if provider and provider != "all":
        models = [m for m in models if m.get("provider") == provider.lower()]

    if supports_tools is not None:
        models = [m for m in models if m.get("supports_tools") == supports_tools]

    if search:
        q = search.lower().strip()
        models = [
            m for m in models
            if q in m.get("name", "").lower()
            or q in m.get("id", "").lower()
            or q in m.get("provider_name", "").lower()
            or any(q in t.lower() for t in m.get("tags", []))
        ]

    return models


def infer_model_capabilities(model_id: str) -> Dict[str, Any]:
    """
    Infers capabilities, provider, and pricing for any custom or dynamic model ID.
    Supports OpenRouter slugs, Ollama names, HuggingFace IDs, etc.
    """
    clean_id = model_id.strip()
    lower_id = clean_id.lower()
    
    # Check cache first
    if lower_id in _MODEL_CACHE:
        return dict(_MODEL_CACHE[lower_id])
    
    # Infer provider
    provider = "custom"
    provider_name = "Custom / Self-Hosted"

    if lower_id.startswith("ollama/"):
        provider = "custom"
        provider_name = "Ollama (Local)"
    elif lower_id.startswith("vllm/"):
        provider = "custom"
        provider_name = "vLLM (Local)"
    elif lower_id.startswith("openai/") or lower_id.startswith("gpt-") or lower_id.startswith("o1") or lower_id.startswith("o3"):
        provider = "openai"
        provider_name = "OpenAI"
    elif lower_id.startswith("anthropic/") or "claude" in lower_id:
        provider = "anthropic"
        provider_name = "Anthropic"
    elif lower_id.startswith("google/") or "gemini" in lower_id:
        provider = "google"
        provider_name = "Google"
    elif "deepseek" in lower_id:
        provider = "deepseek"
        provider_name = "DeepSeek"
    elif "groq/" in lower_id:
        provider = "groq"
        provider_name = "Groq"
    elif "meta-llama" in lower_id or "llama" in lower_id:
        provider = "meta"
        provider_name = "Meta"
    elif "mistral" in lower_id:
        provider = "mistral"
        provider_name = "Mistral"
    elif lower_id.startswith("openrouter/") or "/" in lower_id:
        provider = "openrouter"
        provider_name = "OpenRouter"
        
    non_tool_patterns = ["embed", "rerank", "whisper", "tts", "dall-e", "base", "reward", "guard"]
    supports_tools = not any(pat in lower_id for pat in non_tool_patterns)
    
    name_parts = clean_id.split("/")[-1].replace("-", " ").replace("_", " ").title()
    
    return {
        "id": clean_id,
        "name": name_parts,
        "provider": provider,
        "provider_name": provider_name,
        "context_window": 128000,
        "supports_tools": supports_tools,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.50,
        "completion_cost_per_million": 1.50,
        "description": f"Custom model dynamically resolved from identifier '{clean_id}'",
        "tags": ["Custom"],
        "is_default": False,
        "is_active": True,
    }


def get_model_info(model_id: str) -> Dict[str, Any]:
    """
    Get capabilities and token pricing for any model.
    Checks DB in-memory cache first, then dynamic capability inference.
    """
    if not model_id:
        model_id = "gpt-4o-mini"
        
    clean_id = model_id.strip()
    lower_id = clean_id.lower()
    
    if lower_id in _MODEL_CACHE:
        return dict(_MODEL_CACHE[lower_id])
        
    return infer_model_capabilities(clean_id)
