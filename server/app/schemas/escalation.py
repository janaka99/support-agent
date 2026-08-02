from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional

class EscalationResponse(BaseModel):
    id: UUID4
    conversation_id: UUID4
    conversation_title: Optional[str]
    reason: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
