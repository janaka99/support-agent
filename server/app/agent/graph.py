import uuid
from typing import TypedDict, Any
from enum import Enum
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.db.models import Agent, Document
from app.agent.state import AgentState
from app.agent.tools import TOOL_REGISTRY
from app.agent.nodes.clarify import clarify_node
from app.core.config import settings

def route_from_supervisor(state: AgentState) -> str:
    next_node = state.get("next_node", "unclear")
    if next_node == "unclear":
        return "clarify_node"
    else:
        return next_node

def route_from_tools(state: AgentState) -> str:
    return "supervisor_node"

async def build_graph(org_id: str, db: AsyncSession, checkpointer=None):
    # Fetch agents for the org
    result = await db.execute(select(Agent).where(Agent.org_id == uuid.UUID(org_id)))
    agents = result.scalars().all()
    
    agent_names = []
    routing_info = []
    
    for agent in agents:
        agent_names.append(agent.name)
        # Assuming specialization provides the context for routing
        routing_info.append(f"If the request is about {agent.specialization}, route to '{agent.name}'.")
        
    routing_instructions = " ".join(routing_info)
    
    supervisor_prompt = (
        "You are a supervisor router. Your job is to classify the user's latest message. "
        f"{routing_instructions} "
        "If it's neither or unclear, route to 'unclear'."
    )
    
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
    
    async def dynamic_supervisor_node(state: AgentState) -> dict:
        system_message = SystemMessage(content=supervisor_prompt)
        
        if not agent_names:
            return {"next_node": "unclear"}
            
        # Dynamically create the enum and model for structured output
        routes_dict = {name: name for name in agent_names}
        routes_dict["unclear"] = "unclear"
        RouteEnum = Enum('RouteEnum', routes_dict)
        
        class RouteSelection(BaseModel):
            next: RouteEnum
            
        structured_llm = llm.with_structured_output(RouteSelection)
        decision = await structured_llm.ainvoke([system_message] + list(state['messages']))
        
        return {"next_node": decision.next.value}

    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor_node", dynamic_supervisor_node)
    workflow.add_node("clarify_node", clarify_node)
    
    workflow.add_edge(START, "supervisor_node")
    workflow.add_edge("clarify_node", END)
    
    # Conditional mapping for supervisor
    conditional_map = {"clarify_node": "clarify_node"}
    for name in agent_names:
        conditional_map[name] = name
        
    workflow.add_conditional_edges(
        "supervisor_node",
        route_from_supervisor,
        conditional_map
    )
    
    all_tools = []
    
    for agent in agents:
        agent_tools = []
        if agent.tools:
            for tool_name in agent.tools:
                if tool_name in TOOL_REGISTRY:
                    agent_tools.append(TOOL_REGISTRY[tool_name])
                    if TOOL_REGISTRY[tool_name] not in all_tools:
                        all_tools.append(TOOL_REGISTRY[tool_name])
                        
        def create_agent_node(agent_id: uuid.UUID, sys_prompt: str, tools: list, model_name: str):
            async def agent_node(state: AgentState) -> dict:
                # 1. RAG Retrieval
                user_message = next((m for m in reversed(state["messages"]) if m.type == "user"), None)
                knowledge_context = ""
                if user_message:
                    query_text = user_message.content
                    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY)
                    query_embedding = await embeddings_model.aembed_query(query_text)
                    
                    # Search DB for top 3 matching chunks
                    stmt = select(Document).where(Document.agent_id == agent_id).order_by(Document.embedding.cosine_distance(query_embedding)).limit(3)
                    result = await db.execute(stmt)
                    docs = result.scalars().all()
                    
                    if docs:
                        knowledge_context = "\n\nKnowledge Base Context:\n" + "\n---\n".join([doc.content for doc in docs])
                
                # 2. LLM Invocation
                agent_llm = ChatOpenAI(model=model_name, api_key=settings.OPENAI_API_KEY)
                if tools:
                    agent_llm = agent_llm.bind_tools(tools)
                    
                final_prompt = sys_prompt + knowledge_context
                sys_msg = SystemMessage(content=final_prompt)
                
                response = await agent_llm.ainvoke([sys_msg] + list(state["messages"]))
                return {"messages": [response]}
            return agent_node
            
        workflow.add_node(agent.name, create_agent_node(agent.id, agent.system_prompt, agent_tools, agent.model))
        
        if agent_tools:
            workflow.add_conditional_edges(agent.name, tools_condition)
        else:
            workflow.add_edge(agent.name, END)
            
    if all_tools:
        workflow.add_node("tools", ToolNode(all_tools))
        workflow.add_edge("tools", "supervisor_node")
        
    return workflow.compile(checkpointer=checkpointer)
