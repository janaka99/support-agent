from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    conversation_id: Optional[UUID] = Field(default=None, description="ID of the conversation. If not provided, a new one is created.")
    bot_id: Optional[UUID] = Field(default=None, description="ID of the bot touchpoint to route through.")
    message: str = Field(..., min_length=1, description="Message text from the user.")

class ChatResponse(BaseModel):
    conversation_id: UUID
    bot_id: Optional[UUID] = None
    content: str
    role: str = "assistant"
