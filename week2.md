# Week 2 — Multi-Tenancy + Agent Builder

**Dates:** Mon Jul 27 – Sun Aug 2, 2026
**Layers in scope:** Data & Tenancy (full) → Agent Config
**Goal by Sunday night:** Any organization can sign up, log in, and build its own agents from a UI — agents are config rows in the database, not hardcoded code, and one org's data is provably invisible to another.

---

## System Design for This Week

![Week 2 system design diagram](week2-diagram.png)

The core idea this week: **agents-as-config, not agents-as-code.** Everything that made Week 1's supervisor/specialist pattern work gets rebuilt so it's assembled dynamically from a database row instead of hardcoded Python. This is the single most "platform-y" idea in the whole project and the part worth demoing carefully.

---

## Prerequisites / Resources

- Postgres Row-Level Security docs: [postgresql.org/docs/current/ddl-rowsecurity.html](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- pgvector: [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- Pick an auth approach now: rolling your own JWT flow, or a hosted option (Clerk/Auth0) to save a week's worth of edge cases. Either is defensible — just document why.

---

## Monday (2h) — Multi-Tenant Schema Redesign

**Goal:** Every table knows which org it belongs to.

- Add `org_id` (FK) to every existing table.
- New `agents` table: `id, org_id, name, specialization, system_prompt, model, tools (jsonb), guardrails (jsonb), routing_examples (jsonb), created_at`.
- Enable RLS on every tenant-scoped table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with a policy like `USING (org_id = current_setting('app.current_org')::uuid)`.

**Definition of done:** Attempting to query another org's rows returns nothing, even with a raw SQL query, unless the session variable is set to that org.

---

## Tuesday (2h) — Auth + Org Context

**Goal:** Every request knows unambiguously which org it's acting on behalf of.

- Signup/login endpoints issuing a JWT containing `org_id` and `user_id`.
- Middleware that verifies the JWT and sets the Postgres session variable (`SET app.current_org = ...`) for that request/connection — this is what makes RLS actually bite, not just decoration.

**Definition of done:** Two test orgs, two test users; logging in as one and hitting any list endpoint never returns the other org's data.

---

## Wednesday (2h) — Dynamic Graph Builder

**Goal:** Replace Week 1's hardcoded graph with one assembled at runtime.

- Write `build_graph(org_id)`: fetches all `agents` rows for the org, builds a supervisor node from the set of `routing_examples`/specializations, and builds one specialist node per agent row using its `system_prompt` and `tools`.
- Keep the LangGraph structure (supervisor → conditional edges → specialists) — only the _source_ of the nodes changes, from hardcoded to DB-driven.

**Definition of done:** Feeding it Org A's two agents vs Org B's three agents produces two structurally different graphs from the same code path.

---

## Thursday (2h) — Agent CRUD API

**Goal:** Agents can be created/edited/deleted through the API (the UI calls this tomorrow/Saturday).

- `POST/GET/PUT/DELETE /agents` scoped to the authenticated org.
- Validation: system prompt required, at least one valid tool reference, specialization name unique per org.

**Definition of done:** You can create, list, edit, and delete an agent via `curl`/Postman entirely through the API, respecting org scoping.

---

## Friday (2h) — Knowledge Base v1

**Goal:** Agents can be grounded in real documents, not just a system prompt.

- Enable `pgvector` extension. `documents` table: `id, org_id, agent_id, content, embedding`.
- `POST /agents/{id}/documents` — accepts text, chunks it (simple fixed-size chunker is fine for now), embeds each chunk, stores it.

**Definition of done:** Upload a short FAQ doc; a similarity query against it returns the most relevant chunk for a test question.

---

## Saturday (7–8h) — Agent Builder UI

**Goal:** A non-technical admin could plausibly build an agent from this screen.

1. **(2h)** Form: agent name, specialization, system prompt (textarea), model dropdown.
2. **(2h)** Tool selection (checkboxes against the available mock tools from Week 1), document upload field.
3. **(2h)** Wire the form to the CRUD API; list view showing all agents for the current org.
4. **(1–2h)** Create 2–3 distinct agents across 2 different mock orgs (use two browser sessions or an incognito window logged in as each org). Confirm Org A's admin never sees Org B's agents in the list — this is your tenant-isolation proof, worth screenshotting for the eventual write-up.

**Definition of done:** You built at least 3 different agents, across 2 orgs, entirely through the UI — no direct DB inserts.

---

## Sunday (7–8h) — RAG Wiring + Regression Test

**Goal:** Confirm the whole stack (dynamic graph + RAG + multi-tenancy) works together, not just in isolation.

1. **(2–3h)** Wire the KB retrieval step into each specialist node: before calling the LLM, do a similarity search against that agent's `documents` and inject the top chunks into context.
2. **(2h)** Test with real uploaded docs — ask questions that should be answerable only from the uploaded content, confirm the agent uses it (and doesn't hallucinate when the doc doesn't cover something).
3. **(2h)** Full regression pass: re-run Week 1's test conversations, but now through the dynamic, config-driven, multi-tenant graph. Fix anything that broke in the transition.
4. **(1h)** Commit, update README with the new architecture (data flow diagram, if you want to sketch your own version of the one above).

**Definition of done:** A conversation against a freshly built agent correctly uses its uploaded knowledge base, and Week 1's original scenarios still pass unchanged.

---

## Common Pitfalls This Week

- **RLS enforced only in application code doesn't count.** If a raw SQL query without the session variable set can still leak data, you don't actually have tenant isolation — you have a convention. Test this explicitly.
- **Don't let the agent builder UI get fancy yet.** Function over form this week; visual polish is Week 5's job.
- **Chunking strategy doesn't need to be clever yet.** Fixed-size chunking with overlap is fine — don't burn hours on semantic chunking this week.

---

## Weekly Deliverable Checklist

- [ ] Every table has `org_id`; RLS policies enabled and tested against a raw-query bypass attempt
- [ ] JWT auth issuing org-scoped tokens; middleware sets Postgres session context per request
- [ ] Graph builder assembles a different graph per org from DB rows
- [ ] Agent CRUD API fully functional and org-scoped
- [ ] Document upload + embedding + similarity search working
- [ ] Agent Builder UI: create/list/edit agents, verified isolation across 2 test orgs
- [ ] Week 1 scenarios re-verified against the new architecture
