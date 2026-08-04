# Admin Product OS — decisions (append-only)

This file is the ONLY place a lock counts. Chat approval without a line here is not a
lock. `ADMIN_REBUILD/PHASE-0-ANSWERS.md` is input evidence only, never a lock source
(pack rule "One lock location", 2026-08-04).

## Lock status

- Process lock (P3): **not granted**
- IA lock (P5): **not granted** — may not be granted before the process lock exists here
- Visual lock (P6): **not granted**
- Litmus sign-off (P8): **not granted**

---

## 2026-08-04 — Memory root decision (Matt)

`docs/plans/ADMIN_PRODUCT/` is the greenfield memory root, separate from the superseded
`ADMIN_REBUILD` package. BOOT registered the `ADMIN_PRODUCT/` package row in
`docs/DEVELOPMENT_PROCESS.md` in the same commit that created this directory (G44).

## 2026-08-04 — Deepen-order decision (Matt)

Locked order for the P2 queue:

`broker-alert → inbound-respond → cma-deliver → prospecting → suppression-guard → other daily → weekly/rare`

Prospecting moves up to right after `cma-deliver`: Matt named it a weekly core job
("what expired → send audits; new FSBOs → send CMAs"), it currently sprawls across 5
destinations, and `cma-deliver` feeds it (FSBOs get sent a CMA).

## 2026-08-04 — Phase-0 answers (Matt; copied from ADMIN_REBUILD/PHASE-0-ANSWERS.md as EVIDENCE, not locks)

**Q1 — Notifications that wake him:** seller/valuation request (the LITMUS path, ≤3 taps
/ ≤30s broker-action), any new lead from any source, and a reply on an existing thread.
Supervision alerts ("something failed or is overdue") do NOT wake him — he wants the
supervision view, not the interrupt. The wake-up set is all inbound and human.

**Q2 — Weekly vs never:** Weekly = Inbox/messages, Sequences (monitoring only — "checking
they ran / didn't break"), and Prospecting (written in by Matt: "seeing what listings
expired and sending them audits, seeing any new fsbos and sending them cmas"). NOT
weekly = People list, Deals, Tasks. Disk evidence 2026-08-04: People = 22,951 contacts
across 21 surfaces; Deals = ~21 rows across 6 surfaces split over two stores (corrects
FULL-AUDIT-2026-08-03 §0 on the console redirects); Tasks = ~590 rows, one surface;
Prospecting spans 5 destinations; the shipped mobile tab bar gives 2 of 5 tabs to
non-weekly surfaces and 0 to prospecting. None of this is a verdict — KEEP/MERGE/KILL
is P3.

**Q3 — Phone must-haves:** all four. Reply to a text or email with thread history above
the composer; pull up a person + history; log a call or note after a showing; approve a
draft before it sends. Phone is a full product, not a thin surface.

**Q4 — Broker scope:** own book by default, full view for Matt as principal broker.
Known bug class: `assigned_broker` is scattered across people, conversation, tasks,
deals, alerts (6 classes of role dead-end in the RBAC audit).

**Q5 — Alert SMS path:** resolved on disk — Twilio serverless via
`app/api/cron/crm-alert-drain/route.ts`, gated on `CRM_SMS_ALERTS === 'twilio'`.
**BOOT runtime check performed 2026-08-04:** production Vercel env has
`CRM_SMS_ALERTS="twilio"` (verified via `vercel env pull --environment=production`).
Alerts do not fall through to the retired mac-mini relay.

**Q6 (process marks) and Q7 (IA lock): deliberately unanswered.** They are P3 and P5
decisions and must not be pre-locked before the processes are deepened.
