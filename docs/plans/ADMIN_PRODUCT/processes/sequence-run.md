# Process: sequence-run — Sequence enrollment → touches → exit

## 0. Meta
- Status: deepened
- Cadence: continuous (engine 4×/hr; enroll sweep 4×/hr); broker interaction WEEKLY, monitoring-only (Matt Q2: "checking they ran / didn't break")
- Verdict: KEEP (proposed; P3 decides) — the nurture machine behind every lead door
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Every new lead gets a timely, compliant, personalized touch stream without a broker lifting a finger — and the stream stops the instant a human replies.

## 2. Inception (what starts it)
- Trigger type: inbound event (ingress) | schedule (sweep) | broker action (manual)
- Concrete triggers:
  - Instant at ingress: `autoEnrollByFubId()` — `lib/crm/enroll.ts:268-392` (seller LP `actions.ts:604-609`; Meta webhook `:621-624`)
  - Sweep backstop: `crm-auto-enroll` cron 4×/hr, trailing 7-day window — `route.ts:39-183`
  - Manual: `manualEnrollPerson()` — `enroll.ts:178-228`
  - Rule-driven: `crm_automation_rules` on `tag_added` — `enroll.ts:91-107`; legacy `RULES` fallback `:27-32`
- Preconditions (all in `autoEnrollPerson()` `enroll.ts:40-170`): post-epoch person (`ENROLLMENT_EPOCH` 2026-06-10, `:49-50`); not an outreach-list source (`classifyLeadSource().outreachList` `:58-61`); not geo-referral-blocked (`:71-72`); not hard-stopped (fail-closed `:75-83`); never previously enrolled in a master sequence (`:137-148`).
- SMS consent fail-closed: unless `smsConsent===true`, `no-sms-consent` suppression added at enroll (`:297-305`).
- Entry evidence: `crm_sequence_enrollments` insert `status:'running'` (`:154-160`).

## 3. Actors
- Human: broker for monitoring + rare authoring; contact whose reply pauses it.
- Automated: enroll paths, `crm-sequence-engine` (lease-guarded, `crm_try_cron_lease` `engine:52-58`).
- Accountable: system for delivery; broker for `awaiting_broker_next` steps.

## 4. Systems of record
- `crm_sequences` + steps — sequence definitions (edited at `/admin/crm/sequences/[id]/edit`).
- `crm_sequence_enrollments` — per-person state machine.
- `crm_sequence_sends` — at-most-once ledger (unique `(enrollment_id, step_index)` — `engine:120-129`).
- `crm_timeline` — every touch mirrored (`sms_out`/`email_out`, `source='sequence'`).
- NOT SoR: FUB plans (legacy ids only in fallback RULES).

## 5. End-to-end path (inception → completion)
1. **Eligibility gates** · system · epoch/outreach/geo/hard-stop/one-master checks · `enroll.ts:40-170` · failure: silently not enrolled (sweep may retry; outreach-list intentionally never) · n/a
2. **Enroll** · system · insert `running`; SMS-consent suppression posture set · `:154-160,297-305` · n/a
3. **Broker instant text** · system · first-touch-preview alert → broker-alert process · `:309-389` · n/a
4. **Engine wakes** · system · lease; pull `running` enrollments where sequence `active` · `engine:52-66` · failure: lease contention → next tick · n/a
5. **Stop-on-reply check** · system · any inbound timeline row since enrollment → `paused_reply` · `:133-146` · n/a
6. **Step due?** · system · schedule vs `laHour()` email window 7–19 (`:197-199`) / SMS quiet hours (`:394`) · reschedule if outside · n/a
7. **Compliance gates** · system · suppression email `:201-207` / sms `:315-321`; daily cap `:86-93,397-402`; A2P `:392-470`; merge-token guard `:284-290` → see suppression-guard PDS · n/a
8. **Claim + send** · system · `claimSend()`/`releaseSend()`; Gmail (email) or Twilio (SMS); timeline mirror · `:120-129,412-413` · failure: claim conflict = at-most-once win · n/a
9. **Advance** · system · next step scheduled; `stop_other_plans` channel pauses sibling enrollments (`:549-577`) · n/a
10. **Exit** · system · no next step → `completed` (`:590-593`); `confirm===true` step → `awaiting_broker_next` (`:594-598`) · n/a
11. **Broker monitors** · human · WEEKLY health glance: did they run, did any break — `/admin/crm/sequences` (`getWorkflowAnalytics`, `getCrmAutomationsAdminList`) · desktop · failure: today's surface is an authoring list, not a health view (Matt: monitoring is the job)

