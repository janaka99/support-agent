import subprocess
import sys

def run_command(command):
    print(f"Running: {command}")
    subprocess.run(command, shell=True, check=True)

def main():
    if len(sys.argv) < 2:
        print("Usage: python manage.py [command]")
        print("\nCommands:")
        print("  migrate [msg]    - Generate a new database migration")
        print("  upgrade          - Apply pending migrations to the database")
        print("  seed             - Run the database seed script")
        print("  test             - Run internal route tests")
        print("  dev              - Run the FastAPI development server")
        print("  provision        - Provision a new org: python manage.py provision \"Org Name\" email@domain.com")
        sys.exit(1)

    cmd = sys.argv[1]

    try:
        if cmd == "migrate":
            msg = sys.argv[2] if len(sys.argv) > 2 else "auto-migration"
            run_command(f'python -m alembic revision --autogenerate -m "{msg}"')
        elif cmd == "upgrade":
            run_command('python -m alembic upgrade head')
        elif cmd == "seed":
            run_command('python -m scripts.seed')
        elif cmd == "test":
            run_command('python -m scripts.test_chat')
        elif cmd == "dev":
            run_command('python -m uvicorn app.main:app --reload')
        elif cmd == "provision":
            if len(sys.argv) < 4:
                print("Error: Missing arguments for provision.")
                print("Usage: python manage.py provision \"<Org Name>\" <admin_email>")
                sys.exit(1)
            org_name = sys.argv[2]
            admin_email = sys.argv[3]
            run_command(f'python -m scripts.provision_org "{org_name}" "{admin_email}"')
        else:
            print(f"Unknown command: {cmd}")
    except subprocess.CalledProcessError as e:
        print(f"\nCommand failed with exit code {e.returncode}")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
