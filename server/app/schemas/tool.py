import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class ToolBase(BaseModel):
    name: str = Field(..., description="Unique slug identifier (e.g. check_order_status)")
    display_name: str = Field(..., description="Human readable label (e.g. Check Order Status)")
    description: str = Field(..., description="LLM tool prompt description explaining when and how to use it")
    tool_type: str = Field(default="http_request", description="Type: 'http_request', 'webhook', 'rag_retriever', 'code_sandbox', 'builtin'")
    config: Dict[str, Any] = Field(default_factory=dict, description="URL, method, headers, etc.")
    parameters_schema: Dict[str, Any] = Field(default_factory=dict, description="JSON schema defining input arguments")

class ToolCreate(ToolBase):
    pass

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    tool_type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parameters_schema: Optional[Dict[str, Any]] = None

class ToolResponse(ToolBase):
    id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime
    agents_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ToolTestRequest(BaseModel):
    tool_id: Optional[uuid.UUID] = None
    tool_type: str = "http_request"
    config: Dict[str, Any] = Field(default_factory=dict)
    parameters: Dict[str, Any] = Field(default_factory=dict)

class ToolTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = 200
    data: Optional[Any] = None
    error: Optional[str] = None
