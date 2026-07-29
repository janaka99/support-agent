# Cleanup & Professional Rebuild Roadmap

A step-by-step guide to transform this into a polished, production-grade SaaS platform. Each step has a clear before/after, and can be executed and reviewed independently.

---

## Current State Assessment

**Backend (FastAPI):** Solid foundation — multi-tenancy, RLS, JWT auth, Agent CRUD, pgvector RAG all work. But schemas are scattered, no proper env separation, seed data is hardcoded.

**Frontend (Next.js):** Bare bones — a single test chat component, one admin page with inline auth, no routing, no layout, no auth context.

**Missing:** Auth flow, organization signup, proper navigation, professional dashboard, API client layer, environment-aware config.

---

## Step 1 — Server: Create a Backend Rules Skill

**What:** Write a `server-rules` skill that documents how every future backend file should be written: file naming, where routes go, how to write schemas, how to use `get_tenant_db` vs `get_superuser_db`, how to add migrations. This prevents drift.

**Why first:** Every subsequent backend step will follow these rules.

**Deliverable:** `server/AGENTS.md` + `.agents/skills/server-rules/SKILL.md`

---

## Step 2 — Frontend: Create a Web Rules Skill + Install UI Foundation

**What:** Create a `web-rules` skill for the frontend. Then install the missing packages needed for a proper SaaS dashboard:

- `lucide-react` for icons
- `@tanstack/react-query` for server state / caching API calls
- `clsx` + `tailwind-merge` for style utilities
- `zod` for form validation
- `react-hook-form` for form management

**Why:** The current frontend has zero dependencies beyond Next.js and React. Building a professional dashboard on those alone is painful.

**Deliverable:** `.agents/skills/web-rules/SKILL.md`, updated `package.json`

---

## Step 3 — Frontend: Auth Context + API Client Layer

**What:** Create two foundational modules before any UI page:

1. **`web/lib/api.ts`** — A single typed API client. All `fetch()` calls go here. Has `getToken()` helper, sets `Authorization` header everywhere, handles 401s.
2. **`web/contexts/auth.tsx`** — A React context that stores `{ user, token, org }` from the JWT, exposes `login()` and `logout()`, persists token to `localStorage`.

**Why:** Right now token management is copy-pasted inline into a single page. Every future page would repeat this. A central auth context fixes it once.

**Deliverable:** `web/lib/api.ts`, `web/contexts/auth.tsx`, `web/app/layout.tsx` wraps children in `<AuthProvider>`

---

## Step 4 — Frontend: Login Page (`/login`)

**What:** Replace the ad-hoc inline login inside the agent builder with a proper, standalone `/login` route.

- Clean login form (email + password)
- Calls `POST /api/v1/auth/login` via the API client
- On success: stores token in auth context, redirects to `/dashboard`
- On fail: shows inline error
- If already logged in: redirects away from `/login` immediately

**Deliverable:** `web/app/(auth)/login/page.tsx`, route guard middleware

---

## Step 5 — Backend: Org Self-Registration Endpoint

**What:** Add `POST /api/v1/register` — a public endpoint that allows a *new business owner* to sign up by providing:
- Organization name
- Their name / email / password

This endpoint creates the `Org` + their user (`role=admin`) in one transaction, and returns a JWT.

**Why:** Currently, only a platform superuser (`GET /superuser/orgs`) can create orgs. There's no way for a business to sign up on their own. This is the core of a SaaS model.

**Deliverable:** `POST /api/v1/register`, updated seed to remove hardcoded acme org

---

## Step 6 — Frontend: Organization Signup Page (`/register`)

**What:** A public registration page where a new business owner enters:
- Company name
- Email + password
- On success: logs them in and redirects to `/dashboard`

**Deliverable:** `web/app/(auth)/register/page.tsx`

---

## Step 7 — Frontend: Dashboard Shell + Navigation

**What:** Build the permanent dashboard layout that wraps all authenticated pages:

- **Sidebar:** Logo, navigation links (Dashboard, Agents, Team Members, Settings), org name badge, logout button
- **Top bar:** Page title, user avatar/menu
- **Protected route logic:** Middleware redirects unauthenticated users to `/login`

**Why:** Every page built after this lives inside this shell. Without it, each page would need to re-invent navigation.

**Deliverable:** `web/app/(dashboard)/layout.tsx`, `web/components/sidebar.tsx`, `web/middleware.ts`

---

## Step 8 — Frontend: Dashboard Home (`/dashboard`)

**What:** The first page after login — a clean stats overview:

- Total agents created
- Total conversations
- Quick action: "Create new agent" button
- Recent agents list

**Deliverable:** `web/app/(dashboard)/dashboard/page.tsx`

---

