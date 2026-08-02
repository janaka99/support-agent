import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.db.models import Tool, User, agent_tools
from app.schemas.tool import ToolCreate, ToolUpdate, ToolResponse, ToolTestRequest, ToolTestResponse
from app.agent.tools.dynamic import execute_http_tool, BUILTIN_TOOLS

router = APIRouter(prefix="/tools", tags=["Tools Hub"])

@router.get("", response_model=List[ToolResponse])
async def list_tools(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List all tools belonging to the organization."""
    # Count of agents per tool
    stmt = (
        select(Tool, func.count(agent_tools.c.agent_id).label("agents_count"))
        .outerjoin(agent_tools, Tool.id == agent_tools.c.tool_id)
        .where(Tool.org_id == user.org_id)
        .group_by(Tool.id)
        .order_by(Tool.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    tool_responses = []
    for tool_obj, agents_count in rows:
        resp = ToolResponse.model_validate(tool_obj)
        resp.agents_count = agents_count
        tool_responses.append(resp)

    return tool_responses

@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(
    tool_in: ToolCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new tool (REST API, Webhook, RAG, Code, Builtin)."""
    # Check for duplicate tool name in org
    existing = await db.execute(
        select(Tool).where(Tool.org_id == user.org_id, Tool.name == tool_in.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A tool with name '{tool_in.name}' already exists in your organization."
        )

    tool = Tool(
        id=uuid.uuid4(),
        org_id=user.org_id,
        name=tool_in.name,
        display_name=tool_in.display_name,
        description=tool_in.description,
        tool_type=tool_in.tool_type,
        config=tool_in.config,
        parameters_schema=tool_in.parameters_schema
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)

    resp = ToolResponse.model_validate(tool)
    resp.agents_count = 0
    return resp

@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(
    tool_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get a specific tool."""
    stmt = (
        select(Tool, func.count(agent_tools.c.agent_id).label("agents_count"))
        .outerjoin(agent_tools, Tool.id == agent_tools.c.tool_id)
        .where(Tool.id == tool_id, Tool.org_id == user.org_id)
        .group_by(Tool.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    tool_obj, agents_count = row
    resp = ToolResponse.model_validate(tool_obj)
    resp.agents_count = agents_count
    return resp

@router.put("/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: uuid.UUID,
    tool_in: ToolUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update a tool definition."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id, Tool.org_id == user.org_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    update_data = tool_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tool, field, value)

    await db.commit()
    await db.refresh(tool)
    return ToolResponse.model_validate(tool)

@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    tool_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a tool."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id, Tool.org_id == user.org_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

    await db.delete(tool)
    await db.commit()
    return None

@router.post("/test", response_model=ToolTestResponse)
async def test_tool_execution(
    req: ToolTestRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Test tool execution with live inputs from the dashboard sandbox."""
    config = req.config
    tool_type = req.tool_type

    # If tool_id is provided, load its config
    if req.tool_id:
        result = await db.execute(select(Tool).where(Tool.id == req.tool_id, Tool.org_id == user.org_id))
        tool = result.scalar_one_or_none()
        if tool:
            config = tool.config
            tool_type = tool.tool_type

    try:
        if tool_type in ["http_request", "webhook"]:
            res = await execute_http_tool(config, req.parameters)
            return ToolTestResponse(
                success=res.get("success", False),
                status_code=res.get("status_code", 200),
                data=res.get("data"),
                error=res.get("error")
            )
        elif tool_type == "builtin":
            fn_name = config.get("function") or req.parameters.get("name")
            fn = BUILTIN_TOOLS.get(fn_name)
            if fn:
                if hasattr(fn, "ainvoke"):
                    data = await fn.ainvoke(req.parameters)
                elif hasattr(fn, "invoke"):
                    data = fn.invoke(req.parameters)
                else:
                    data = fn(**req.parameters)
                return ToolTestResponse(success=True, status_code=200, data=data)
            else:
                return ToolTestResponse(success=False, status_code=400, error=f"Builtin {fn_name} not found")
        elif tool_type == "code_sandbox":
            expr = req.parameters.get("code") or req.parameters.get("expression")
            val = eval(str(expr), {"__builtins__": {}}, {})
            return ToolTestResponse(success=True, status_code=200, data={"result": val})
        else:
            return ToolTestResponse(success=True, status_code=200, data={"echo": req.parameters})

    except Exception as e:
        return ToolTestResponse(success=False, status_code=500, error=str(e))
