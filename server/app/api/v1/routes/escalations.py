from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models import Org, Escalation, Conversation
from app.schemas.escalation import EscalationResponse

router = APIRouter()

@router.get("", status_code=status.HTTP_200_OK, response_model=list[EscalationResponse])
async def list_escalations(db: AsyncSession = Depends(get_db)):
    """Fetch all escalations for the default org (for now)."""
    # Get default seeded org
    org_result = await db.execute(select(Org).limit(1))
    org = org_result.scalar_one_or_none()
    if not org:
        return []

    # Get escalations ordered by created_at DESC
    result = await db.execute(
        select(Escalation)
        .options(selectinload(Escalation.conversation))
        .where(Escalation.org_id == org.id)
        .order_by(Escalation.created_at.desc())
    )
    
    escalations = result.scalars().all()
    
    return [
        EscalationResponse(
            id=e.id,
            conversation_id=e.conversation_id,
            conversation_title=e.conversation.title if e.conversation else "Unknown",
            reason=e.reason,
            status=e.status,
            created_at=e.created_at
        ) for e in escalations
    ]

@router.post("/{escalation_id}/resolve", status_code=status.HTTP_200_OK)
async def resolve_escalation(escalation_id: str, db: AsyncSession = Depends(get_db)):
    """Mark an escalation as resolved and update conversation status."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    escalation.status = "resolved"
    
    if escalation.conversation_id:
        conv_result = await db.execute(select(Conversation).where(Conversation.id == escalation.conversation_id))
        conv = conv_result.scalar_one_or_none()
        if conv:
            # Change conversation back to open so AI or human can continue, or mark it closed.
            # Let's assume 'open' so it's active again, or 'closed' if the human finished.
            conv.status = "open"
            
    await db.commit()
    return {"status": "success"}
