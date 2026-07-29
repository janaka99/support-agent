from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_tenant_db
from app.core.auth import current_active_user
from app.db.models import User
from app.schemas.user import UserCreate
from app.core.user_manager import get_user_manager, UserManager
from pydantic import BaseModel

class OrgUserCreate(BaseModel):
    email: str
    password: str

router = APIRouter()

@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_org_user(
    user_in: OrgUserCreate,
    current_user: User = Depends(current_active_user),
    user_manager: UserManager = Depends(get_user_manager)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can create users.")

    user_create = UserCreate(
        email=user_in.email,
        password=user_in.password,
        org_id=current_user.org_id,
        role="member"
    )
    
    try:
        user = await user_manager.create(user_create, safe=True)
        return {"user_id": user.id, "message": "User created successfully. An email would be sent here."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

@router.get("/users")
async def list_org_users(
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    result = await db.execute(select(User).where(User.org_id == current_user.org_id))
    users = result.scalars().all()
    return [{"id": str(u.id), "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_user(
    user_id: uuid.UUID,
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can remove users.")
        
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself.")

    result = await db.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    user_to_delete = result.scalar_one_or_none()
    
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.delete(user_to_delete)
    await db.commit()

