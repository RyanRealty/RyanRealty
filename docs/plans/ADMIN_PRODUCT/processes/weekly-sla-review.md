# Process: weekly-sla-review — Response / pipeline hygiene ritual

## 0. Meta
- Status: deepened
- Cadence: weekly (human ritual; daily task rollup feeds it)
- Verdict: KEEP (proposed; P3 decides) — the supervision half of Matt's PB duty, kept as a VIEW not an interrupt (Q1)
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Once a week Matt answers: did we respond fast, is anything rotting, are the brokers on pace — and sets next actions.

## 2. Inception (what starts it)
- Trigger type: schedule (human ritual; no cron owns it)
- Feeder automation: `crm-task-reminders` daily rollup per broker (`route.ts:67-121`); speed-to-lead, agent-activity, agent-goals reports (broker-scoped via `scopeBroker`); `/admin/crm/activity` global feed.
- Preconditions: reports render from live definitions (reporting-truth supplies them).
- Entry evidence: `getSpeedToLeadReport`, `getAgentActivityReport`, `getAgentGoalsReport` (lib/data/crm); `getTaskQueue`.

## 3. Actors
- Human: Matt (accountable, PB supervision duty); brokers for their own books.
- Automated: reminder rollup; report DALs.

## 4. Systems of record
- `crm_timeline` (attempt/response evidence), `crm_tasks` (overdue truth), report DAL definitions.
- NOT SoR: memory or vibes; any hand-kept spreadsheet.

## 5. End-to-end path
1. **Ritual opens** · human · Matt opens the review surfaces (today: 3+ separate report pages) · desktop · failure: no single ritual surface — assembly cost every week
2. **Speed check** · human · speed-to-lead report vs the 5-min-task standard · n/a
3. **Rot check** · human · overdue tasks, unanswered inbound (no unanswered-thread lane exists — inbound-respond gap), parked `awaiting_broker_next` (visibility unverified — sequence-run gap) · n/a
4. **Pace check** · human · agent-goals + agent-activity per broker · n/a
5. **Actions set** · human · tasks created / reassignments / conversations — via existing surfaces; nothing records "the review happened" · failure: no ledger, no completion signal
6. **Escalations** · human · broker scope issues (Q4 role dead-ends) handled ad hoc

## 6. Decision points
- SLA miss found? → task/coaching (manual).
- Rot found? → reassign or close.
- Nothing recorded → the ritual's own completion is invisible (defect).

## 7. Completion
- Done-when: Matt reviewed the set + next actions exist as tasks.
- Artifacts: created tasks; nothing else today.
- Terminal states: reviewed (unrecorded) · skipped (indistinguishable).

## 8. Time & SLA
- Budget: should be ≤30 min/week; today the assembly across surfaces inflates it.
- "Late": a skipped week is invisible.

## 9. Variants
- PB full-company view vs broker own-book self-review (same surfaces, scoped).

## 10. Current implementation map
- Routes: `/admin/crm/reporting/speed-to-lead`, `agent-activity`, `agent-goals`, `/admin/crm/tasks`, `/admin/crm/activity`, `/admin/crm/calendar`.
- Crons: crm-task-reminders (feeder).
- Known defects: (a) ritual has no home — assembled from 5+ pages; (b) no review ledger; (c) unanswered-inbound and parked-step lanes missing (upstream gaps surface here); (d) Tasks page is a dump (~590 rows) not a hygiene lane.
- Duplicate paths: none (the opposite — fragmentation).

## 11. Target shape (process-level, not pixels)
- Should exist: YES — one weekly supervision view: speed, rot, pace, parked; review completion recorded (a stamp, not ceremony).
- Data gaps: review ledger; unanswered-thread + parked-step feeds.
- UI destination implication: folds INTO the supervision/health destination (with sync-ops) — one weekly cockpit, not a new namespace.

## 12. Acceptance checks
- [ ] From one surface, answer in <5 min: median speed-to-lead this week, count of unanswered inbound >24h, overdue tasks per broker, parked sequence steps (fails today — multi-page assembly).
- [ ] Review stamp recorded when done (target).
- [ ] Broker sees own book only; Matt sees all (Q4 scope holds on every feeder report).
