from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_superuser_db
from app.db.models import Org
from app.schemas.user import UserCreate
from app.core.user_manager import get_user_manager, UserManager
from pydantic import BaseModel

class OrgCreate(BaseModel):
    name: str
    admin_email: str
    admin_password: str

router = APIRouter()

@router.post("/orgs", status_code=status.HTTP_201_CREATED)
async def create_org(
    org_in: OrgCreate,
    db: AsyncSession = Depends(get_superuser_db),
    user_manager: UserManager = Depends(get_user_manager)
):
    # Create Org
    new_org = Org(name=org_in.name)
    db.add(new_org)
    await db.commit()
    await db.refresh(new_org)

    # Create User
    user_create = UserCreate(
        email=org_in.admin_email,
        password=org_in.admin_password,
        org_id=new_org.id,
        role="admin"
    )
    
    try:
        user = await user_manager.create(user_create, safe=True)
        return {"org_id": new_org.id, "admin_user_id": user.id, "message": "Org and Admin created successfully. An email would be sent here."}
    except Exception as e:
        # Rollback org creation if user creation fails
        await db.delete(new_org)
        await db.commit()
        raise HTTPException(status_code=400, detail=str(e))

from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid

@router.get("/orgs")
async def list_orgs(db: AsyncSession = Depends(get_superuser_db)):
    result = await db.execute(
        select(Org).options(selectinload(Org.users), selectinload(Org.agents))
    )
    orgs = result.scalars().all()
    
    return [
        {
            "id": str(org.id),
            "name": org.name,
            "member_count": len(org.users),
            "agent_count": len(org.agents)
        }
        for org in orgs
    ]

@router.get("/orgs/{org_id}")
async def get_org(org_id: uuid.UUID, db: AsyncSession = Depends(get_superuser_db)):
    result = await db.execute(
        select(Org)
        .options(selectinload(Org.users), selectinload(Org.agents))
        .where(Org.id == org_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    return {
        "id": str(org.id),
        "name": org.name,
        "users": [{"id": str(u.id), "email": u.email, "role": u.role} for u in org.users],
        "agents": [{"id": str(a.id), "name": a.name} for a in org.agents]
    }

