import uuid
from fastapi_users import schemas

class UserRead(schemas.BaseUser[uuid.UUID]):
    org_id: uuid.UUID
    role: str

class UserCreate(schemas.BaseUserCreate):
    org_id: uuid.UUID
    role: str = "member"

class UserUpdate(schemas.BaseUserUpdate):
    role: str | None = None
