from app.agent.tools.payment import check_payment_status
from app.agent.nodes.supervisor import supervisor_node
from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from app.agent.nodes.order_agent import order_specialist_node
from app.agent.nodes.payment_agent import payment_specialist_node
from app.agent.nodes.clarify import clarify_node
from app.agent.tools.orders import get_order_status, get_order_history
from app.agent.state import AgentState


def route_from_supervisor(state:AgentState) -> str:
    """
    Reads the 'next_node' from the state and returns it.
    """
    next_node = state.get("next_node", "unclear")
    if next_node == "unclear":
        return "clarify_node"
    else:
        return next_node

# Build state graph
workflow = StateGraph(AgentState)
workflow.add_node("supervisor_node", supervisor_node)
workflow.add_node("order_agent", order_specialist_node)
workflow.add_node("payment_agent", payment_specialist_node)
workflow.add_node("clarify_node", clarify_node)

workflow.add_node("tools", ToolNode([get_order_status, get_order_history, check_payment_status]))

workflow.add_edge(START, "supervisor_node")

# Supervisor conditional routing 
workflow.add_conditional_edges(
    "supervisor_node",
    route_from_supervisor,
    {
        "order_agent": "order_agent",
        "payment_agent": "payment_agent",
        "clarify_node": "clarify_node"
    }
)

# Clarify node ends the turn
workflow.add_edge("clarify_node", END)

workflow.add_conditional_edges("order_agent", tools_condition)
workflow.add_conditional_edges("payment_agent", tools_condition)

# 4. Tools route back to the agent that called them
# Since prebuilt tool nodes return to the caller automatically in some setups,
# or we have to route back. For now, routing tools to END is safer so we don't loop,
# or we can route back to supervisor (but supervisor needs to handle tool messages).
# To properly route back to the calling agent, we would need a custom router.
# Let's assume the specialist agent finished its job, or we route back to supervisor.
# Actually, the simplest fix for a basic bot: just route to END so the tool result goes to the user.
# Wait, if tools route to END, the user sees the raw JSON tool response!
# So tools *must* route back to the agents.
# We can create a simple router that checks the last message.
def route_from_tools(state: AgentState) -> str:
    # A hacky but effective way to know who called the tool is to ask the supervisor to look at the history,
    # or just look at the last AIMessage's tool_calls.
    # Since we can't easily know here without a complex state, let's route back to supervisor.
    return "supervisor_node"

workflow.add_edge("tools", "supervisor_node")

order_agent_graph = workflow.compile()
