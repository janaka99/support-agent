import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_tenant_db
from app.core.auth import current_active_user
from app.db.models import User, Agent, Document
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, DocumentCreate
from app.agent.tools import TOOL_REGISTRY
from langchain_openai import OpenAIEmbeddings
from app.core.config import settings

router = APIRouter()

async def check_specialization_unique(db: AsyncSession, org_id: uuid.UUID, specialization: str, exclude_id: uuid.UUID = None):
    query = select(Agent).where(Agent.org_id == org_id, Agent.specialization == specialization)
    if exclude_id:
        query = query.where(Agent.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An agent with specialization '{specialization}' already exists."
        )

def validate_tools(tools: List[str]):
    invalid_tools = [tool for tool in tools if tool not in TOOL_REGISTRY]
    if invalid_tools:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tools specified: {', '.join(invalid_tools)}"
        )

@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    result = await db.execute(select(Agent).where(Agent.org_id == user.org_id))
    return result.scalars().all()

@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_in: AgentCreate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    validate_tools(agent_in.tools)
    await check_specialization_unique(db, user.org_id, agent_in.specialization)

    new_agent = Agent(
        org_id=user.org_id,
        name=agent_in.name,
        specialization=agent_in.specialization,
        system_prompt=agent_in.system_prompt,
        model=agent_in.model,
        tools=agent_in.tools,
        guardrails=agent_in.guardrails,
        routing_examples=agent_in.routing_examples
    )
    db.add(new_agent)
    await db.commit()
    await db.refresh(new_agent)
    return new_agent

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    agent_in: AgentUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    if agent_in.tools is not None:
        validate_tools(agent_in.tools)

    if agent_in.specialization is not None and agent_in.specialization != agent.specialization:
        await check_specialization_unique(db, user.org_id, agent_in.specialization, exclude_id=agent_id)

    update_data = agent_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent)
    return agent

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user)
):
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
    # Verify agent belongs to the org
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == user.org_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Simple fixed-size chunking (1000 chars)
    chunk_size = 1000
    text = doc_in.content
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

    # Generate embeddings
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY)
    embeddings = await embeddings_model.aembed_documents(chunks)

    # Save to database
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
