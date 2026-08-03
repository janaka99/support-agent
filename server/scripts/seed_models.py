"""
Seed script to initialize and update the AI Model Catalog in the database.
Idempotent: Inserts missing models and updates attributes on existing models.
"""
import sys
import os
import asyncio
import uuid
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Add server root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import async_session_maker, engine
from app.db.models import Base, AIModel

BASE_MODELS = [
    # --- OpenAI ---
    {
        "model_id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "openai",
        "provider_name": "OpenAI",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 0.15,
        "completion_cost_per_million": 0.60,
        "description": "Fast, affordable flagship model for multimodal customer support, reasoning, and real-time tool calling.",
        "tags": ["Recommended", "Fast", "Tool Calling"],
        "is_default": True,
        "is_active": True,
    },
    {
        "model_id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "provider_name": "OpenAI",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 2.50,
        "completion_cost_per_million": 10.00,
        "description": "High-intelligence flagship model with state-of-the-art reasoning, coding, and vision analysis.",
        "tags": ["Reasoning", "Vision", "Tool Calling"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "o3-mini",
        "name": "o3-mini",
        "provider": "openai",
        "provider_name": "OpenAI",
        "context_window": 200000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 1.10,
        "completion_cost_per_million": 4.40,
        "description": "High-speed STEM and logical reasoning model designed for complex analysis and math tasks.",
        "tags": ["Reasoning", "Thinking"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "provider": "openai",
        "provider_name": "OpenAI",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 10.00,
        "completion_cost_per_million": 30.00,
        "description": "Legacy high-capability GPT-4 model with broad world knowledge and structured JSON mode.",
        "tags": ["Legacy"],
        "is_default": False,
        "is_active": True,
    },

    # --- Anthropic ---
    {
        "model_id": "claude-3-5-sonnet-20241022",
        "name": "Claude 3.5 Sonnet",
        "provider": "anthropic",
        "provider_name": "Anthropic",
        "context_window": 200000,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 3.00,
        "completion_cost_per_million": 15.00,
        "description": "Industry benchmark in agentic workflows, coding, tool orchestration, and subtle human-like nuance.",
        "tags": ["Recommended", "High Intelligence", "Tool Calling"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "claude-3-5-haiku-20241022",
        "name": "Claude 3.5 Haiku",
        "provider": "anthropic",
        "provider_name": "Anthropic",
        "context_window": 200000,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 0.80,
        "completion_cost_per_million": 4.00,
        "description": "Ultra-fast, responsive Anthropic model matching previous generation Sonnet capabilities at fraction of cost.",
        "tags": ["Fast", "Cost Efficient"],
        "is_default": False,
        "is_active": True,
    },

    # --- Google Gemini ---
    {
        "model_id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "google",
        "provider_name": "Google",
        "context_window": 1048576,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 0.10,
        "completion_cost_per_million": 0.40,
        "description": "Next-gen multimodal speed champion with 1M context window, native tool use, and near-zero latency.",
        "tags": ["Recommended", "Ultra Fast", "1M Context"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "google",
        "provider_name": "Google",
        "context_window": 2097152,
        "supports_tools": True,
        "supports_vision": True,
        "supports_structured": True,
        "prompt_cost_per_million": 1.25,
        "completion_cost_per_million": 5.00,
        "description": "Massive 2M token context window capable of ingesting whole codebases, hours of audio, or hundreds of PDFs.",
        "tags": ["2M Context", "Reasoning", "Multimodal"],
        "is_default": False,
        "is_active": True,
    },

    # --- DeepSeek ---
    {
        "model_id": "deepseek/deepseek-chat",
        "name": "DeepSeek V3",
        "provider": "deepseek",
        "provider_name": "DeepSeek",
        "context_window": 64000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.14,
        "completion_cost_per_million": 0.28,
        "description": "Extremely cost-effective 671B parameter Mixture-of-Experts model matching leading proprietary LLMs.",
        "tags": ["Recommended", "Ultra Cheap", "Tool Calling"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "deepseek/deepseek-r1",
        "name": "DeepSeek R1",
        "provider": "deepseek",
        "provider_name": "DeepSeek",
        "context_window": 64000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.55,
        "completion_cost_per_million": 2.19,
        "description": "Advanced open reasoning model utilizing chain-of-thought verification for complex tasks.",
        "tags": ["Reasoning", "Thinking"],
        "is_default": False,
        "is_active": True,
    },

    # --- Groq & Meta Llama ---
    {
        "model_id": "groq/llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B (Groq LPU)",
        "provider": "groq",
        "provider_name": "Groq",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.59,
        "completion_cost_per_million": 0.79,
        "description": "Near GPT-4 performance powered by Groq LPUs delivering over 300 tokens/second.",
        "tags": ["Ultra Fast", "Tool Calling"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "meta-llama/llama-3.3-70b-instruct",
        "name": "Llama 3.3 70B Instruct",
        "provider": "meta",
        "provider_name": "Meta",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.40,
        "completion_cost_per_million": 0.40,
        "description": "Meta's flagship open weights model fine-tuned for high-accuracy instruction and tool use.",
        "tags": ["Open Weights", "Tool Calling"],
        "is_default": False,
        "is_active": True,
    },
    {
        "model_id": "meta-llama/llama-3.1-8b-instruct",
        "name": "Llama 3.1 8B Instruct",
        "provider": "meta",
        "provider_name": "Meta",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 0.05,
        "completion_cost_per_million": 0.08,
        "description": "High-throughput, ultra-affordable lightweight model for simple triage, summaries, and extraction.",
        "tags": ["Lightweight", "Ultra Cheap"],
        "is_default": False,
        "is_active": True,
    },

    # --- Mistral AI ---
    {
        "model_id": "mistralai/mistral-large-2411",
        "name": "Mistral Large 2",
        "provider": "mistral",
        "provider_name": "Mistral",
        "context_window": 128000,
        "supports_tools": True,
        "supports_vision": False,
        "supports_structured": True,
        "prompt_cost_per_million": 2.00,
        "completion_cost_per_million": 6.00,
        "description": "Mistral's flagship enterprise model with deep reasoning and native multi-lingual support.",
        "tags": ["Multilingual", "Reasoning"],
        "is_default": False,
        "is_active": True,
    },
]


async def seed_models(session: AsyncSession = None):
    """
    Seeds baseline model catalog into the database.
    """
    close_session = False
    if session is None:
        close_session = True
        # Ensure table exists
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=[AIModel.__table__])
        session = async_session_maker()

    try:
        inserted_count = 0
        updated_count = 0

        for item in BASE_MODELS:
            res = await session.execute(
                select(AIModel).where(
                    AIModel.model_id == item["model_id"],
                    AIModel.org_id.is_(None)
                )
            )
            existing = res.scalar_one_or_none()

            if not existing:
                new_model = AIModel(
                    id=uuid.uuid4(),
                    org_id=None, # Platform global model
                    model_id=item["model_id"],
                    name=item["name"],
                    provider=item["provider"],
                    provider_name=item["provider_name"],
                    context_window=item["context_window"],
                    supports_tools=item["supports_tools"],
                    supports_vision=item["supports_vision"],
                    supports_structured=item["supports_structured"],
                    prompt_cost_per_million=item["prompt_cost_per_million"],
                    completion_cost_per_million=item["completion_cost_per_million"],
                    description=item.get("description"),
                    tags=item.get("tags", []),
                    is_default=item.get("is_default", False),
                    is_active=item.get("is_active", True),
                )
                session.add(new_model)
                inserted_count += 1
            else:
                existing.name = item["name"]
                existing.provider = item["provider"]
                existing.provider_name = item["provider_name"]
                existing.context_window = item["context_window"]
                existing.supports_tools = item["supports_tools"]
                existing.supports_vision = item["supports_vision"]
                existing.supports_structured = item["supports_structured"]
                existing.prompt_cost_per_million = item["prompt_cost_per_million"]
                existing.completion_cost_per_million = item["completion_cost_per_million"]
                existing.description = item.get("description")
                existing.tags = item.get("tags", [])
                existing.is_default = item.get("is_default", False)
                existing.is_active = item.get("is_active", True)
                updated_count += 1

        await session.commit()
        print(f"[OK] Seeded AI Models catalog: {inserted_count} inserted, {updated_count} updated.")
    finally:
        if close_session:
            await session.close()


if __name__ == "__main__":
    asyncio.run(seed_models())