## 6. Decision points
- Eligibility (5 gates) at enroll — each silently excludes.
- Reply since enrollment? → `paused_reply` (the promise that makes automation safe).
- Suppressed / quiet / capped / A2P-unverified / unresolved token? → suppressed · rescheduled · queued-visible · stopped (per suppression-guard).
- `stop_other_plans`? → siblings `paused`.
- `confirm` step? → parks for broker.

## 7. Completion
- Done-when: enrollment reaches a terminal/parked state with every sent touch mirrored in timeline.
- Terminal/parked states: `completed` · `paused_reply` · `suppressed` · `stopped` · `paused` (sibling-stopped) · `awaiting_broker_next`.
- Signals: none today on completion (fine); parked `awaiting_broker_next` — **P4 RESOLVED (2026-08-04): visible** via broker-dashboard "Needs your action" queue (`getBrokerActionQueue`, `app/actions/crm.ts:1739`, confirm/skip `:1869`) and the person right-rail. Residual gaps: sequences page computes `awaitingBroker` and discards it; `daily-broker-digest` cron reads it but is unregistered. See data-atlas.md chain 6.

## 8. Time & SLA
- Touch precision: ±15 min (engine cadence). Email window 7–19 LA; SMS quiet-hours windows.
- Sweep backstop: a missed inline enrollment is caught within 15 min, up to 7 days back.
- "Late": invisible unless it trips crm-health-check silence vitals — no per-sequence delivery SLA surface (the exact thing Matt checks weekly, by hand).

## 9. Variants
- Channel steps: email · sms · task · tag. Enrollment origin: instant · sweep · manual · rule. One process; no split.

## 10. Current implementation map
- Routes: `/admin/crm/sequences` (+`[id]/edit`), `/admin/crm/workflows`, `/admin/crm/automations` (redirect).
- Crons: crm-auto-enroll, crm-sequence-engine. Libs: `enroll.ts`, engine route, `record-message.ts`.
- Known defects: (a) monitoring is the weekly job but the surface is authoring-shaped — no "ran/broke" health lane; (b) ~~`awaiting_broker_next` visibility unverified~~ P4-resolved: visible on broker-dashboard + person rail; remaining: sequences page discards the count, digest cron unregistered; (c) legacy RULES fallback carries FUB plan ids (dead vocabulary); (d) sequence SMS shares the global A2P/cap posture with no per-sequence budget.
- Duplicate paths: workflows vs sequences vs automations naming (three labels, one machine).

## 11. Target shape (process-level, not pixels)
- Should exist: YES.
- Ideal: monitoring-first surface (last 24h/7d: touches sent, blocked, parked, broken — glanceable weekly in <60s); authoring behind it; parked-for-broker steps surface as actionable items on the response surface, not buried.
- Data gaps: per-run delivery ledger rollup; parked-step notification.
- UI destination implication: health/monitoring lane (weekly); editor is rare-use.

## 12. Acceptance checks
- [ ] New post-epoch lead with smsConsent → enrollment `running` + broker first-touch alert; pre-epoch person → never enrolled.
- [ ] Outreach-list-source person → NOT auto-enrolled (sweep skips too — `route.ts:132-136`).
- [ ] Contact replies mid-sequence → enrollment `paused_reply` before the next touch fires.
- [ ] Duplicate engine tick (forced) → exactly one send per (enrollment, step) — `crm_sequence_sends` unique holds.
- [ ] Step with unresolved `%token%` → `stopped`, nothing sent.
- [ ] Weekly monitor: broker can answer "did every active sequence run and did anything break?" from one screen in under a minute (target-shape check; fails today by design of current surface).