## Step 9 — Frontend: Agents Page — Full List + CRUD

**What:** Replace the prototype at `/admin/agents` with a proper agents section:

- **`/dashboard/agents`** — Lists all agents for the org with cards (name, specialization, tool count, doc count). Has an "Add Agent" button.
- **`/dashboard/agents/new`** — The create form (cleaned up from current prototype)
- **`/dashboard/agents/[id]`** — Edit an existing agent (loads current data, PUT on submit)
- **Delete** with a confirmation dialog

**Deliverable:** 3 new routes under `(dashboard)/agents/`

---

## Step 10 — Frontend: Team Members Page (`/dashboard/team`)

**What:** Org admins can invite/create team member accounts:

- Table of all users in the org (email, role, joined date)
- "Add Member" form: email + temporary password
- Remove member (with confirmation)

**Why:** The `POST /api/v1/org/users` endpoint already exists on the backend — it just has no UI.

**Deliverable:** `web/app/(dashboard)/team/page.tsx`

---

## Step 11 — Frontend: Settings Page (`/dashboard/settings`)

**What:** Basic organization settings:

- Org name (editable)
- Danger zone: delete org (UI pattern exists but action disabled)

**Deliverable:** `web/app/(dashboard)/settings/page.tsx`

---

## Step 12 — Frontend: The Customer Chat Widget (Public)

**What:** Rebuild the prototype chat as a proper embeddable widget at `/chat`:

- Clean, branded chat UI
- Picks up `org_id` from query param
- No auth required (end-customer-facing)

**Why:** The admin dashboard and the end-user chat are two completely different UIs. Right now they're conflated.

**Deliverable:** `web/app/(public)/chat/page.tsx`, cleaned up `chat.tsx` component

---

## Step 13 — Backend: Final Cleanup Pass

**What:**
- Move inline schemas (`OrgCreate`) into proper `schemas/` files
- Add `created_at` to `Org` model
- Validate all routes use the right dependency
- Ensure all error responses are consistently shaped: `{"detail": "..."}`
- Update `seed.py` to only seed the platform superuser

**Deliverable:** Cleaned up backend

---

## Step 14 — Documentation Pass

**Deliverable:** Updated `README.md` reflecting actual architecture

---

## Recommended Execution Order

> **Execute in exactly this sequence. Each step is a working, shippable increment.**

| # | Step | What you can test after |
|---|------|------------------------|
| 1 | Server skill | Backend rules documented |
| 2 | Web skill + deps | `npm install` works |
| 3 | Auth context + API client | Token persists |
| 4 | Login page | Can log in and get redirected |
| 5 | Self-register endpoint | `curl POST /register` works |
| 6 | Register page | Can sign up from browser |
| 7 | Dashboard shell | Layout with sidebar renders |
| 8 | Dashboard home | Stats page loads |
| 9 | Agents full CRUD | Create/edit/delete agents |
| 10 | Team members | Invite teammates |
| 11 | Settings | Edit org name |
| 12 | Chat widget | Public chat at `/chat` |
| 13 | Backend cleanup | All routes consistent |
| 14 | Docs | README up to date |

## User Review Required
> [!IMPORTANT]
> - I will modify the dynamic graph builder (`server/app/agent/graph.py`) so that each specialist agent automatically performs a similarity search against its own `documents` before talking to the LLM. 
> - If documents are found, they will be injected directly into the agent's System Prompt as "Knowledge Base Context".

## Proposed Changes

---

### [MODIFY] `server/app/agent/graph.py`
We will update the `create_agent_node` closure to accept the `agent.id` and perform the RAG retrieval.
- **Extract latest query**: Get the most recent user message from the LangGraph state.
- **Generate Embedding**: Use `OpenAIEmbeddings` to embed the user's message.
- **Similarity Search**: Query the `Document` table where `agent_id == agent.id` and order by cosine distance (`<=>`), limiting to the top 2 or 3 chunks.
- **Prompt Injection**: If relevant chunks are found, append them to the agent's `sys_prompt` before calling `agent_llm.ainvoke`.

### [MODIFY] `server/scripts/test_chat.py` (or similar regression test script)
- We will perform a regression test to ensure Week 1's basic routing scenarios still work, and then specifically test the "Refund Specialist" to see if it correctly quotes the FAQ document we uploaded in our `pgvector` test.

---

## Verification Plan

### Automated/Manual Testing
1. Use `test_chat.py` or the Chat UI to ask the agent a question like "Can I get a refund in cash?".
2. Verify that the agent answers "No, refunds are only issued to the original payment method" based exclusively on the indexed document, rather than a generic hallucinated answer.
3. Verify that general questions without document matches fall back gracefully to their standard system prompt.
