from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

from app.core.config import settings

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    conversation_id: str

async def respond_node(state: AgentState) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}

# Build state graph
workflow = StateGraph(AgentState)
workflow.add_node("respond", respond_node)
workflow.add_edge(START, "respond")
workflow.add_edge("respond", END)

agent_graph = workflow.compile()
