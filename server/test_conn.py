import asyncio
import asyncpg

async def main():
    creds = [
        ('postgres', 'postgres'),
        ('postgres', 'password'),
        ('user', 'password'),
        ('postgres', ''),
        ('postgres', 'root')
    ]
    for user, pwd in creds:
        try:
            conn = await asyncpg.connect(f'postgresql://{user}:{pwd}@127.0.0.1:5432/mydb')
            print(f"Success {user}:{pwd} for mydb")
            await conn.close()
            return
        except Exception as e:
            print(f"Failed {user}:{pwd} for mydb:", type(e).__name__)
        
        try:
            conn = await asyncpg.connect(f'postgresql://{user}:{pwd}@127.0.0.1:5432/postgres')
            print(f"Success {user}:{pwd} for postgres")
            await conn.close()
            return
        except Exception as e:
            print(f"Failed {user}:{pwd} for postgres:", type(e).__name__)

asyncio.run(main())
