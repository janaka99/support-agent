import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.db.models import Bot, BotAgent, Agent, Guardrail, User
from app.schemas.bot import BotCreate, BotUpdate, BotResponse, BotAgentAssociation
from app.schemas.guardrail import GuardrailSummary

router = APIRouter(prefix="/bots", tags=["Bots Studio"])

def format_bot_response(bot: Bot) -> BotResponse:
    agents_list = []
    if bot.bot_agents:
        for ba in sorted(bot.bot_agents, key=lambda x: x.priority):
            agent = ba.agent
            if agent:
                agents_list.append(BotAgentAssociation(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    specialization=agent.specialization,
                    routing_hint=ba.routing_hint,
                    priority=ba.priority
                ))

    guardrails_summary = []
    if getattr(bot, "attached_guardrails", None):
        for g in bot.attached_guardrails:
            guardrails_summary.append(
                GuardrailSummary(
                    id=g.id,
                    name=g.name,
                    display_name=g.display_name,
                    description=g.description,
                    guardrail_type=g.guardrail_type,
                    stage=g.stage,
                    action_on_violation=g.action_on_violation,
                    is_active=g.is_active,
                    created_at=g.created_at
                )
            )

    guardrails_val = bot.guardrails if isinstance(bot.guardrails, dict) else (bot.guardrails or {})

    return BotResponse(
        id=bot.id,
        org_id=bot.org_id,
        name=bot.name,
        description=bot.description,
        greeting_message=bot.greeting_message,
        system_prompt=bot.system_prompt,
        model=bot.model,
        is_active=bot.is_active,
        guardrails=guardrails_val,
        created_at=bot.created_at,
        agents=agents_list,
        assigned_guardrails=guardrails_summary
    )

@router.get("", response_model=List[BotResponse])
async def list_bots(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all Bots belonging to the organization."""
    stmt = (
        select(Bot)
        .where(Bot.org_id == user.org_id)
        .options(
            selectinload(Bot.bot_agents).selectinload(BotAgent.agent),
            selectinload(Bot.attached_guardrails)
        )
        .order_by(Bot.created_at.desc())
    )
    result = await db.execute(stmt)
    bots = result.scalars().all()
    return [format_bot_response(b) for b in bots]

@router.post("", response_model=BotResponse, status_code=status.HTTP_201_CREATED)
async def create_bot(
    bot_in: BotCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new Bot touchpoint and attach specialist agents and guardrails."""
    guardrails_dict = bot_in.guardrails.model_dump() if hasattr(bot_in.guardrails, 'model_dump') else (bot_in.guardrails or {})
    bot = Bot(
        id=uuid.uuid4(),
        org_id=user.org_id,
        name=bot_in.name,
        description=bot_in.description,
        greeting_message=bot_in.greeting_message,
        system_prompt=bot_in.system_prompt,
        model=bot_in.model,
        is_active=bot_in.is_active,
        guardrails=guardrails_dict
    )
    db.add(bot)
    await db.flush()

    # Link agents
    if bot_in.agent_links:
        for link in bot_in.agent_links:
            ag_res = await db.execute(select(Agent).where(Agent.id == link.agent_id, Agent.org_id == user.org_id))
            if ag_res.scalar_one_or_none():
                ba = BotAgent(
                    bot_id=bot.id,
                    agent_id=link.agent_id,
                    routing_hint=link.routing_hint,
                    priority=link.priority
                )
                db.add(ba)
    elif bot_in.agent_ids:
        for idx, ag_id in enumerate(bot_in.agent_ids):
            ag_res = await db.execute(select(Agent).where(Agent.id == ag_id, Agent.org_id == user.org_id))
            if ag_res.scalar_one_or_none():
                ba = BotAgent(
                    bot_id=bot.id,
                    agent_id=ag_id,
                    priority=idx
                )
                db.add(ba)

    # Link reusable guardrails
    if bot_in.guardrail_ids:
        g_res = await db.execute(
            select(Guardrail).where(Guardrail.id.in_(bot_in.guardrail_ids), Guardrail.org_id == user.org_id)
        )
        guardrails_found = g_res.scalars().all()
        bot.attached_guardrails = guardrails_found

    await db.commit()
    
    # Reload with relations
    res = await db.execute(
        select(Bot)
        .where(Bot.id == bot.id)
        .options(
            selectinload(Bot.bot_agents).selectinload(BotAgent.agent),
            selectinload(Bot.attached_guardrails)
        )
    )
    reloaded_bot = res.scalar_one()
    return format_bot_response(reloaded_bot)

@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(
    bot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get a specific Bot with its roster of specialist agents and guardrails."""
    stmt = (
        select(Bot)
        .where(Bot.id == bot_id, Bot.org_id == user.org_id)
        .options(
            selectinload(Bot.bot_agents).selectinload(BotAgent.agent),
            selectinload(Bot.attached_guardrails)
        )
    )
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")
    return format_bot_response(bot)

@router.put("/{bot_id}", response_model=BotResponse)
async def update_bot(
    bot_id: uuid.UUID,
    bot_in: BotUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update Bot settings, attached agents, and guardrails."""
    stmt = (
        select(Bot)
        .where(Bot.id == bot_id, Bot.org_id == user.org_id)
        .options(
            selectinload(Bot.bot_agents).selectinload(BotAgent.agent),
            selectinload(Bot.attached_guardrails)
        )
    )
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    update_data = bot_in.model_dump(exclude_unset=True)
    
    # Update primitive fields
    for field in ["name", "description", "greeting_message", "system_prompt", "model", "is_active", "guardrails"]:
        if field in update_data and update_data[field] is not None:
            setattr(bot, field, update_data[field])

    # Update agent associations if provided
    if bot_in.agent_links is not None:
        bot.bot_agents.clear()
        for link in bot_in.agent_links:
            ag_res = await db.execute(select(Agent).where(Agent.id == link.agent_id, Agent.org_id == user.org_id))
            if ag_res.scalar_one_or_none():
                ba = BotAgent(
                    bot_id=bot.id,
                    agent_id=link.agent_id,
                    routing_hint=link.routing_hint,
                    priority=link.priority
                )
                bot.bot_agents.append(ba)
    elif bot_in.agent_ids is not None:
        bot.bot_agents.clear()
        for idx, ag_id in enumerate(bot_in.agent_ids):
            ag_res = await db.execute(select(Agent).where(Agent.id == ag_id, Agent.org_id == user.org_id))
            if ag_res.scalar_one_or_none():
                ba = BotAgent(
                    bot_id=bot.id,
                    agent_id=ag_id,
                    priority=idx
                )
                bot.bot_agents.append(ba)

    # Update attached guardrails if provided
    if bot_in.guardrail_ids is not None:
        g_res = await db.execute(
            select(Guardrail).where(Guardrail.id.in_(bot_in.guardrail_ids), Guardrail.org_id == user.org_id)
        )
        guardrails_found = g_res.scalars().all()
        bot.attached_guardrails = guardrails_found

    await db.commit()
    await db.refresh(bot)
    
    res = await db.execute(
        select(Bot)
        .where(Bot.id == bot.id)
        .options(
            selectinload(Bot.bot_agents).selectinload(BotAgent.agent),
            selectinload(Bot.attached_guardrails)
        )
    )
    reloaded_bot = res.scalar_one()
    return format_bot_response(reloaded_bot)

@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot(
    bot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a Bot."""
    result = await db.execute(select(Bot).where(Bot.id == bot_id, Bot.org_id == user.org_id))
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    await db.delete(bot)
    await db.commit()
    return None
