import uuid
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.guardrail import GuardrailConfig, GuardrailSummary

class BotAgentAssociation(BaseModel):
    agent_id: uuid.UUID
    agent_name: Optional[str] = None
    specialization: Optional[str] = None
    routing_hint: Optional[str] = None
    priority: int = 0

class BotBase(BaseModel):
    name: str = Field(..., description="Name of the bot touchpoint (e.g. Storefront Support)")
    description: Optional[str] = Field(None, description="Short summary of the bot's purpose")
    greeting_message: Optional[str] = Field(default="Hello! How can I help you today?")
    system_prompt: Optional[str] = Field(None, description="Global routing instructions for supervisor")
    model: str = Field(default="gpt-4o-mini", description="Supervisor model")
    is_active: bool = Field(default=True)
    guardrails: Optional[Union[GuardrailConfig, Dict[str, Any]]] = Field(
        default_factory=dict,
        description="Legacy embedded guardrails config"
    )

class BotCreate(BotBase):
    agent_ids: Optional[List[uuid.UUID]] = Field(default_factory=list, description="IDs of specialist agents assigned to this bot")
    agent_links: Optional[List[BotAgentAssociation]] = None
    guardrail_ids: Optional[List[uuid.UUID]] = Field(default_factory=list, description="IDs of reusable guardrails attached to this bot")

class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    greeting_message: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    is_active: Optional[bool] = None
    guardrails: Optional[Union[GuardrailConfig, Dict[str, Any]]] = None
    agent_ids: Optional[List[uuid.UUID]] = None
    agent_links: Optional[List[BotAgentAssociation]] = None
    guardrail_ids: Optional[List[uuid.UUID]] = None

class BotResponse(BotBase):
    id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime
    agents: List[BotAgentAssociation] = Field(default_factory=list)
    assigned_guardrails: List[GuardrailSummary] = Field(default_factory=list)

    class Config:
        from_attributes = True
