# Process: content-approve — Draft → approval → publish/send

## 0. Meta
- Status: deepened
- Cadence: daily (queue review); production hourly (crons)
- Verdict: KEEP (proposed; P3 decides) — §1 approval law runs through it; also Matt Q3 phone must-have #4 ("approve a draft before it sends")
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Nothing branded reaches a public channel or a real person without a fresh human approval stamp, while production itself stays fully automated.

## 2. Inception (what starts it)
- Trigger type: system schedule (brain) | broker action (direct produce, SMS agent)
- Concrete triggers:
  - Brain cycle creates `pending` rows — `marketing-weekly-cycle` (briefs ≤10 — `generate-briefs.ts:2540`); inbox intent — `marketing-inbox-poll` (Gmail → Claude parse → dispatch — `inbox-poll.ts:290-419`)
  - Broker SMS agent drafts `content:*` (broker self-approval class, CLAUDE.md §1 2026-08-01)
  - Direct produce (Matt asks in chat) — one action row
- Pipeline: `producer-dispatcher` (hourly) claims pending → `in_production` (`route.ts:68,114`) → `producer-runtime` (hourly) executes SKILL.md via Messages API, cost-capped $5/row $15/run 3 rows/run (`route.ts:231,315,376`) → `ready`.
- Entry evidence: `marketing_brain_actions` status machine (CLAUDE.md §5); `producer_execution_failures`; `marketing_cost_ledger`.

## 3. Actors
- Human: Matt (or initiating broker for `content:*` self-approval via APPROVE reply, 7-day freshness, daily digest) — accountable for every stamp.
- Automated: dispatcher, runtime, publisher-sweep (*/30 — publishes approved via internal `/api/social/publish` — `route.ts:187,234,279`), measurement (48h/7d/30d pulls + backstop loop).

## 4. Systems of record
- `marketing_brain_actions` — the ONE protocol row (status: pending → in_production → ready → approved → executed → measured; killed).
- `content_performance` — outcomes. `marketing_cost_ledger` — spend. `broker_agent_turns/sessions` — SMS-agent trail (daily digest — `digest.ts:139-186`).
- NOT SoR: chat approvals (a passing gate/silence is never approval — §1); drafts outside `out/`.

## 5. End-to-end path (inception → completion)
1. **Row created** `pending` · system/broker · brief/intent/direct · failure: malformed payload → runtime failure row · n/a
2. **Dispatch** · system · claim top pending → `in_production` · hourly · n/a
3. **Produce** · system · runtime loads producer SKILL.md (registry-resolved), builds deliverable, QA gates (voice, first-frame for video) → `ready` · failure: `producer_execution_failures` + cost cap kill · n/a
4. **Broker notified** · system · runtime Twilio notify; approval queue shows ready rows · n/a
5. **Review** · human · `/admin/approval-queue` (raw service client) or `/admin/crm/approvals`; content drafts shown from `out/` scratch first (§1) · **phone must-have (Q3) — queue is desktop-shaped today** · failure: rows sit; no aging alarm
6. **Stamp** · human · approve (≤7-day freshness) or kill · SMS-agent APPROVE reply = stamp for own `content:*` · n/a
7. **Execute** · system · publisher-sweep → `/api/social/publish` → `executed`; seeds performance rows · failure: publish error → failures table, row stays approved · n/a
8. **Measure** · system · 48h/7d/30d pulls stamp `measured_at`; backstop `marketing-measurement-loop` · n/a
9. **Digest** · system · marketing-daily-digest emails Matt (`daily-digest.ts:123,227,503`); broker-agent-digest daily · n/a

## 6. Decision points
- Approval class by prefix: `content:*` draft-review · `site:*` PR-merge · `ops:*` explicit naming · `comms:/analyze:*` none (§5 table).
- Broker-initiated on own line? → self-approval allowed, Matt digested.
- Stamp older than 7 days? → invalid, re-approve.
- Cost cap hit? → row killed.
- QA/voice/first-frame fail? → not `ready` (auto-zero classes ship-block regardless of score).

## 7. Completion
- Done-when: `measured` (full loop) or `killed` with reason.
- Artifacts: action row trail, deliverable, performance rows, digests.
- Signals: ready-notify, daily digests.
- Terminal states: `measured` · `killed`.

## 8. Time & SLA
- Production: ≤1h claim + build. Publish: ≤30 min after approval. Measurement: 48h/7d/30d.
- Approval latency: unbounded and uninstrumented — rows can sit in `ready` invisibly (gap).
- Freshness: 7-day stamp expiry is the only time rule.

## 9. Variants
- content (draft-first) · site (PR) · ops (explicit) · comms/analyze (none). CMA build reuses the SAME action table but its approval is the cma-deliver flow (`approveCmaAction`), not this queue — vocabulary overlap, not duplication.

## 10. Current implementation map
- Routes: `/admin/approval-queue`, `/admin/crm/approvals`, `/admin/content-library`.
- Crons: dispatcher, runtime, publisher-sweep, 3× performance-pull, measurement-loop, marketing-inbox-poll, both digests.
- Known defects: (a) no approval-latency surface — `ready` rows age invisibly; (b) two approval queues (`/admin/approval-queue` vs `/admin/crm/approvals`) split one job; (c) approval-queue page bypasses DAL (raw service client — gate-exempt admin, but inconsistent); (d) phone approval (Q3 must-have) not designed for.
- Duplicate paths: the two queues.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — it is the §1 law made mechanical.
- Ideal: ONE approval surface, phone-first (approve/kill/see-draft in seconds); ready-row aging visible; SMS-agent and queue stamps land identically.
- Data gaps: approval-latency stamp; unified queue read.
- UI destination implication: one approvals lane on the daily surface, not two destinations.

## 12. Acceptance checks
- [ ] Brain brief → pending → in_production → ready with deliverable + QA trail; cost ledger row exists.
- [ ] Approve with 8-day-old stamp attempt → refused/stale.
- [ ] Approved row → executed ≤30 min, performance row seeded; measured_at stamped by day 30.
- [ ] SMS-agent draft + APPROVE reply → executed same as queue approval; appears in Matt's digest.
- [ ] Kill a ready row → killed, nothing published.
- [ ] Both queues show the identical ready set (fails today if they diverge — measure).
