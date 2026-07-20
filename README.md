# Support Agent Project

This is a single-tenant chat application featuring a supervisor agent and multiple specialist agents, built with FastAPI (backend) and Next.js (frontend).

## Tech Stack
- **Frontend:** Next.js (React), TailwindCSS
- **Backend:** FastAPI, Python 3.11
- **Infrastructure:** Docker, PostgreSQL, Redis

## How to Run Locally

1. Copy the example environment file and fill in your actual API keys:
   ```bash
   cp .env.example .env
   ```
   *(Ensure you use a valid OpenAI API key)*

2. Start the entire stack using Docker Compose:
   ```bash
   cd infra
   docker-compose up --build
   ```

3. Access the applications:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Current State (Week 1)
- Project skeleton initialized.
- Backend API and Next.js frontend running in Docker with hot-reloading.
- Simple synchronous request/response routing.

### Deliberately Not Built Yet (Explicit Non-Goals for Week 1)
- **Multi-tenancy:** We are building for a single org first. Adding it ad-hoc now creates rework.
- **Streaming:** Synchronous request/response is used for now; streaming will be added in Week 3 alongside the queue architecture.
- **Evals:** Evaluation sets will be built out in later stages once routing paths are finalized.
