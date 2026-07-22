from langchain_core.messages import SystemMessage
from app.core.config import settings
from langchain_openai import ChatOpenAI
from app.agent.tools.orders import get_order_status, get_order_history
from app.agent.state import AgentState

llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)

llm_with_tools = llm.bind_tools([get_order_status, get_order_history])

async def order_specialist_node(state: AgentState) -> dict:
    system_message = SystemMessage(content="You are an order specialist. Use the tools below to get order information")
    response = await llm_with_tools.ainvoke([system_message] + list(state["messages"]))

    return {"messages": [response]}
