import uuid
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AgentBase(BaseModel):
    name: str = Field(..., description="Name of the agent")
    specialization: str = Field(..., description="Agent's specialization. Must be unique per org.")
    system_prompt: str = Field(..., min_length=1, description="System prompt for the agent")
    model: str = Field(default="gpt-4o-mini", description="LLM model to use")
    tools: List[str] = Field(default_factory=list, min_length=1, description="List of tools assigned to the agent")
    guardrails: Optional[List[str]] = Field(default=None)
    routing_examples: Optional[List[str]] = Field(default=None)

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    system_prompt: Optional[str] = Field(None, min_length=1)
    model: Optional[str] = None
    tools: Optional[List[str]] = Field(None, min_length=1)
    guardrails: Optional[List[str]] = None
    routing_examples: Optional[List[str]] = None

class AgentResponse(AgentBase):
    id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Content of the document to index for this agent.")
