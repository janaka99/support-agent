import uuid
import re
import json
import logging
from typing import Dict, Any, Type, Optional, Callable
import httpx
from pydantic import BaseModel, create_model, Field
from langchain_core.tools import StructuredTool
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Tool, AuditLog, KnowledgeBase, KnowledgeDocument, DocumentChunk
from app.services.document_parser import generate_single_embedding
from sqlalchemy import select
from app.agent.tools.orders import get_order_status, get_order_history
from app.agent.tools.payment import check_payment_status, process_refund
from app.agent.tools.system import escalate_to_human

logger = logging.getLogger(__name__)

# Builtin python tool implementations
BUILTIN_TOOLS: Dict[str, Callable] = {
    "lookup_order": get_order_status,
    "get_order_status": get_order_status,
    "get_order_history": get_order_history,
    "process_refund": process_refund,
    "check_payment_status": check_payment_status,
    "escalate_to_human": escalate_to_human,
}

def json_schema_to_pydantic(schema: Dict[str, Any], model_name: str = "DynamicToolInput") -> Type[BaseModel]:
    """Dynamically construct a Pydantic model class from a JSON Schema object."""
    if not schema or not isinstance(schema, dict) or "properties" not in schema:
        # Generic fallback
        return create_model(model_name)

    fields: Dict[str, Any] = {}
    required_fields = set(schema.get("required", []))
    properties = schema.get("properties", {})

    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }

    for prop_name, prop_spec in properties.items():
        json_type = prop_spec.get("type", "string")
        py_type = type_mapping.get(json_type, str)
        description = prop_spec.get("description", "")
        default_val = prop_spec.get("default", ...)

        if prop_name in required_fields:
            fields[prop_name] = (py_type, Field(..., description=description))
        else:
            fields[prop_name] = (Optional[py_type], Field(default=default_val if default_val is not ... else None, description=description))

    return create_model(model_name, **fields)

