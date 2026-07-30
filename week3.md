# Week 3 — Async, Streaming, and Concurrency

**Dates:** Mon Aug 3 – Sun Aug 9, 2026
**Layers in scope:** Async / Realtime
**Goal by Sunday night:** Chat is fully decoupled from request/response — messages go through a queue, a worker pool executes the agent graph, results stream back live, and you have real numbers for how many concurrent users this handles.

---

## System Design for This Week

![Week 3 system design diagram](week3-diagram.png)

This week is the one that actually proves "handles thousands of concurrent users" rather than just asserting it. The core move: **never run an LLM call inside the request/response cycle.** Accept the message, queue it, return immediately, and push the answer back over a persistent connection when it's ready.

---

## Prerequisites / Resources

- Redis Streams: [redis.io/docs/latest/develop/data-types/streams](https://redis.io/docs/latest/develop/data-types/streams/)
- LangGraph checkpointing: [langchain-ai.github.io/langgraph/concepts/persistence](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- Load testing: [k6.io](https://k6.io) or [locust.io](https://locust.io) — pick one, don't evaluate both.
- PgBouncer: [pgbouncer.org](https://www.pgbouncer.org)

---

## Monday (2h) — Queue-Backed Ingestion

**Goal:** `/chat` stops doing any LLM work itself.

- Add Redis Streams (`XADD` on message receipt).
- Rewrite `/chat`: write the user message to Postgres, push a job `{conversation_id, message_id}` to the stream, return `202 Accepted` immediately.

**Definition of done:** `/chat` responds in milliseconds regardless of how slow the LLM would have been — because it isn't calling it anymore.

---

## Tuesday (2h) — Worker Process

**Goal:** Something actually processes the queued jobs.

- A standalone worker script/process: `XREADGROUP` to consume jobs, run the org's LangGraph graph (from Week 2) against the conversation, write the assistant's reply back to Postgres.
- Run 2–3 worker instances locally via `docker-compose` to prove it's horizontally scalable, not a single process.

**Definition of done:** Send 5 messages rapidly; all 5 get processed and answered correctly, distributed across multiple worker instances.

---

## Wednesday (2h) — Realtime Delivery (WebSocket/SSE)

**Goal:** The client finds out about the answer without polling.

- WebSocket endpoint per conversation; when a worker finishes, publish the result (Redis pub/sub or a DB `LISTEN/NOTIFY`) and push it down the socket.
- Update the React chat widget to open a socket on conversation start and append incoming messages as they arrive.

**Definition of done:** Send a message from the UI, watch the reply appear without refreshing or polling — pushed, not pulled.

---

## Thursday (2h) — Checkpointing & Resumability

**Goal:** A crashed worker doesn't lose the conversation.

- Add LangGraph's Postgres checkpoint saver to the graph.
- Test: kill a worker process mid-response (mid-tool-call if you can time it), restart it, confirm the conversation resumes from its last checkpoint instead of restarting or losing state.

**Definition of done:** You can genuinely kill `-9` a worker mid-job and the conversation completes correctly after restart.

---

## Friday (2h) — Rate Limiting & Idempotency

**Goal:** One noisy org can't starve everyone else, and retried actions don't double-fire.

- Per-org token bucket rate limiter in Redis on the `/chat` endpoint.
- Idempotency key on the mock refund/order-update tool from Week 1 — calling it twice with the same key produces the same result once, not two refunds.

**Definition of done:** Hammering `/chat` from one org gets throttled with a clear 429 while other orgs are unaffected; calling the refund tool twice with the same idempotency key only "refunds" once.

---

## Saturday (7–8h) — Load Testing

**Goal:** Turn "should handle concurrency" into an actual measured number.

1. **(2h)** Set up k6 or Locust: a script simulating N concurrent users each sending chat messages and waiting for a WebSocket response.
2. **(2h)** Run an initial baseline test (e.g., 50 concurrent users) and record p50/p95/p99 latency and error rate.
3. **(2–3h)** Add PgBouncer for connection pooling, tune worker pool size, and re-run. Identify the actual bottleneck (usually DB connections, worker count, or LLM API rate limits) rather than guessing.
4. **(1h)** Push toward the highest concurrent user count you can sustain with acceptable latency (this number goes straight into your portfolio write-up).

**Definition of done:** A documented before/after: baseline numbers, the bottleneck you found, the fix, and the improved numbers.

---

## Sunday (7–8h) — Harden and Document Findings

**Goal:** Lock in a number you can defend in an interview.

1. **(2–3h)** Re-run the load test at your target concurrency 2–3 times for consistency; investigate any flaky failures.
2. **(2h)** Add basic autoscaling config for the worker pool (even a simple `docker-compose scale workers=N` demonstrated locally is a legitimate talking point — full k8s HPA comes in Week 6).
3. **(2h)** Write a short internal doc: architecture diagram (your own version, annotated with what you learned), final concurrency numbers, and the single biggest bottleneck you found and fixed.
4. **(1h)** Regression-test Weeks 1–2 scenarios through the now-async pipeline.

**Definition of done:** You can state, with a number and a reason behind it, "this handles X concurrent users at Yms p95 latency, and the bottleneck was Z."

---

## Common Pitfalls This Week

- **Don't skip the "kill the worker mid-job" test.** It's the single most convincing proof that checkpointing actually works, and it's the first question a good interviewer will ask about a "resumable" claim.
- **Rate limiting per org, not globally.** A global rate limit doesn't prove multi-tenant fairness — it has to be per-org to mean anything for this product.
- **Don't chase a huge concurrency number by cutting corners** (e.g., disabling tool calls, using a tiny model) — an honest, explainable number beats an inflated one that falls apart under a follow-up question.

---

## Weekly Deliverable Checklist

- [ ] `/chat` returns immediately; all agent execution happens in worker processes
- [ ] Multiple worker instances process jobs from a shared queue
- [ ] Responses stream to the client over WebSocket/SSE, no polling
- [ ] Checkpointing verified via an actual worker-kill test
- [ ] Per-org rate limiting and at least one idempotent tool call
- [ ] Documented load test: baseline → bottleneck found → fix → final numbers
