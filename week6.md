# Week 6 — Deployment, Final Load Test, and Write-Up

**Dates:** Mon Aug 24 – Sun Aug 30, 2026
**Layers in scope:** Deployment & Ops + Documentation
**Goal by Sunday night:** The platform is deployed and publicly reachable, you have final load-test numbers from the real deployed environment (not local), and you have a written and recorded artifact you can actually link in job applications.

---

## System Design for This Week

![Week 6 system design diagram](week6-diagram.png)

This week's real deliverable isn't code — it's the **portfolio artifact**: a deployed URL, a demo video, and a write-up. The code has been the means to this end for five weeks; this week make sure the end product is actually presentable.

---

## Prerequisites / Resources

- Pick your deploy target now if you haven't: a single small VM (simplest), ECS (moderate), or a small k8s cluster (most "senior," but only worth it if you're comfortable — don't learn k8s for the first time this week under deadline pressure).
- GitHub Actions docs: [docs.github.com/actions](https://docs.github.com/en/actions)

---

## Monday (2h) — Dockerize Cleanly

**Goal:** Production-shaped containers, not "it happens to run in docker-compose."

- Separate, minimal Dockerfiles for the API, the worker, and the frontend (multi-stage builds to keep images small).
- A production `docker-compose.yml` (or equivalent) that mirrors what you'll actually deploy.

**Definition of done:** Fresh `docker-compose up` from a clean checkout works with zero manual steps beyond setting env vars.

---

## Tuesday (2h) — Deploy

**Goal:** It's reachable by someone who isn't you, on your laptop.

- Stand up Postgres + Redis (managed services are fine and faster to get right — e.g., a managed Postgres instance) and deploy the API/worker/frontend containers to your chosen target.
- Set environment variables/secrets properly in the deploy target, not hardcoded.

**Definition of done:** You can open the app from a phone on a different network and have a full conversation with it.

---

## Wednesday (2h) — CI/CD

**Goal:** Pushing to `main` builds and deploys automatically.

- GitHub Actions workflow: run tests → build Docker images → push to a registry → trigger deploy.
- Keep it simple — one clean pipeline beats an elaborate one you don't trust.

**Definition of done:** A trivial code change, pushed to `main`, shows up live without a manual deploy step.

---

## Thursday (2h) — Final Load Test (Against Production)

**Goal:** The numbers you quote are from the real deployed environment, not your laptop.

- Re-run Week 3's k6/Locust script against the deployed URL.
- Record final p50/p95/p99 latency and max sustained concurrent users at acceptable error rates.

**Definition of done:** A final, honest set of numbers you're prepared to be asked follow-up questions about.

---

## Friday (2h) — Demo Video

**Goal:** A 3–5 minute video that stands on its own without you narrating live in an interview.

- Script it tightly: 30s problem framing → build an agent live → have a conversation → show an escalation → show the load-test/cost numbers on screen.
- Screen-record with basic voiceover; doesn't need production polish, needs to be clear and confident.

**Definition of done:** Watch it back once, cold — does it make sense without you in the room to explain it?

---

## Saturday (7–8h) — Architecture Write-Up

**Goal:** The document a hiring manager actually reads.

1. **(2h)** Write the problem framing and product overview (1 paragraph — don't bury the lede in architecture detail).
2. **(2–3h)** Walk through each major decision and its trade-off: row-level tenancy vs DB-per-tenant, LangGraph vs CrewAI, Postgres+pgvector vs a dedicated vector store, queue-backed async vs synchronous. State what you chose and _why_, not just what you built.
3. **(2h)** Include your own annotated versions of this week's system diagrams, plus the concurrency numbers, eval pass rate, and cost-per-conversation figures from earlier weeks — put real numbers front and center, not just prose.
4. **(1h)** Proofread; a rushed final section undermines five weeks of solid work.

**Definition of done:** A document that would let a stranger understand what you built, why you built it that way, and what it actually measured, without watching the video.

---

## Sunday (7–8h) — Publish and Buffer

**Goal:** Ship it, and absorb whatever slipped from earlier weeks.

1. **(2–3h)** Clean up the public GitHub repo: clear README, setup instructions, link to the live demo and the write-up.
2. **(2h)** Publish the write-up (personal blog, LinkedIn, or both) and link the demo video.
3. **(2–3h)** Buffer time — something from an earlier week almost always needs finishing; this is where it gets done rather than left visibly incomplete.

**Definition of done:** A public repo, a live URL, a demo video, and a write-up, all cross-linked and ready to paste into a job application today.

---

## Common Pitfalls This Week

- **Don't learn a new deployment platform under deadline pressure.** Pick the option you're already 70% comfortable with; this is not the week to gamble on Kubernetes for the first time.
- **Don't let the write-up become a feature list.** Reasoning and trade-offs are the signal; a bullet list of "what I built" reads as junior. Lead with _why_.
- **An honest, explained limitation is better than a hidden one.** If something's a known gap (e.g., "escalation console has no auth beyond org-scoping"), say so — it reads as engineering maturity, not weakness.

---

## Weekly Deliverable Checklist

- [ ] Clean, minimal Dockerfiles for API/worker/frontend
- [ ] Deployed and reachable from outside your own network
- [ ] CI/CD pipeline: push to `main` → auto build → auto deploy
- [ ] Final load test run against the deployed environment, numbers recorded
- [ ] 3–5 minute demo video, watchable without narration
- [ ] Architecture write-up: problem, decisions, trade-offs, real numbers
- [ ] Public repo + live URL + write-up + video, all cross-linked
