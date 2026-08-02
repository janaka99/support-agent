import uuid
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from app.schemas.guardrail import GuardrailConfig, GuardrailSummary

class ToolSummary(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    tool_type: str
    description: str

    class Config:
        from_attributes = True

class AgentBase(BaseModel):
    name: str = Field(..., description="Name of the agent")
    specialization: str = Field(..., description="Agent's specialization")
    system_prompt: str = Field(..., min_length=1, description="System prompt for the agent")
    model: str = Field(default="gpt-4o-mini", description="LLM model to use")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0, description="Sampling temperature")
    tool_ids: Optional[List[uuid.UUID]] = Field(default_factory=list, description="List of tool UUIDs assigned to this agent")
    tools: Optional[List[str]] = Field(default_factory=list, description="Legacy tool names for backward compatibility")
    guardrail_ids: Optional[List[uuid.UUID]] = Field(default_factory=list, description="List of reusable guardrail UUIDs assigned to this agent")
    guardrails: Optional[Union[GuardrailConfig, List[str], Dict[str, Any]]] = Field(default=None, description="Legacy embedded guardrails config")
    routing_examples: Optional[List[str]] = Field(default=None)

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    system_prompt: Optional[str] = Field(None, min_length=1)
    model: Optional[str] = None
    temperature: Optional[float] = None
    tool_ids: Optional[List[uuid.UUID]] = None
    tools: Optional[List[str]] = None
    guardrail_ids: Optional[List[uuid.UUID]] = None
    guardrails: Optional[Union[GuardrailConfig, List[str], Dict[str, Any]]] = None
    routing_examples: Optional[List[str]] = None

class AgentResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    specialization: str
    system_prompt: str
    model: str
    temperature: float = 0.2
    guardrails: Optional[Union[GuardrailConfig, List[str], Dict[str, Any]]] = None
    routing_examples: Optional[List[str]] = None
    created_at: datetime
    assigned_tools: List[ToolSummary] = Field(default_factory=list)
    assigned_guardrails: List[GuardrailSummary] = Field(default_factory=list)
    linked_bots_count: int = 0
    linked_bot_names: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Content of the document to index for this agent.")
