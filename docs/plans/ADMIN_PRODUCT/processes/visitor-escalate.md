# Process: visitor-escalate — Hot visitor escalation

## 0. Meta
- Status: deepened
- Cadence: continuous (15-min scan); broker touch on escalation only
- Verdict: MERGE→broker-alert (proposed; P3 decides) — it is a fourth notification pathway (email + task) living outside the alert rail
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
A site visitor behaving like a hot lead (repeat sessions, high-intent pages) gets a broker's attention before they raise a hand.

## 2. Inception (what starts it)
- Trigger type: system condition
- Concrete trigger: `visitor-hot-lead-escalation` cron (*/15) scores `visitor_sessions`/`visitor_events` for hot signals → creates call task + emails Matt — `route.ts:246-305`.
- Preconditions: session identified or linkable to a `crm_people` row; hotness threshold met.
- Entry evidence: `visitor_sessions`, `visitor_events`, `crm_tasks` insert, Resend email.

## 3. Actors
- Human: Matt (email recipient today — not routed by assignment).
- Automated: the cron; visitor tracking pipeline; westside cohort digest (weekly variant — `westside-cohort-digest`).
- Accountable: whoever gets the task (Matt hardcoded-in-practice).

## 4. Systems of record
- `visitor_sessions`/`visitor_events` — behavior. `crm_tasks` — the escalation artifact. `crm_people` — identity link (lead-source fingerprints — memory — distinguish sign-in types).
- NOT SoR: GA4 (aggregate mirror).

## 5. End-to-end path
1. **Visitor tracked** · system · sessions/events accumulate; identity linked when known · n/a
2. **Scan + score** · system · 15-min cron finds hot sessions · `route.ts:246-305` · n/a
3. **Escalate** · system · call task upsert + email to Matt · failure: email-only visibility; NOT on the alert rail (no SMS/push, no whitelist protections, no dedupe key discipline shared with broker-alert) · n/a
4. **Broker inspects** · human · `/admin/visitors/live` + `[sessionId]` trail; person record if linked · desktop
5. **Act or dismiss** · human · call/text via inbound-respond machinery; or ignore (no explicit dismiss state) · either

## 6. Decision points
- Hot threshold met? → escalate once (dedupe within cron logic).
- Identity linked? → task on person vs anonymous session view.
- Westside cohort? → weekly digest variant instead of instant.

## 7. Completion
- Done-when: task completed/dismissed or signal ignored-and-aged.
- Artifacts: task row, email.
- Terminal states: acted · ignored (implicit — no dismiss ledger).

## 8. Time & SLA
- Detection ≤15 min. No action SLA; tasks roll into daily reminder digest.

## 9. Variants
- Instant (hot session) vs weekly (westside cohort digest). Anonymous vs identified.

## 10. Current implementation map
- Routes: `/admin/visitors/live`, `/admin/visitors/[sessionId]` (+redirect `/admin/visitors`).
- Crons: visitor-hot-lead-escalation, westside-cohort-digest.
- Known defects: (a) parallel notification path outside broker-alert (email vs the SMS/push rail — inconsistent delivery guarantees); (b) Matt-only routing ignores assignment; (c) no dismiss/outcome state, so effectiveness unmeasurable.
- Duplicate paths: the entire process duplicates broker-alert's job for one trigger class.

## 11. Target shape (process-level, not pixels)
- Should exist as a TRIGGER, not a process: fold escalation into broker-alert as a supervision-or-wake-up-classed kind (P3 decides which per Matt Q1 — behavioral signals were not in his wake-up list).
- Data gaps: outcome state; assignment routing.
- UI destination implication: visitor trail becomes evidence on the person record; live-visitors view is a curiosity surface, not a destination.

## 12. Acceptance checks
- [ ] Simulate a hot session (repeat visits, valuation page) → task + email within 15 min; second scan does not duplicate.
- [ ] Identified visitor → task attached to the right person; anonymous → session-only artifact.
- [ ] After merge (target): escalation arrives via the alert rail with kind=visitor-hot, dedupe key, and classed delivery.
