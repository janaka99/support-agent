from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import sqlalchemy as sa
from pydantic import BaseModel

from app.api.deps import get_tenant_db
from app.core.auth import current_active_user
from app.db.models import UsageLog, Conversation, User

router = APIRouter()


class DailyUsageItem(BaseModel):
    date: str
    tokens: int
    cost_usd: float
    requests: int


class ModelBreakdownItem(BaseModel):
    model: str
    tokens: int
    cost_usd: float
    percentage: float


class ConversationCostItem(BaseModel):
    conversation_id: str
    title: Optional[str] = None
    status: str
    total_tokens: int
    cost_usd: float
    last_active: str


class AnalyticsOverviewResponse(BaseModel):
    total_tokens: int
    total_cost_usd: float
    total_conversations: int
    avg_cost_per_conversation: float
    avg_tokens_per_conversation: float
    daily_cost_history: List[DailyUsageItem]
    model_breakdown: List[ModelBreakdownItem]
    recent_conversations: List[ConversationCostItem]


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(current_active_user),
):
    org_id = user.org_id

    # 1. Total tokens & total cost for org
    total_stmt = (
        select(
            func.coalesce(func.sum(UsageLog.total_tokens), 0),
            func.coalesce(func.sum(UsageLog.cost_usd), 0.0),
        )
        .where(UsageLog.org_id == org_id)
    )
    total_res = await db.execute(total_stmt)
    total_tokens, total_cost_usd = total_res.one()
    total_tokens = int(total_tokens)
    total_cost_usd = float(total_cost_usd)

    # 2. Total conversations count for org
    conv_stmt = (
        select(func.count(Conversation.id))
        .where(Conversation.org_id == org_id)
    )
    conv_res = await db.execute(conv_stmt)
    total_conversations = int(conv_res.scalar_one_or_none() or 0)

    avg_cost = round(total_cost_usd / total_conversations, 6) if total_conversations > 0 else 0.0
    avg_tokens = round(total_tokens / total_conversations, 1) if total_conversations > 0 else 0.0

    # 3. Daily history for last 14 days
    fourteen_days_ago = datetime.utcnow() - timedelta(days=14)
    day_expr = func.cast(UsageLog.created_at, sa.Date)
    daily_stmt = (
        select(
            day_expr.label('day'),
            func.sum(UsageLog.total_tokens).label('daily_tokens'),
            func.sum(UsageLog.cost_usd).label('daily_cost'),
            func.count(UsageLog.id).label('request_count'),
        )
        .where(UsageLog.org_id == org_id, UsageLog.created_at >= fourteen_days_ago)
        .group_by(day_expr)
        .order_by(day_expr)
    )
    daily_res = await db.execute(daily_stmt)
    daily_rows = daily_res.all()
    
    daily_map = {
        row.day.strftime("%Y-%m-%d"): {
            "tokens": int(row.daily_tokens or 0),
            "cost_usd": round(float(row.daily_cost or 0.0), 6),
            "requests": int(row.request_count or 0),
        }
        for row in daily_rows if row.day
    }

    # Generate full 14-day list even with 0-days
    daily_history = []
    for i in range(13, -1, -1):
        day_date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        item = daily_map.get(day_date, {"tokens": 0, "cost_usd": 0.0, "requests": 0})
        daily_history.append(
            DailyUsageItem(
                date=day_date,
                tokens=item["tokens"],
                cost_usd=item["cost_usd"],
                requests=item["requests"],
            )
        )

    # 4. Model Breakdown
    model_stmt = (
        select(
            UsageLog.model,
            func.sum(UsageLog.total_tokens).label('model_tokens'),
            func.sum(UsageLog.cost_usd).label('model_cost'),
        )
        .where(UsageLog.org_id == org_id)
        .group_by(UsageLog.model)
    )
    model_res = await db.execute(model_stmt)
    model_rows = model_res.all()

    model_breakdown = []
    for r in model_rows:
        m_tokens = int(r.model_tokens or 0)
        m_cost = round(float(r.model_cost or 0.0), 6)
        pct = round((m_cost / total_cost_usd * 100), 1) if total_cost_usd > 0 else 0.0
        model_breakdown.append(
            ModelBreakdownItem(
                model=r.model or "unknown",
                tokens=m_tokens,
                cost_usd=m_cost,
                percentage=pct,
            )
        )

    # 5. Recent conversations with per-conversation cost
    recent_conv_stmt = (
        select(Conversation)
        .where(Conversation.org_id == org_id)
        .order_by(desc(Conversation.id))
        .limit(10)
    )
    recent_conv_res = await db.execute(recent_conv_stmt)
    recent_conversations_db = recent_conv_res.scalars().all()

    recent_conversations = []
    for c in recent_conversations_db:
        # Sum cost for this conversation
        c_usage_stmt = (
            select(
                func.coalesce(func.sum(UsageLog.total_tokens), 0),
                func.coalesce(func.sum(UsageLog.cost_usd), 0.0),
                func.max(UsageLog.created_at)
            )
            .where(UsageLog.conversation_id == c.id)
        )
        c_usage_res = await db.execute(c_usage_stmt)
        c_tokens, c_cost, c_last_time = c_usage_res.one()
        
        last_active_str = (c_last_time.strftime("%b %d, %H:%M") if c_last_time else "Recently")

        recent_conversations.append(
            ConversationCostItem(
                conversation_id=str(c.id),
                title=c.title or "Support Conversation",
                status=c.status or "open",
                total_tokens=int(c_tokens),
                cost_usd=round(float(c_cost), 6),
                last_active=last_active_str,
            )
        )

    return AnalyticsOverviewResponse(
        total_tokens=total_tokens,
        total_cost_usd=round(total_cost_usd, 6),
        total_conversations=total_conversations,
        avg_cost_per_conversation=avg_cost,
        avg_tokens_per_conversation=avg_tokens,
        daily_cost_history=daily_history,
        model_breakdown=model_breakdown,
        recent_conversations=recent_conversations,
    )
