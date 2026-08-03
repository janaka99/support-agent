from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List, Optional
import uuid
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_db, get_superuser_db, get_current_user
from app.core.auth import current_superuser
from app.db.models import User, AIModel
from app.core.config import settings
from app.core.models_registry import (
    MODEL_PROVIDERS,
    load_models_from_db,
    get_model_info,
    infer_model_capabilities,
    _serialize_model,
    update_model_cache,
)
from app.schemas.model import (
    ModelInfo,
    ModelCreate,
    ModelUpdate,
    ModelProviderInfo,
    ModelValidateRequest,
    ModelValidateResponse,
)

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=List[ModelInfo])
async def list_models(
    provider: Optional[str] = Query(None, description="Filter by provider slug e.g. openai, anthropic, google"),
    supports_tools: Optional[bool] = Query(None, description="Filter models that support tool calling"),
    search: Optional[str] = Query(None, description="Search query matching name, id, or tags"),
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(get_current_user),
):
    """
    List available models directly from the database catalog (accessible to all authenticated users).
    """
    models = await load_models_from_db(
        db=db,
        org_id=str(user.org_id) if hasattr(user, "org_id") else None,
        provider=provider,
        supports_tools=supports_tools,
        search=search,
    )
    return [ModelInfo(**m) for m in models]


@router.get("/providers", response_model=List[ModelProviderInfo])
async def list_providers(
    user: User = Depends(get_current_user),
):
    """
    List all supported model providers and their configuration status.
    """
    providers_info = []
    for p in MODEL_PROVIDERS:
        is_configured = True
        pid = p["id"]
        
        if pid == "openai":
            is_configured = bool(settings.OPENAI_API_KEY)
        elif pid == "anthropic":
            is_configured = bool(settings.ANTHROPIC_API_KEY or settings.OPENROUTER_API_KEY)
        elif pid == "google":
            is_configured = bool(settings.GOOGLE_API_KEY or settings.OPENROUTER_API_KEY)
        elif pid == "deepseek":
            is_configured = bool(settings.DEEPSEEK_API_KEY or settings.OPENROUTER_API_KEY)
        elif pid == "groq":
            is_configured = bool(settings.GROQ_API_KEY or settings.OPENROUTER_API_KEY)
        elif pid == "openrouter":
            is_configured = bool(settings.OPENROUTER_API_KEY)

        providers_info.append(
            ModelProviderInfo(
                id=p["id"],
                name=p["name"],
                description=p["description"],
                icon=p["icon"],
                is_configured=is_configured,
            )
        )
    return providers_info


@router.post("", response_model=ModelInfo, status_code=status.HTTP_201_CREATED)
async def create_model(
    model_in: ModelCreate,
    db: AsyncSession = Depends(get_superuser_db),
    user: User = Depends(current_superuser),
):
    """
    Add a new model to the platform database catalog.
    STRICT: Superadmin Only. Normal organizations cannot create platform models.
    """
    clean_model_id = model_in.model_id.strip()
    
    # Check if duplicate exists
    res = await db.execute(
        select(AIModel).where(AIModel.model_id == clean_model_id)
    )
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with identifier '{clean_model_id}' already exists in catalog."
        )

    provider_name = model_in.provider_name or model_in.provider.title()

    new_model = AIModel(
        id=uuid.uuid4(),
        org_id=None, # Global platform model managed by superadmin
        model_id=clean_model_id,
        name=model_in.name,
        provider=model_in.provider.lower(),
        provider_name=provider_name,
        context_window=model_in.context_window,
        supports_tools=model_in.supports_tools,
        supports_vision=model_in.supports_vision,
        supports_structured=model_in.supports_structured,
        prompt_cost_per_million=model_in.prompt_cost_per_million,
        completion_cost_per_million=model_in.completion_cost_per_million,
        description=model_in.description,
        tags=model_in.tags,
        is_default=model_in.is_default,
        is_active=model_in.is_active,
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    serialized = _serialize_model(new_model)
    update_model_cache([serialized])
    return ModelInfo(**serialized)


@router.get("/{model_id:path}", response_model=ModelInfo)
async def get_model(
    model_id: str,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(get_current_user),
):
    """
    Get model details from the database catalog or inferred capabilities.
    """
    clean_id = model_id.strip()
    res = await db.execute(
        select(AIModel).where(AIModel.model_id == clean_id)
    )
    row = res.scalar_one_or_none()
    if row:
        return ModelInfo(**_serialize_model(row))
        
    inferred = infer_model_capabilities(clean_id)
    return ModelInfo(**inferred)


@router.put("/{model_id:path}", response_model=ModelInfo)
async def update_model(
    model_id: str,
    model_in: ModelUpdate,
    db: AsyncSession = Depends(get_superuser_db),
    user: User = Depends(current_superuser),
):
    """
    Update model attributes in the database catalog.
    STRICT: Superadmin Only. Normal organizations cannot modify models.
    """
    clean_id = model_id.strip()
    res = await db.execute(
        select(AIModel).where(AIModel.model_id == clean_id)
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{clean_id}' not found in database catalog."
        )

    for field, val in model_in.model_dump(exclude_unset=True).items():
        setattr(row, field, val)

    await db.commit()
    await db.refresh(row)
    serialized = _serialize_model(row)
    update_model_cache([serialized])
    return ModelInfo(**serialized)


@router.delete("/{model_id:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: str,
    db: AsyncSession = Depends(get_superuser_db),
    user: User = Depends(current_superuser),
):
    """
    Delete a model from the platform catalog.
    STRICT: Superadmin Only. Normal organizations cannot delete models.
    """
    clean_id = model_id.strip()
    res = await db.execute(
        select(AIModel).where(AIModel.model_id == clean_id)
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{clean_id}' not found."
        )

    await db.delete(row)
    await db.commit()
    return None


@router.post("/validate", response_model=ModelValidateResponse)
async def validate_model(
    req: ModelValidateRequest,
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(get_current_user),
):
    """
    Validates a model ID against the database catalog and checks tool compatibility.
    """
    clean_id = req.model_id.strip()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_id cannot be empty."
        )

    res = await db.execute(
        select(AIModel).where(AIModel.model_id == clean_id)
    )
    row = res.scalar_one_or_none()
    if row:
        info_dict = _serialize_model(row)
    else:
        info_dict = infer_model_capabilities(clean_id)

    model_info = ModelInfo(**info_dict)
    warning = None

    if req.require_tools and not model_info.supports_tools:
        warning = (
            f"Warning: Model '{model_info.name}' may not natively support OpenAI/Anthropic "
            "function calling tools. Specialist agent execution could degrade."
        )

    return ModelValidateResponse(
        is_valid=True,
        model=model_info,
        warning=warning,
    )
