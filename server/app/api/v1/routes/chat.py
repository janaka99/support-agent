from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.core.database import get_db
from app.db.models import Org, Conversation, Message
from app.schemas.chat import ChatRequest, ChatResponse
from app.agent.graph import order_agent_graph

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    conversation = None
    if body.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == body.conversation_id)
        )
        conversation = result.scalar_one_or_none()

    if not conversation:
        # Get default seeded org
        org_result = await db.execute(select(Org).limit(1))
        org = org_result.scalar_one_or_none()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No organization found in database. Please run seed script first."
            )
        
        conversation = Conversation(org_id=org.id, status="open")
        db.add(conversation)
        await db.flush()

    # Save incoming user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=body.message
    )
    db.add(user_msg)
    await db.flush()

    # Retrieve full conversation history ordered by creation time
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    )
    history_messages = history_result.scalars().all()

    # Format messages for LangGraph / LangChain
    langchain_messages = []
    for msg in history_messages:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            langchain_messages.append(SystemMessage(content=msg.content))

    # Invoke LangGraph graph
    try:
        graph_result = await order_agent_graph.ainvoke({
            "messages": langchain_messages,
            "conversation_id": str(conversation.id)
        })
        last_message = graph_result["messages"][-1]
        assistant_content = str(last_message.content)
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LangGraph Agent Error: {str(e)}"
        )

    # Save assistant response
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content
    )
    db.add(assistant_msg)
    await db.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        content=assistant_content,
        role="assistant"
    )

