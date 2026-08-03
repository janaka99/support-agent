"""
Token pricing and cost estimation engine for LLM and embedding invocations.
Prices per 1,000,000 tokens (Standard OpenAI & Anthropic list pricing).
"""
import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models_registry import get_model_info

DEFAULT_PRICING = {
    "prompt_cost_per_million": 0.50,
    "completion_cost_per_million": 1.50,
}


def calculate_cost(model_name: str, prompt_tokens: int = 0, completion_tokens: int = 0) -> float:
    """
    Calculate the total estimated USD cost for an LLM or embedding call based on token counts.
    Resolves pricing dynamically from the model registry.
    """
    clean_model = (model_name or "gpt-4o-mini").strip()
    
    model_info = get_model_info(clean_model)
    
    prompt_rate = model_info.get("prompt_cost_per_million", DEFAULT_PRICING["prompt_cost_per_million"]) / 1_000_000.0
    completion_rate = model_info.get("completion_cost_per_million", DEFAULT_PRICING["completion_cost_per_million"]) / 1_000_000.0
    
    cost = (prompt_tokens * prompt_rate) + (completion_tokens * completion_rate)
    return round(cost, 8)


async def record_usage_log(
    db: AsyncSession,
    org_id: str,
    conversation_id: Any,
    node_name: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
):
    """
    Persist an individual token usage and cost record to the database for this organization.
    """
    try:
        conv_id = None
        if conversation_id:
            try:
                conv_id = uuid.UUID(str(conversation_id))
            except Exception:
                pass
                
        if total_tokens == 0:
            total_tokens = prompt_tokens + completion_tokens
            
        cost_usd = calculate_cost(model, prompt_tokens, completion_tokens)
        
        from app.db.models import UsageLog
        usage = UsageLog(
            org_id=uuid.UUID(str(org_id)),
            conversation_id=conv_id,
            node_name=node_name,
            model=model,
            prompt_tokens=max(prompt_tokens, 0),
            completion_tokens=max(completion_tokens, 0),
            total_tokens=max(total_tokens, 0),
            cost_usd=cost_usd,
        )
        db.add(usage)
        await db.commit()
    except Exception as e:
        print(f"Error logging token usage: {e}")
