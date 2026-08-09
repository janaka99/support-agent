import uuid
import logging
from typing import TypedDict, Any, List, Optional
from enum import Enum
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import SystemMessage, AIMessage, ToolMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.db.models import Agent, Bot, BotAgent, Tool, Document, AuditLog, Escalation, Conversation, Guardrail
from app.agent.state import AgentState
from app.agent.tools.dynamic import create_langchain_tool
from app.agent.guardrails.engine import (
    evaluate_guardrails,
    evaluate_guardrails_for_stage,
    normalize_guardrail_config,
    run_deterministic_checks
)
from app.core.config import settings
from app.core.cost import record_usage_log
from app.core.llm_factory import get_chat_model

logger = logging.getLogger(__name__)

def route_from_ingress_guardrail(state: AgentState) -> str:
    next_node = state.get("next_node", "supervisor_node")
    if next_node == "end":
        return END
    return "supervisor_node"

def route_from_supervisor(state: AgentState) -> str:
    next_node = state.get("next_node", END)
    if next_node in (END, "end", "direct", "clarify_node", "unclear"):
        return END
    return next_node

def route_from_tools(state: AgentState) -> str:
    return "supervisor_node"

async def build_bot_graph(
    org_id: str,
    db: AsyncSession,
    bot_id: Optional[str] = None,
    checkpointer=None
):
    """
    Dynamically builds a LangGraph supervisor multi-agent graph for a specific Bot touchpoint.
    Loads Bot -> Attached Agents -> Attached Tools & Attached Reusable Guardrails.
    """
    bot: Optional[Bot] = None

    if bot_id:
        result = await db.execute(
            select(Bot)
            .where(Bot.id == uuid.UUID(bot_id), Bot.org_id == uuid.UUID(org_id))
            .options(
                selectinload(Bot.attached_guardrails),
                selectinload(Bot.bot_agents)
                .selectinload(BotAgent.agent)
                .selectinload(Agent.tools),
                selectinload(Bot.bot_agents)
                .selectinload(BotAgent.agent)
                .selectinload(Agent.attached_guardrails)
            )
        )
        bot = result.scalar_one_or_none()

    if not bot:
        # Fallback: get the first active bot for the org
        result = await db.execute(
            select(Bot)
            .where(Bot.org_id == uuid.UUID(org_id), Bot.is_active == True)
            .options(
                selectinload(Bot.attached_guardrails),
                selectinload(Bot.bot_agents)
                .selectinload(BotAgent.agent)
                .selectinload(Agent.tools),
                selectinload(Bot.bot_agents)
                .selectinload(BotAgent.agent)
                .selectinload(Agent.attached_guardrails)
            )
        )
        bot = result.scalars().first()

    agents_list = []
    routing_info = []
    agent_names = []

    if bot:
        # Strictly use agents assigned to this Bot touchpoint
        if bot.bot_agents:
            for ba in sorted(bot.bot_agents, key=lambda x: x.priority):
                agent = ba.agent
                if agent:
                    agents_list.append(agent)
                    agent_names.append(agent.name)
                    hint = ba.routing_hint or agent.specialization or ""
                    routing_info.append(f"{agent.name}: {hint}")
    else:
        # Fallback to all org agents ONLY when no specific bot is configured
        result = await db.execute(
            select(Agent)
            .where(Agent.org_id == uuid.UUID(org_id))
            .options(selectinload(Agent.tools), selectinload(Agent.attached_guardrails))
        )
        agents_list = result.scalars().all()
        for agent in agents_list:
            agent_names.append(agent.name)
            hint = agent.specialization or ""
            routing_info.append(f"{agent.name}: {hint}")

    # Collect all attached first-class guardrails
    all_attached_guardrails = []
    if bot and getattr(bot, "attached_guardrails", None):
        all_attached_guardrails.extend(bot.attached_guardrails)
    for a in agents_list:
        if getattr(a, "attached_guardrails", None):
            all_attached_guardrails.extend(a.attached_guardrails)

    # Ingress Guardrail Interceptor Node (Runs before Supervisor Router)
    async def ingress_guardrail_node(state: AgentState) -> dict:
        messages = list(state.get("messages", []))
        if not messages:
            return {"next_node": "supervisor_node"}

        # 1. First-Class Ingress Guardrails
        if all_attached_guardrails:
            is_safe, layer, reason, rendered = await evaluate_guardrails_for_stage(
                guardrails=all_attached_guardrails,
                stage="ingress",
                messages=messages,
                db=db,
                org_id=uuid.UUID(org_id) if isinstance(org_id, str) else org_id,
                conversation_id=state.get("conversation_id"),
                model_name=bot.model if bot else "gpt-4o-mini"
            )
            if not is_safe:
                fallback_msg = AIMessage(
                    content=rendered or "I am unable to fulfill this request as it violates security guidelines."
                )
                return {"messages": [fallback_msg], "next_node": "end"}

        # 2. Legacy embedded Bot guardrails check
        bot_guardrails = bot.guardrails if bot else {}
        if bot_guardrails:
            bot_cfg = normalize_guardrail_config(bot_guardrails)
            if bot_cfg.enabled:
                full_text = " ".join([str(m.content) for m in messages if hasattr(m, 'content') and m.content])
                det_safe, _, det_reason = run_deterministic_checks(full_text, bot_cfg)
                if not det_safe:
                    fallback_msg = AIMessage(content=bot_cfg.refusal_message or "Blocked by safety policy.")
                    return {"messages": [fallback_msg], "next_node": "end"}

        return {"next_node": "supervisor_node"}

    # Supervisor Execution Setup
    bot_name = bot.name if bot else "Assistant"
    bot_prompt = bot.system_prompt if (bot and bot.system_prompt) else ""
    supervisor_model = bot.model if (bot and bot.model) else "gpt-4o-mini"
    llm = get_chat_model(model_identifier=supervisor_model, temperature=0.2, max_retries=2)

    async def dynamic_supervisor_node(state: AgentState) -> dict:
        messages = list(state.get("messages", []))

        # 1. Standalone Bot (no specialist agents assigned)
        if not agent_names:
            response = await llm.ainvoke([SystemMessage(content=bot_prompt)] + messages)

            prompt_chars = sum(len(m.content) for m in messages if hasattr(m, 'content') and m.content) + len(bot_prompt)
            prompt_tokens = max(int(prompt_chars / 4), 25)
            await record_usage_log(
                db=db,
                org_id=org_id,
                conversation_id=state.get("conversation_id"),
                node_name=bot_name,
                model=supervisor_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=max(int(len(response.content or "") / 4), 10),
            )

            return {"messages": [response], "next_node": END}

        # 2. Supervisor with Specialists attached
        routes_dict = {name: name for name in agent_names}
        routes_dict["direct"] = "direct"
        RouteEnum = Enum('RouteEnum', routes_dict)

        class RouteSelection(BaseModel):
            next: RouteEnum

        agents_roster = "\n".join(routing_info)
        router_prompt = f"{bot_prompt}\n\nAgents:\n{agents_roster}"

        router_llm = get_chat_model(model_identifier=supervisor_model, temperature=0.0, max_retries=2)
        structured_llm = router_llm.with_structured_output(RouteSelection)
        decision = await structured_llm.ainvoke([SystemMessage(content=router_prompt)] + messages)

        prompt_chars = sum(len(m.content) for m in messages if hasattr(m, 'content') and m.content) + len(router_prompt)
        prompt_tokens = max(int(prompt_chars / 4), 25)
        await record_usage_log(
            db=db,
            org_id=org_id,
            conversation_id=state.get("conversation_id"),
            node_name=f"{bot_name} (Router)",
            model=supervisor_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=15,
        )

        chosen = decision.next.value
        if chosen == "direct":
            direct_response = await llm.ainvoke([SystemMessage(content=bot_prompt)] + messages)

            await record_usage_log(
                db=db,
                org_id=org_id,
                conversation_id=state.get("conversation_id"),
                node_name=bot_name,
                model=supervisor_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=max(int(len(direct_response.content or "") / 4), 10),
            )
            return {"messages": [direct_response], "next_node": END}

        return {"next_node": chosen}

    # Pre-Tool Guardrail Interceptor Node (Runs before Tools execute)
    async def pre_tool_guardrail_node(state: AgentState) -> dict:
        last_msg = state["messages"][-1]
        if not getattr(last_msg, "tool_calls", None):
            return {"next_node": "tools"}

        # 1. First-Class Pre-Tool Guardrails
        if all_attached_guardrails:
            is_safe, layer, reason, rendered = await evaluate_guardrails_for_stage(
                guardrails=all_attached_guardrails,
                stage="pre_tool",
                messages=list(state["messages"]),
                tool_calls=last_msg.tool_calls,
                db=db,
                org_id=uuid.UUID(org_id) if isinstance(org_id, str) else org_id,
                conversation_id=state.get("conversation_id"),
                model_name=bot.model if bot else "gpt-4o-mini"
            )
            if not is_safe:
                reason_text = reason or "Tool action blocked by pre-tool safety guardrail."
                tool_msgs = [
                    ToolMessage(
                        tool_call_id=tc["id"],
                        content=f"Safety Guardrail: {reason_text}",
                        name=tc["name"]
                    )
                    for tc in last_msg.tool_calls
                ]
                fallback_msg = AIMessage(
                    content=rendered or "I am unable to execute this action as it exceeds authorized safety limits."
                )
                return {"messages": tool_msgs + [fallback_msg], "next_node": "end"}

        # 2. Legacy guardrail check
        bot_guardrails = bot.guardrails if bot else {}
        agent_guardrails_list = [a.guardrails for a in agents_list if a.guardrails]

        try:
            is_safe, violation_layer, violation_reason, rendered_response = await evaluate_guardrails(
                messages=list(state["messages"]),
                tool_calls=last_msg.tool_calls,
                bot_guardrails=bot_guardrails,
                agent_guardrails=agent_guardrails_list,
                db=db,
                org_id=uuid.UUID(org_id) if isinstance(org_id, str) else org_id,
                conversation_id=state.get("conversation_id"),
                model_name=bot.model if bot else "gpt-4o-mini"
            )
        except Exception as e:
            logger.warning(f"Guardrail evaluation error: {e}")
            is_safe = True
            rendered_response = ""

        if is_safe:
            return {"next_node": "tools"}
        else:
            reason_text = violation_reason or "Action blocked by safety guardrail."
            tool_msgs = [
                ToolMessage(
                    tool_call_id=tc["id"],
                    content=f"Safety Guardrail: {reason_text}",
                    name=tc["name"]
                )
                for tc in last_msg.tool_calls
            ]
            fallback_msg = AIMessage(
                content=rendered_response or "I am unable to fulfill this request as it violates safety guidelines."
            )
            return {"messages": tool_msgs + [fallback_msg], "next_node": "end"}

    def route_from_agent(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if getattr(last_message, "tool_calls", None):
            return "pre_tool_guardrail_node"
        return END

    def route_from_guardrail(state: AgentState) -> str:
        next_n = state.get("next_node", "tools")
        if next_n == "end":
            return END
        return next_n

    workflow = StateGraph(AgentState)
    workflow.add_node("ingress_guardrail_node", ingress_guardrail_node)
    workflow.add_node("supervisor_node", dynamic_supervisor_node)
    workflow.add_node("pre_tool_guardrail_node", pre_tool_guardrail_node)

    # Ingress Guardrail runs first at START
    workflow.add_edge(START, "ingress_guardrail_node")
    workflow.add_conditional_edges("ingress_guardrail_node", route_from_ingress_guardrail, {"supervisor_node": "supervisor_node", END: END})

    conditional_map = {END: END}
    for name in agent_names:
        conditional_map[name] = name

    workflow.add_conditional_edges("supervisor_node", route_from_supervisor, conditional_map)
    workflow.add_conditional_edges("pre_tool_guardrail_node", route_from_guardrail, {"tools": "tools", END: END})

    all_tools_map = {}

    # Build nodes for each Specialist Agent
    for agent in agents_list:
        agent_langchain_tools = []
        if agent.tools:
            for t_model in agent.tools:
                l_tool = create_langchain_tool(
                    tool_model=t_model,
                    db=db,
                    org_id=org_id,
                    conversation_id=None,
                    agent_id=str(agent.id)
                )
                agent_langchain_tools.append(l_tool)
                all_tools_map[l_tool.name] = l_tool

        def create_agent_node(agent_id: uuid.UUID, agent_name: str, sys_prompt: str, tools: list, model_name: str, temperature: float):
            async def agent_node(state: AgentState) -> dict:
                # 1. RAG Retrieval if agent has documents
                user_message = next((m for m in reversed(state["messages"]) if m.type == "user"), None)
                knowledge_context = ""
                if user_message:
                    query_text = user_message.content
                    try:
                        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.OPENAI_API_KEY, max_retries=2)
                        query_embedding = await embeddings_model.aembed_query(query_text)
                        
                        stmt = select(Document).where(Document.agent_id == agent_id).order_by(Document.embedding.cosine_distance(query_embedding)).limit(3)
                        result = await db.execute(stmt)
                        docs = result.scalars().all()
                        
                        if docs:
                            knowledge_context = "\n\nKnowledge Base Context:\n" + "\n---\n".join([doc.content for doc in docs])
                            await record_usage_log(
                                db=db,
                                org_id=org_id,
                                conversation_id=state.get("conversation_id"),
                                node_name=f"{agent_name} (RAG Embeddings)",
                                model="text-embedding-3-small",
                                prompt_tokens=max(int(len(query_text) / 4), 10),
                                completion_tokens=0,
                            )
                    except Exception as rag_err:
                        logger.warning(f"RAG lookup error: {rag_err}")

                # 2. LLM Invocation
                agent_llm = get_chat_model(model_identifier=model_name, temperature=temperature, max_retries=2)
                if tools:
                    agent_llm = agent_llm.bind_tools(tools)

                final_prompt = sys_prompt + knowledge_context
                sys_msg = SystemMessage(content=final_prompt)

                response = await agent_llm.ainvoke([sys_msg] + list(state["messages"]))

                # Token usage recording
                usage_meta = getattr(response, "usage_metadata", None) or {}
                prompt_toks = usage_meta.get("input_tokens") or max(int((len(final_prompt) + sum(len(m.content) for m in state["messages"] if hasattr(m, 'content') and m.content)) / 4), 40)
                completion_toks = usage_meta.get("output_tokens") or max(int(len(response.content or "") / 4), 10)
                total_toks = usage_meta.get("total_tokens") or (prompt_toks + completion_toks)

                await record_usage_log(
                    db=db,
                    org_id=org_id,
                    conversation_id=state.get("conversation_id"),
                    node_name=agent_name,
                    model=model_name,
                    prompt_tokens=prompt_toks,
                    completion_tokens=completion_toks,
                    total_tokens=total_toks,
                )

                return {"messages": [response]}
            return agent_node

        workflow.add_node(
            agent.name,
            create_agent_node(
                agent_id=agent.id,
                agent_name=agent.name,
                sys_prompt=agent.system_prompt,
                tools=agent_langchain_tools,
                model_name=agent.model or "gpt-4o-mini",
                temperature=agent.temperature if agent.temperature is not None else 0.2
            )
        )

        if agent_langchain_tools:
            workflow.add_conditional_edges(agent.name, route_from_agent, {"pre_tool_guardrail_node": "pre_tool_guardrail_node", END: END})
        else:
            workflow.add_edge(agent.name, END)

    if all_tools_map:
        unique_tools = list(all_tools_map.values())
        base_tools_node = ToolNode(unique_tools)

        async def audit_tools_node(state: AgentState) -> dict:
            return await base_tools_node.ainvoke(state)

        workflow.add_node("tools", audit_tools_node)
        workflow.add_edge("tools", "supervisor_node")

    return workflow.compile(checkpointer=checkpointer)

# Backward-compatibility alias
async def build_graph(org_id: str, db: AsyncSession, checkpointer=None):
    return await build_bot_graph(org_id=org_id, db=db, bot_id=None, checkpointer=checkpointer)
