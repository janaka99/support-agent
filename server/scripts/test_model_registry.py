"""
Automated verification script for Database Model Catalog, Dynamic Registry, Factory, and Cost Engine.
"""
import sys
import os
import asyncio

# Add server directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.models_registry import (
    load_models_from_db,
    get_available_models,
    get_model_info,
    infer_model_capabilities,
    MODEL_PROVIDERS,
)
from app.core.llm_factory import get_chat_model
from app.core.cost import calculate_cost
from scripts.seed_models import seed_models


async def run_suite():
    print("\n--- 1. Testing Database Model Seeding & Loading ---")
    await seed_models()
    
    db_models = await load_models_from_db()
    print(f"Total models loaded from DB: {len(db_models)}")
    assert len(db_models) >= 14, f"Expected at least 14 models from database, got {len(db_models)}"
    
    openai_db = await load_models_from_db(provider="openai")
    print(f"OpenAI DB models: {[m['id'] for m in openai_db]}")
    assert any(m["id"] == "gpt-4o-mini" for m in openai_db)
    
    print("[OK] Database Model Seeding & Loading PASSED")

    print("\n--- 2. Testing Memory Cache & Filters ---")
    all_models = get_available_models()
    print(f"Cached models count: {len(all_models)}")
    assert len(all_models) >= 14

    anthropic_models = get_available_models(provider="anthropic")
    print(f"Anthropic models: {[m['id'] for m in anthropic_models]}")
    assert any("claude-3-5-sonnet" in m["id"] for m in anthropic_models)

    search_res = get_available_models(search="reasoning")
    print(f"Search results for 'reasoning': {[m['name'] for m in search_res]}")
    assert len(search_res) >= 2
    print("[OK] Model Cache & Filters PASSED")

    print("\n--- 3. Testing Model Info & Custom Capabilities Inference ---")
    # Known model from DB
    info_known = get_model_info("gpt-4o")
    assert info_known["supports_tools"] is True
    assert info_known["prompt_cost_per_million"] == 2.50
    print(f"Known gpt-4o: {info_known['name']}, Cost: ${info_known['prompt_cost_per_million']}/1M")

    # Inferred OpenRouter model
    info_custom_or = get_model_info("meta-llama/llama-3.3-70b-instruct")
    assert info_custom_or["supports_tools"] is True
    print(f"Inferred Llama 3.3: Provider={info_custom_or['provider_name']}, Tools={info_custom_or['supports_tools']}")

    # Custom local Ollama model
    info_ollama = get_model_info("ollama/qwen2.5-coder:7b")
    assert info_ollama["provider"] == "custom"
    print(f"Inferred Ollama: Name={info_ollama['name']}, Provider={info_ollama['provider_name']}")
    print("[OK] Model Info & Capabilities Inference PASSED")

    print("\n--- 4. Testing Universal LLM Factory Instantiation ---")
    chat_openai = get_chat_model("gpt-4o-mini", temperature=0.3)
    print(f"Instantiated OpenAI model: {chat_openai.model_name}")
    assert chat_openai.model_name == "gpt-4o-mini"

    chat_deepseek = get_chat_model("deepseek/deepseek-chat", temperature=0.7)
    print(f"Instantiated OpenRouter model: {chat_deepseek.model_name}")
    assert "deepseek" in chat_deepseek.model_name

    chat_custom = get_chat_model(
        "mistral",
        temperature=0.1,
        openai_api_base="http://localhost:11434/v1",
        openai_api_key="ollama",
    )
    print(f"Instantiated Custom Endpoint model: {chat_custom.model_name}")
    print("[OK] Universal LLM Factory Instantiation PASSED")

    print("\n--- 5. Testing Dynamic Cost Calculation ---")
    cost_mini = calculate_cost("gpt-4o-mini", prompt_tokens=1000, completion_tokens=500)
    print(f"Cost for gpt-4o-mini (1000 prompt, 500 completion): ${cost_mini:.6f}")
    assert cost_mini == 0.00045, f"Expected 0.00045, got {cost_mini}"

    cost_claude = calculate_cost("claude-3-5-sonnet-20241022", prompt_tokens=1000, completion_tokens=500)
    print(f"Cost for Claude 3.5 Sonnet (1000 prompt, 500 completion): ${cost_claude:.6f}")
    assert cost_claude == 0.0105, f"Expected 0.0105, got {cost_claude}"

    cost_gemini = calculate_cost("gemini-2.0-flash", prompt_tokens=1000, completion_tokens=500)
    print(f"Cost for Gemini 2.0 Flash (1000 prompt, 500 completion): ${cost_gemini:.6f}")
    assert cost_gemini == 0.0003, f"Expected 0.0003, got {cost_gemini}"
    print("[OK] Dynamic Cost Engine PASSED")


if __name__ == "__main__":
    print("==================================================")
    print("RUNNING MULTI-PROVIDER MODEL SUITE WITH LIVE DB")
    print("==================================================")
    asyncio.run(run_suite())
    print("\n==================================================")
    print("ALL DB MODEL VERIFICATION TESTS PASSED SUCCESSFULLY! [OK]")
    print("==================================================")
