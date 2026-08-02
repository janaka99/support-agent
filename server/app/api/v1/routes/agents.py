import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from langchain_openai import OpenAIEmbeddings

from app.api.deps import get_tenant_db
from app.core.auth import current_active_user
from app.db.models import User, Agent, Tool, Guardrail, Document, BotAgent, Bot, agent_tools
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, ToolSummary, DocumentCreate
from app.schemas.guardrail import GuardrailSummary
from app.core.config import settings

router = APIRouter()

def format_agent_response(agent: Agent) -> AgentResponse:
    assigned_tools_list = []
    if agent.tools:
        for t in agent.tools:
            assigned_tools_list.append(ToolSummary(
                id=t.id,
                name=t.name,
                display_name=t.display_name,
                tool_type=t.tool_type,
                description=t.description
            ))

    guardrails_summary = []
    if getattr(agent, "attached_guardrails", None):
        for g in agent.attached_guardrails:
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

    linked_bot_names = []
    if agent.bot_associations:
        for ba in agent.bot_associations:
            if ba.bot:
                linked_bot_names.append(ba.bot.name)

    return AgentResponse(
        id=agent.id,
        org_id=agent.org_id,
        name=agent.name,
        specialization=agent.specialization,
        system_prompt=agent.system_prompt,
        model=agent.model,
        temperature=agent.temperature if agent.temperature is not None else 0.2,
        guardrails=agent.guardrails,
        routing_examples=agent.routing_examples,
        created_at=agent.created_at,
        assigned_tools=assigned_tools_list,
        assigned_guardrails=guardrails_summary,
        linked_bots_count=len(linked_bot_names),
        linked_bot_names=linked_bot_names
    )

@router.get("", response_model=List[AgentResponse])
async def list_agents(
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """List all agents for the organization with assigned tools, guardrails, and linked bots."""
    stmt = (
        select(Agent)
        .where(Agent.org_id == user.org_id)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.attached_guardrails),
            selectinload(Agent.bot_associations).selectinload(BotAgent.bot)
        )
        .order_by(Agent.created_at.desc())
    )
    result = await db.execute(stmt)
    agents = result.scalars().all()
    return [format_agent_response(a) for a in agents]

@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_in: AgentCreate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """Create a new specialist agent and bind selected tools and guardrails."""
    new_agent = Agent(
        id=uuid.uuid4(),
        org_id=user.org_id,
        name=agent_in.name,
        specialization=agent_in.specialization,
        system_prompt=agent_in.system_prompt,
        model=agent_in.model,
        temperature=agent_in.temperature,
        guardrails=agent_in.guardrails,
        routing_examples=agent_in.routing_examples
    )
    db.add(new_agent)
    await db.flush()

    # Bind tools by tool_ids
    if agent_in.tool_ids:
        for t_id in agent_in.tool_ids:
            t_res = await db.execute(select(Tool).where(Tool.id == t_id, Tool.org_id == user.org_id))
            if t_res.scalar_one_or_none():
                await db.execute(
                    agent_tools.insert().values(agent_id=new_agent.id, tool_id=t_id)
                )

    # Bind guardrails by guardrail_ids
    if agent_in.guardrail_ids:
        g_res = await db.execute(
            select(Guardrail).where(Guardrail.id.in_(agent_in.guardrail_ids), Guardrail.org_id == user.org_id)
        )
        new_agent.attached_guardrails = g_res.scalars().all()

    await db.commit()
    
    # Reload
    res = await db.execute(
        select(Agent)
        .where(Agent.id == new_agent.id)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.attached_guardrails),
            selectinload(Agent.bot_associations).selectinload(BotAgent.bot)
        )
    )
    return format_agent_response(res.scalar_one())

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """Get specialist agent by ID with tools and guardrails."""
    stmt = (
        select(Agent)
        .where(Agent.id == agent_id, Agent.org_id == user.org_id)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.attached_guardrails),
            selectinload(Agent.bot_associations).selectinload(BotAgent.bot)
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return format_agent_response(agent)

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    agent_in: AgentUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """Update specialist agent settings, tool bindings, and attached guardrails."""
    stmt = (
        select(Agent)
        .where(Agent.id == agent_id, Agent.org_id == user.org_id)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.attached_guardrails),
            selectinload(Agent.bot_associations).selectinload(BotAgent.bot)
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    update_data = agent_in.model_dump(exclude_unset=True)
    
    # Update primitive fields
    for field in ["name", "specialization", "system_prompt", "model", "temperature", "guardrails", "routing_examples"]:
        if field in update_data and update_data[field] is not None:
            setattr(agent, field, update_data[field])

    # Update tool bindings if tool_ids was provided
    if agent_in.tool_ids is not None:
        agent.tools.clear()
        for t_id in agent_in.tool_ids:
            t_res = await db.execute(select(Tool).where(Tool.id == t_id, Tool.org_id == user.org_id))
            tool_obj = t_res.scalar_one_or_none()
            if tool_obj:
                agent.tools.append(tool_obj)

    # Update attached guardrails if guardrail_ids was provided
    if agent_in.guardrail_ids is not None:
        g_res = await db.execute(
            select(Guardrail).where(Guardrail.id.in_(agent_in.guardrail_ids), Guardrail.org_id == user.org_id)
        )
        agent.attached_guardrails = g_res.scalars().all()

    await db.commit()
    
    res = await db.execute(
        select(Agent)
        .where(Agent.id == agent.id)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.attached_guardrails),
            selectinload(Agent.bot_associations).selectinload(BotAgent.bot)
        )
    )
    return format_agent_response(res.scalar_one())

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    """Delete a specialist agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    await db.delete(agent)
    await db.commit()
    return None

@router.post("/{agent_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    agent_id: uuid.UUID,
    doc_in: DocumentCreate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    chunk_size = 1000
    text = doc_in.content
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY)
    embeddings = await embeddings_model.aembed_documents(chunks)

    docs_to_insert = []
    for chunk, embedding in zip(chunks, embeddings):
        new_doc = Document(
            org_id=user.org_id,
            agent_id=agent_id,
            content=chunk,
            embedding=embedding
        )
        db.add(new_doc)
        docs_to_insert.append(new_doc)
        
    await db.commit()
    return {"status": "success", "chunks_indexed": len(docs_to_insert)}