async def execute_http_tool(config: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute an external REST API or Webhook tool via HTTP."""
    url_template = config.get("url", "")
    method = config.get("method", "GET").upper()
    headers = config.get("headers", {})
    body_template = config.get("body_template", None)
    timeout = config.get("timeout_seconds", 10.0)

    # 1. Path parameter substitution: e.g. https://api.example.com/orders/{order_id}
    url = url_template
    used_params = set()
    for match in re.findall(r'\{([a-zA-Z0-9_]+)\}', url_template):
        if match in params:
            url = url.replace(f"{{{match}}}", str(params[match]))
            used_params.add(match)

    # 2. Query / Body preparation
    remaining_params = {k: v for k, v in params.items() if k not in used_params}
    
    query_params = None
    json_body = None

    if method in ["GET", "DELETE"]:
        query_params = remaining_params
    else:
        if body_template and isinstance(body_template, str):
            # String interpolation
            body_str = body_template
            for k, v in params.items():
                body_str = body_str.replace(f"{{{k}}}", str(v))
            try:
                json_body = json.loads(body_str)
            except Exception:
                json_body = body_str
        elif body_template and isinstance(body_template, dict):
            json_body = {**body_template, **remaining_params}
        else:
            json_body = remaining_params

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.request(
                method=method,
                url=url,
                params=query_params,
                json=json_body if isinstance(json_body, (dict, list)) else None,
                content=json_body if isinstance(json_body, str) else None,
                headers=headers
            )
            try:
                data = response.json()
            except Exception:
                data = {"text": response.text}

            return {
                "status_code": response.status_code,
                "data": data,
                "success": response.is_success
            }
        except Exception as e:
            logger.error(f"HTTP tool execution failed for {url}: {e}")
            return {
                "status_code": 500,
                "error": str(e),
                "success": False
            }


async def execute_rag_retriever(
    config: dict,
    params: dict,
    db: Optional[AsyncSession],
    org_id: Optional[str]
) -> dict:
    """Executes a semantic vector similarity search against a specific KnowledgeBase."""
    if not db or not org_id:
        return {"error": "Database session or Organization context not available for RAG search."}

    kb_id_str = config.get("kb_id")
    if not kb_id_str:
        return {"error": "No Knowledge Base configured for this tool."}

    try:
        kb_id = uuid.UUID(str(kb_id_str))
        tenant_org_id = uuid.UUID(str(org_id))
    except Exception as parse_err:
        return {"error": f"Invalid Knowledge Base or Organization ID: {parse_err}"}

    top_k = int(config.get("top_k", 4))
    similarity_threshold = float(config.get("similarity_threshold", 0.0))
    query_text = params.get("query") or params.get("search_query") or params.get("text") or params.get("q") or str(params)

    # 1. Fetch KB embedding model
    kb_res = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == tenant_org_id
        )
    )
    kb = kb_res.scalar_one_or_none()
    if not kb:
        return {"error": f"Knowledge base '{kb_id}' not found."}

    # 2. Embed query
    query_embedding = await generate_single_embedding(
        text=str(query_text),
        model_name=kb.embedding_model
    )

    # 3. Query pgvector
    cosine_distance = DocumentChunk.embedding.cosine_distance(query_embedding)
    stmt = (
        select(
            DocumentChunk,
            KnowledgeDocument.title.label("doc_title"),
            cosine_distance.label("distance")
        )
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(
            DocumentChunk.kb_id == kb_id,
            DocumentChunk.org_id == tenant_org_id
        )
        .order_by(cosine_distance.asc())
        .limit(top_k)
    )
    result = await db.execute(stmt)
    rows = result.all()

    matches = []
    for chunk_obj, doc_title, distance in rows:
        sim_score = max(0.0, min(1.0, 1.0 - float(distance)))
        if sim_score >= similarity_threshold:
            matches.append({
                "document_title": doc_title,
                "content": chunk_obj.content,
                "similarity_score": round(sim_score, 4),
                "chunk_index": chunk_obj.chunk_index
            })

    if not matches:
        return {
            "query": str(query_text),
            "knowledge_base": kb.name,
            "results_count": 0,
            "results": [],
            "message": "No relevant policy or document chunks found in this knowledge base."
        }

    return {
        "query": str(query_text),
        "knowledge_base": kb.name,
        "results_count": len(matches),
        "results": matches
    }


def create_langchain_tool(
    tool_model: Tool,
    db: Optional[AsyncSession] = None,
    org_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    agent_id: Optional[str] = None
) -> StructuredTool:
    """Builds an executable LangChain StructuredTool from a database Tool entity."""
    input_schema = json_schema_to_pydantic(tool_model.parameters_schema, model_name=f"{tool_model.name}_Input")

    async def _tool_executor(**kwargs) -> Any:
        tool_type = tool_model.tool_type
        result = None

        try:
            if tool_type == "builtin":
                builtin_fn = BUILTIN_TOOLS.get(tool_model.name)
                if builtin_fn:
                    # Some builtins are LangChain tool wrappers
                    if hasattr(builtin_fn, "ainvoke"):
                        result = await builtin_fn.ainvoke(kwargs)
                    elif hasattr(builtin_fn, "invoke"):
                        result = builtin_fn.invoke(kwargs)
                    elif callable(builtin_fn):
                        import inspect
                        if inspect.iscoroutinefunction(builtin_fn):
                            result = await builtin_fn(**kwargs)
                        else:
                            result = builtin_fn(**kwargs)
                else:
                    result = {"error": f"Builtin function '{tool_model.name}' not found."}

            elif tool_type in ["http_request", "webhook"]:
                result = await execute_http_tool(tool_model.config, kwargs)

            elif tool_type == "rag_retriever":
                result = await execute_rag_retriever(
                    config=tool_model.config,
                    params=kwargs,
                    db=db,
                    org_id=org_id
                )

            elif tool_type == "code_sandbox":
                # Safe evaluation for math/expressions
                expr = kwargs.get("code") or kwargs.get("expression")
                result = {"result": eval(str(expr), {"__builtins__": {}}, {})}

            else:
                result = {"status": "executed", "params": kwargs}

        except Exception as e:
            logger.error(f"Tool execution exception for {tool_model.name}: {e}")
            result = {"error": str(e), "success": False}

        # Write audit log if db session is provided
        if db and org_id:
            try:
                audit = AuditLog(
                    id=uuid.uuid4(),
                    org_id=uuid.UUID(str(org_id)),
                    agent_id=uuid.UUID(str(agent_id)) if agent_id else None,
                    conversation_id=uuid.UUID(str(conversation_id)) if conversation_id else None,
                    tool_name=tool_model.name,
                    input=kwargs,
                    output=result if isinstance(result, (dict, list)) else {"output": str(result)}
                )
                db.add(audit)
                await db.flush()
            except Exception as log_err:
                logger.warning(f"Failed to write audit log: {log_err}")

        return result

    return StructuredTool.from_function(
        coroutine=_tool_executor,
        name=tool_model.name,
        description=tool_model.description,
        args_schema=input_schema
    )
