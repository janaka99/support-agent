import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def test_rls():
    engine = create_async_engine(settings.async_database_url)
    
    async with engine.connect() as conn:
        # Generate a totally random org_id that doesn't exist
        malicious_org_id = str(uuid.uuid4())
        
        # Set the current_setting context for this transaction
        await conn.execute(text(f"SET LOCAL app.current_org = '{malicious_org_id}'"))
        
        # Now try to select all users
        result = await conn.execute(text("SELECT id, email, org_id FROM users"))
        users = result.fetchall()
        
        # Now try to select all conversations
        result_conv = await conn.execute(text("SELECT id, title, org_id FROM conversations"))
        convs = result_conv.fetchall()
        
        print(f"--- RLS BYPASS TEST ---")
        print(f"Malicious Org ID Context: {malicious_org_id}")
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  - User: {u[1]} (Org: {u[2]})")
            
        print(f"Conversations found: {len(convs)}")
        for c in convs:
            print(f"  - Conv: {c[1]} (Org: {c[2]})")
            
        if len(users) > 0 or len(convs) > 0:
            print("\n🚨 VULNERABILITY DETECTED: RLS WAS BYPASSED! 🚨")
            print("The application is returning data for an org_id that does not match the session context!")
            print("Reason: You are likely connecting as the 'postgres' superuser or table owner without FORCE ROW LEVEL SECURITY enabled.")
        else:
            print("\n✅ SECURE: RLS successfully blocked cross-tenant access.")

if __name__ == "__main__":
    asyncio.run(test_rls())
