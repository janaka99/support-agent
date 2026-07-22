from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from app.agent.nodes.order_agent import order_specialist_node
from app.agent.tools.orders import get_order_status, get_order_history
from app.agent.state import AgentState

# Build state graph
workflow = StateGraph(AgentState)
workflow.add_node("order_agent", order_specialist_node)
workflow.add_node("tools", ToolNode([get_order_status, get_order_history]))

workflow.add_edge(START, "order_agent")
workflow.add_conditional_edges("order_agent",tools_condition)
workflow.add_edge("tools", "order_agent")


order_agent_graph = workflow.compile()
