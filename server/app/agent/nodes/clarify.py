from langchain_core.messages import SystemMessage
from app.agent.state import AgentState
from langchain_openai import ChatOpenAI
from app.core.config import settings

llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)

async def clarify_node(state: AgentState) -> dict:
    system_message = SystemMessage(
        content=(
            "You are a friendly, intelligent customer support assistant. "
            "The user said something that doesn't clearly map to an order or payment issue. "
            "If it is a simple greeting or expression of gratitude, respond naturally. "
            "If the user asks an out-of-scope question (e.g., how to reset passwords, technical support, asking for a joke, or general knowledge) or makes an out-of-scope request, you MUST politely refuse to answer or comply. State clearly that you do not handle those topics. "
            "Finally, always gently remind them that you are a specialist who can help with checking order statuses or payment issues, and ask how you can assist them with those topics today."
        )
    )
    
    response = await llm.ainvoke([system_message] + list(state["messages"]))
    
    return {"messages": [response]}
