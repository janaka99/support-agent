from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class ModelInfo(BaseModel):
    id: str # model_id slug e.g. "gpt-4o-mini"
    db_id: Optional[str] = None
    name: str
    provider: str
    provider_name: str
    context_window: int = 128000
    supports_tools: bool = True
    supports_vision: bool = False
    supports_structured: bool = True
    prompt_cost_per_million: float = 0.50
    completion_cost_per_million: float = 1.50
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_default: bool = False
    is_active: bool = True
    org_id: Optional[str] = None


class ModelCreate(BaseModel):
    model_id: str = Field(..., description="Unique model slug, e.g. 'anthropic/claude-3-7-sonnet' or 'ollama/llama3.2'")
    name: str = Field(..., description="Human-readable name, e.g. 'Claude 3.7 Sonnet'")
    provider: str = Field(..., description="Provider slug: openai, anthropic, google, deepseek, groq, meta, mistral, openrouter, custom")
    provider_name: Optional[str] = None
    context_window: int = Field(128000, description="Max context tokens")
    supports_tools: bool = True
    supports_vision: bool = False
    supports_structured: bool = True
    prompt_cost_per_million: float = 0.50
    completion_cost_per_million: float = 1.50
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_default: bool = False
    is_active: bool = True


class ModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    provider_name: Optional[str] = None
    context_window: Optional[int] = None
    supports_tools: Optional[bool] = None
    supports_vision: Optional[bool] = None
    supports_structured: Optional[bool] = None
    prompt_cost_per_million: Optional[float] = None
    completion_cost_per_million: Optional[float] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class ModelProviderInfo(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    is_configured: bool = True


class ModelValidateRequest(BaseModel):
    model_id: str
    require_tools: bool = False


class ModelValidateResponse(BaseModel):
    is_valid: bool
    model: ModelInfo
    warning: Optional[str] = None
