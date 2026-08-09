import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from langchain_core.messages import HumanMessage

from app.api.deps import get_tenant_db, current_active_user
from app.db.models import User, Guardrail, Bot, Agent, bot_guardrails, agent_guardrails
from app.schemas.guardrail import (
    GuardrailCreate,
    GuardrailUpdate,
    GuardrailResponse,
    GuardrailSummary,
    GuardrailTestRequest,
    GuardrailTestResponse
)
from app.agent.guardrails.engine import (
    evaluate_guardrails,
    evaluate_single_guardrail,
    handle_violation
)

router = APIRouter()

@router.get("", response_model=List[GuardrailSummary])
@router.get("/", response_model=List[GuardrailSummary])
async def list_guardrails(
    stage: Optional[str] = None,
    guardrail_type: Optional[str] = None,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    List all reusable safety guardrails for the user's organization.
    """
    query = select(Guardrail).where(Guardrail.org_id == user.org_id).order_by(Guardrail.created_at.desc())
    if stage:
        query = query.where(Guardrail.stage == stage)
    if guardrail_type:
        query = query.where(Guardrail.guardrail_type == guardrail_type)

    result = await db.execute(query)
    guardrails = result.scalars().all()

    # Get linked counts
    summaries = []
    for g in guardrails:
        bots_count_res = await db.execute(
            select(func.count(bot_guardrails.c.bot_id)).where(bot_guardrails.c.guardrail_id == g.id)
        )
        agents_count_res = await db.execute(
            select(func.count(agent_guardrails.c.agent_id)).where(agent_guardrails.c.guardrail_id == g.id)
        )
        bots_count = bots_count_res.scalar() or 0
        agents_count = agents_count_res.scalar() or 0

        summaries.append(
            GuardrailSummary(
                id=g.id,
                name=g.name,
                display_name=g.display_name,
                description=g.description,
                guardrail_type=g.guardrail_type,
                stage=g.stage,
                action_on_violation=g.action_on_violation,
                is_active=g.is_active,
                created_at=g.created_at,
                linked_bots_count=bots_count,
                linked_agents_count=agents_count
            )
        )

    return summaries

from fastapi import APIRouter, Depends, HTTPException, status, Request

@router.post("", response_model=GuardrailResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=GuardrailResponse, status_code=status.HTTP_201_CREATED)
async def create_guardrail(
    request: Request,
    payload: GuardrailCreate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    Create a new reusable safety guardrail policy.
    """
    raw_body = await request.body()
    print("=== RAW GUARDRAIL POST BODY ===")
    print(raw_body)
    print("===============================")

    # Check for name uniqueness within organization
    existing = await db.execute(
        select(Guardrail).where(Guardrail.org_id == user.org_id, Guardrail.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guardrail with slug '{payload.name}' already exists in your organization."
        )

    guardrail = Guardrail(
        id=uuid.uuid4(),
        org_id=user.org_id,
        name=payload.name,
        display_name=payload.display_name,
        description=payload.description,
        guardrail_type=payload.guardrail_type,
        stage=payload.stage,
        config=payload.config,
        action_on_violation=payload.action_on_violation,
        refusal_message=payload.refusal_message,
        is_active=payload.is_active
    )
    db.add(guardrail)
    await db.commit()
    await db.refresh(guardrail)

    return GuardrailResponse(
        id=guardrail.id,
        org_id=guardrail.org_id,
        name=guardrail.name,
        display_name=guardrail.display_name,
        description=guardrail.description,
        guardrail_type=guardrail.guardrail_type,
        stage=guardrail.stage,
        config=guardrail.config,
        action_on_violation=guardrail.action_on_violation,
        refusal_message=guardrail.refusal_message,
        is_active=guardrail.is_active,
        created_at=guardrail.created_at,
        linked_bots_count=0,
        linked_agents_count=0
    )

@router.get("/{guardrail_id}", response_model=GuardrailResponse)
async def get_guardrail(
    guardrail_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    Get details of a specific safety guardrail.
    """
    result = await db.execute(
        select(Guardrail).where(Guardrail.id == guardrail_id, Guardrail.org_id == user.org_id)
    )
    guardrail = result.scalar_one_or_none()
    if not guardrail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")

    bots_count_res = await db.execute(
        select(func.count(bot_guardrails.c.bot_id)).where(bot_guardrails.c.guardrail_id == guardrail.id)
    )
    agents_count_res = await db.execute(
        select(func.count(agent_guardrails.c.agent_id)).where(agent_guardrails.c.guardrail_id == guardrail.id)
    )

    return GuardrailResponse(
        id=guardrail.id,
        org_id=guardrail.org_id,
        name=guardrail.name,
        display_name=guardrail.display_name,
        description=guardrail.description,
        guardrail_type=guardrail.guardrail_type,
        stage=guardrail.stage,
        config=guardrail.config,
        action_on_violation=guardrail.action_on_violation,
        refusal_message=guardrail.refusal_message,
        is_active=guardrail.is_active,
        created_at=guardrail.created_at,
        linked_bots_count=bots_count_res.scalar() or 0,
        linked_agents_count=agents_count_res.scalar() or 0
    )

@router.put("/{guardrail_id}", response_model=GuardrailResponse)
async def update_guardrail(
    guardrail_id: uuid.UUID,
    payload: GuardrailUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    Update an existing safety guardrail policy.
    """
    result = await db.execute(
        select(Guardrail).where(Guardrail.id == guardrail_id, Guardrail.org_id == user.org_id)
    )
    guardrail = result.scalar_one_or_none()
    if not guardrail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(guardrail, key, value)

    await db.commit()
    await db.refresh(guardrail)

    bots_count_res = await db.execute(
        select(func.count(bot_guardrails.c.bot_id)).where(bot_guardrails.c.guardrail_id == guardrail.id)
    )
    agents_count_res = await db.execute(
        select(func.count(agent_guardrails.c.agent_id)).where(agent_guardrails.c.guardrail_id == guardrail.id)
    )

    return GuardrailResponse(
        id=guardrail.id,
        org_id=guardrail.org_id,
        name=guardrail.name,
        display_name=guardrail.display_name,
        description=guardrail.description,
        guardrail_type=guardrail.guardrail_type,
        stage=guardrail.stage,
        config=guardrail.config,
        action_on_violation=guardrail.action_on_violation,
        refusal_message=guardrail.refusal_message,
        is_active=guardrail.is_active,
        created_at=guardrail.created_at,
        linked_bots_count=bots_count_res.scalar() or 0,
        linked_agents_count=agents_count_res.scalar() or 0
    )

@router.delete("/{guardrail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guardrail(
    guardrail_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    Delete a guardrail policy. Automatically unlinks from all bots and agents.
    """
    result = await db.execute(
        select(Guardrail).where(Guardrail.id == guardrail_id, Guardrail.org_id == user.org_id)
    )
    guardrail = result.scalar_one_or_none()
    if not guardrail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")

    await db.delete(guardrail)
    await db.commit()
    return None

@router.post("/test", response_model=GuardrailTestResponse)
async def test_guardrail_rule(
    req: GuardrailTestRequest,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """
    Live test sandbox endpoint for evaluating sample messages or tool calls.
    Supports testing by guardrail_id, inline guardrail definition, or legacy config.
    """
    try:
        # Case 1: Test against existing Guardrail by ID
        if req.guardrail_id:
            result = await db.execute(
                select(Guardrail).where(Guardrail.id == req.guardrail_id, Guardrail.org_id == user.org_id)
            )
            g = result.scalar_one_or_none()
            if not g:
                raise HTTPException(status_code=404, detail="Guardrail not found")
            
            is_safe, layer, reason, refusal_msg = await evaluate_single_guardrail(
                guardrail=g,
                text_content=req.test_message,
                tool_calls=req.proposed_tool_calls,
                rag_context=req.simulated_rag_context,
                model_name="gpt-4o-mini"
            )
            action = g.action_on_violation
            refusal_response = refusal_msg

        # Case 2: Test against inline Guardrail definition
        elif req.guardrail:
            is_safe, layer, reason, refusal_msg = await evaluate_single_guardrail(
                guardrail=req.guardrail,
                text_content=req.test_message,
                tool_calls=req.proposed_tool_calls,
                rag_context=req.simulated_rag_context,
                model_name="gpt-4o-mini"
            )
            action = req.guardrail.action_on_violation
            refusal_response = refusal_msg

        # Case 3: Legacy GuardrailConfig object
        elif req.guardrails:
            messages = [HumanMessage(content=req.test_message)]
            is_safe, layer, reason, rendered_response = await evaluate_guardrails(
                messages=messages,
                tool_calls=req.proposed_tool_calls,
                bot_guardrails=req.guardrails,
                agent_guardrails=None,
                db=db,
                org_id=user.org_id,
                conversation_id=None,
                model_name="gpt-4o-mini"
            )
            action = req.guardrails.action_on_violation
            refusal_response = rendered_response or req.guardrails.refusal_message
        else:
            raise HTTPException(status_code=400, detail="Must provide guardrail_id, guardrail, or guardrails config.")

        if is_safe:
            return GuardrailTestResponse(
                passed=True,
                violation_layer=None,
                violation_reason=None,
                suggested_action="allow",
                rendered_response="Prompt passed active security and policy evaluation."
            )
        else:
            return GuardrailTestResponse(
                passed=False,
                violation_layer=layer,
                violation_reason=reason,
                suggested_action=action,
                rendered_response=refusal_response
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate guardrails: {str(e)}"
        )
