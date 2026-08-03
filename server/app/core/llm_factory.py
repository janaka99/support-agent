"""
Universal LLM Factory.
Dynamically instantiates chat models across providers (OpenAI, Anthropic, Google, DeepSeek, Groq, OpenRouter, Ollama/vLLM)
with unified tool-calling and structured output compatibility.
"""
import logging
from typing import Optional, Dict, Any
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.models_registry import get_model_info

logger = logging.getLogger(__name__)


def get_chat_model(
    model_identifier: str = "gpt-4o-mini",
    temperature: float = 0.2,
    max_retries: int = 2,
    custom_base_url: Optional[str] = None,
    custom_api_key: Optional[str] = None,
    **kwargs: Any,
) -> BaseChatModel:
    """
    Dynamically instantiate any chat model across any provider.
    
    Supports:
    - OpenAI Native: "gpt-4o-mini", "gpt-4o", "o3-mini", etc.
    - DeepSeek Native & OpenRouter: "deepseek/deepseek-chat", "deepseek/deepseek-r1"
    - Groq Inference: "groq/llama-3.3-70b-versatile"
    - OpenRouter (200+ models): "openrouter/anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct"
    - Anthropic: "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022" (via Anthropic/OpenRouter)
    - Google: "gemini-2.0-flash", "gemini-1.5-pro" (via Google/OpenRouter)
    - Custom / Ollama / Local vLLM: "custom/mistral", "ollama/llama3"
    """
    model_info = get_model_info(model_identifier)
    provider = model_info.get("provider", "openai")
    model_id = model_info.get("id", model_identifier)

    # 1. Custom or Self-Hosted Base URL override
    if custom_base_url or settings.OPENAI_API_BASE:
        base_url = custom_base_url or settings.OPENAI_API_BASE
        api_key = custom_api_key or settings.OPENAI_API_KEY or "not-needed"
        return ChatOpenAI(
            model=model_id,
            temperature=temperature,
            api_key=api_key,
            base_url=base_url,
            max_retries=max_retries,
            **kwargs,
        )

    # 2. OpenRouter Routed Models (e.g. meta-llama/*, mistralai/*, or openrouter/* prefix)
    if model_id.startswith("openrouter/") or (
        provider == "openrouter" and settings.OPENROUTER_API_KEY
    ):
        clean_model = model_id.replace("openrouter/", "")
        api_key = custom_api_key or settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY
        return ChatOpenAI(
            model=clean_model,
            temperature=temperature,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            max_retries=max_retries,
            default_headers={
                "HTTP-Referer": "https://support-agent.local",
                "X-Title": "Support Agent",
            },
            **kwargs,
        )

    # 3. DeepSeek Direct API
    if provider == "deepseek" and settings.DEEPSEEK_API_KEY:
        clean_model = model_id.replace("deepseek/", "")
        return ChatOpenAI(
            model=clean_model,
            temperature=temperature,
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com/v1",
            max_retries=max_retries,
            **kwargs,
        )

    # 4. Groq Direct API (Ultra fast OpenAI-compatible inference)
    if provider == "groq" and settings.GROQ_API_KEY:
        clean_model = model_id.replace("groq/", "")
        return ChatOpenAI(
            model=clean_model,
            temperature=temperature,
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            max_retries=max_retries,
            **kwargs,
        )

    # 5. Anthropic Claude (Native or OpenRouter fallback)
    if provider == "anthropic":
        if settings.ANTHROPIC_API_KEY:
            try:
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(
                    model_name=model_id,
                    temperature=temperature,
                    api_key=settings.ANTHROPIC_API_KEY,
                    max_retries=max_retries,
                    **kwargs,
                )
            except ImportError:
                logger.info("langchain_anthropic not installed; attempting OpenRouter fallback")
        
        # OpenRouter fallback for Claude models
        if settings.OPENROUTER_API_KEY:
            openrouter_slug = f"anthropic/{model_id}" if not model_id.startswith("anthropic/") else model_id
            return ChatOpenAI(
                model=openrouter_slug,
                temperature=temperature,
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                max_retries=max_retries,
                **kwargs,
            )

    # 6. Google Gemini (Native or OpenRouter fallback)
    if provider == "google":
        if settings.GOOGLE_API_KEY:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=model_id,
                    temperature=temperature,
                    google_api_key=settings.GOOGLE_API_KEY,
                    max_retries=max_retries,
                    **kwargs,
                )
            except ImportError:
                logger.info("langchain_google_genai not installed; attempting OpenRouter fallback")

        # OpenRouter fallback for Gemini
        if settings.OPENROUTER_API_KEY:
            openrouter_slug = f"google/{model_id}" if not model_id.startswith("google/") else model_id
            return ChatOpenAI(
                model=openrouter_slug,
                temperature=temperature,
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                max_retries=max_retries,
                **kwargs,
            )

    # 7. Meta / Mistral / Other Open Source models via OpenRouter or Groq
    if provider in ["meta", "mistral", "openrouter"]:
        if settings.OPENROUTER_API_KEY:
            return ChatOpenAI(
                model=model_id,
                temperature=temperature,
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                max_retries=max_retries,
                **kwargs,
            )
        elif settings.GROQ_API_KEY and "llama" in model_id.lower():
            groq_model = "llama-3.3-70b-versatile" if "70b" in model_id else "llama-3.1-8b-instant"
            return ChatOpenAI(
                model=groq_model,
                temperature=temperature,
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
                max_retries=max_retries,
                **kwargs,
            )

    # 8. Standard OpenAI Native Default
    return ChatOpenAI(
        model=model_id,
        temperature=temperature,
        api_key=custom_api_key or settings.OPENAI_API_KEY,
        max_retries=max_retries,
        **kwargs,
    )
