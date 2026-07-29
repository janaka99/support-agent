import asyncio
import sys
import uuid
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import async_session_maker
from app.db.models import Org, User
from fastapi_users.password import PasswordHelper

async def provision_org(org_name: str, admin_email: str):
    async with async_session_maker() as session:
        # Check if user already exists
        existing_user = await session.execute(select(User).where(User.email == admin_email))
        if existing_user.scalar_one_or_none():
            print(f"Error: A user with email {admin_email} already exists.")
            return

        # Generate secure random password
        # e.g., 'aB3_9xPq1LmN'
        raw_password = secrets.token_urlsafe(12)
        
        password_helper = PasswordHelper()
        hashed_password = password_helper.hash(raw_password)

        # Create the organization
        org_id = uuid.uuid4()
        org = Org(id=org_id, name=org_name)
        
        # Create the admin user for this org
        user_id = uuid.uuid4()
        user = User(
            id=user_id, 
            org_id=org_id, 
            email=admin_email, 
            hashed_password=hashed_password,
            role="admin",
            is_active=True,
            is_superuser=False,
            is_verified=True
        )
        
        session.add(org)
        session.add(user)
        
        await session.commit()
        
        print("\n" + "="*50)
        print("✅ ORGANIZATION PROVISIONED SUCCESSFULLY")
        print("="*50)
        print(f"Organization: {org_name}")
        print(f"Org ID:       {org_id}")
        print("-" * 50)
        print("ADMIN CREDENTIALS (Send these to the business owner):")
        print(f"Email:        {admin_email}")
        print(f"Password:     {raw_password}")
        print("="*50 + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m scripts.provision_org \"<Org Name>\" <admin_email>")
        sys.exit(1)
        
    org_name = sys.argv[1]
    admin_email = sys.argv[2]
    
    asyncio.run(provision_org(org_name, admin_email))
