# Process: broker-alert — Broker notified now

## 0. Meta
- Status: deepened
- Cadence: continuous (event-driven queue + 1-min drain)
- Verdict: KEEP (proposed; P3 decides) — this is the wake-up surface for the entire response half of the business. Litmus-adjacent: the CMA kickoff notification IS this process.
- Last evidence pass: 2026-08-04 · commit 21e2c63b (evidence gathered live this session)

## 1. Purpose
Get a human broker to act on a time-sensitive event (new lead, seller-intent inquiry, inbound from a new number, CMA draft ready) within minutes, on their phone, with one tap into the exact record.

## 2. Inception (what starts it)
- Trigger type: inbound event (system-detected)
- Concrete triggers:
  - New lead auto-enrolled → instant broker text with first-touch preview — `lib/crm/enroll.ts:307-390` (`autoEnrollByFubId` → `queueBrokerAlert` at :383-388)
  - Inbound SMS from a NEW number (created===true) — `app/api/twilio/inbound-sms/route.ts:220-242`
  - Auto-enroll sweep finds a missed lead — `app/api/cron/crm-auto-enroll/route.ts:63-170`
  - CMA draft ready (optional Twilio ready-notify) — `lib/cma/worker.ts` (cma-build-worker cron)
  - Daily task rollup — `app/api/cron/crm-task-reminders/route.ts:67-121`
  - CRM vitals alarm (silence, SMS volume, A2P, MV lag) — `app/api/cron/crm-health-check/route.ts:130-208`
  - Newsletter auto-draft ready — `newsletter-monthly-draft/route.ts:51-64`
- Preconditions: person/event exists; broker resolvable (dialed-line broker, else `assigned_broker`); alert not already deduped.
- Entry evidence: `lib/crm/broker-alerts.ts:141-193` (`queueBrokerAlert`), `crm_broker_alerts` table.
- Matt Phase-0 Q1: three of four wake him — seller/valuation request, any new lead, reply on an existing thread. Supervision alerts do NOT wake him (he wants the view, not the interrupt). Current system routes health alarms through the same SMS rail — a mismatch to deepen in target shape.

## 3. Actors
- Human: alerted broker (Matt / Rebecca / Paul) — accountable for acting on the alert.
- Automated: `queueBrokerAlert()` producers (ingress paths, crons), `crm-alert-drain` cron (`* * * * *`), web-push drain.
- Accountable for completion: the alerted broker; system accountable for delivery.

## 4. Systems of record
- `crm_broker_alerts` — the alert queue (status, attempts, to_phone).
- `crm_timeline` — dedupe record (`dedupe_key: alert:{kind}:{personId}`, first writer wins) — `lib/crm/broker-alerts.ts:170-179`.
- Web-push subscriptions store (per-broker devices).
- NOT a SoR: the broker's SMS thread (delivery surface only); FUB (decommissioned).

## 5. End-to-end path (inception → completion)
1. **Event detected** · system · ingress path or cron identifies a qualifying event · input: person/event · output: call to `queueBrokerAlert()` · touch: see §2 triggers · failure: producer silently skips (no alert) · device: n/a
2. **Broker + phone resolved** · system · `ALERT_PHONE_BY_BROKER` map — `lib/crm/broker-alerts.ts:22-26` · failure: unknown broker → no resolution · n/a
3. **Opt-in gate** · system · per-broker `smsOptIn` from `getBrokerTelephony()`; else `push_only` if an active push device exists (`brokerHasActivePushDevice` :126-139); neither → alert dropped · touch: broker telephony config · failure: silent drop (KNOWN GAP: no record of the drop) · n/a
4. **Dedupe** · system · insert `crm_timeline` row `alert:{kind}:{personId}`; conflict → duplicate suppressed · :170-179 · failure: race lost = intended suppression · n/a
5. **Queue** · system · insert `crm_broker_alerts` `status: pending|push_only` · :181-187 · n/a
6. **Web-push drain** · system · `drainWebPush()` runs FIRST, outside the SMS flag gate (durable channel) · `crm-alert-drain/route.ts:60` · failure: push endpoint dead → SMS still possible · n/a
7. **SMS gate** · system · no-op unless `CRM_SMS_ALERTS==='twilio'` (verified set in prod 2026-08-04) · :62-69 · failure: flag unset → silent SMS outage (push still drains) · n/a
8. **Whitelist** · system · `isBrokerPhone()` — any `to_phone` not Matt/Rebecca/Paul is `refuseAlert()`'d, never sent (2026-06-16 incident backstop) · `lib/crm/alert-drain-core.ts:22-38` · n/a
9. **Claim + send** · system · CAS claim `pending→sending`, Twilio Messages API post, `markSent`/`markFailure`, max 3 attempts (`failureTransition()` :48-54) · `crm-alert-drain/route.ts:113-138` · failure: 3 strikes → failed row · n/a
10. **Broker opens deep link** · human · body carries `ryan-realty.com/admin/crm/{personId}` (+ `?intent=cma` on seller intent) — `lib/crm/broker-alerts.ts:276` · output: broker on the person record · failure: link goes to a desktop-shaped page on a phone (litmus risk) · **phone**
11. **Broker acts** · human · reply / kickoff CMA / dismiss — this is the handoff into inbound-respond or cma-deliver · **phone**

## 6. Decision points
- smsOptIn? → SMS rail : push-only : drop (step 3).
- `CRM_SMS_ALERTS` set? → SMS drain : push-only (step 7).
- Whitelisted phone? → send : refuse (step 8) — compliance gate, hard.
- Dedupe conflict? → suppress duplicate (step 4).
- Seller intent? → deep link gains `?intent=cma` (step 10).
- Quiet hours: NOT applied — broker alerts are internal, `lib/crm/quiet-hours.ts` gates only client-facing sends (deliberate; confirmed in code).

## 7. Completion
- Done-when: alert row `sent` (or `push_only` delivered) AND the broker reached the linked record; the alert's job ends at handoff.
- Artifacts: `crm_broker_alerts` row in terminal status; `crm_timeline` dedupe row.
- Signals to humans: the SMS/push itself.
- Terminal states: `sent` · `failed` (3 attempts) · `refused` (whitelist) · dropped-at-gate (unrecorded — gap).

## 8. Time & SLA
- System budget: ≤ ~60s from queue to send (1-min drain cadence).
- Broker budget: LITMUS — notification → CMA kickoff ≤ 3 taps / ≤ 30s broker-action.
- "Late": no explicit SLA tracking on alert→action today; speed-to-lead report (`getSpeedToLeadReport`) measures lead→first-touch after the fact. No one sees "alert sat unanswered" in real time — gap.

## 9. Variants
- new-lead (with first-touch preview) · inbound-new-number · CMA-ready · task rollup (daily digest shape) · health alarm (SUPERVISION — Matt says should NOT wake him) · newsletter-draft-ready. All share queue/drain; only body + kind differ. No split needed.

## 10. Current implementation map
- Routes: none owned (delivery is SMS/push; deep links land on `/admin/crm/[id]`).
- Actions/crons: `queueBrokerAlert`, `crm-alert-drain` (`* * * * *`), producers per §2.
- Known defects: (a) opt-in-gate drops are unrecorded; (b) supervision alarms share the wake-up rail against Matt's stated preference; (c) no alert→action latency measurement; (d) deep-link target is not a phone-first surface.
- Duplicate paths: `visitor-hot-lead-escalation` emails Matt + creates a task OUTSIDE this rail (`route.ts:246-305`) — a second notification system; P3 merge candidate.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — core wake-up loop.
- Ideal: one alert rail, every producer through it; wake-up class (3 human triggers) separated from supervision class (view, not interrupt); drops recorded; alert→first-action latency measured; deep link lands on a phone-first action surface where the 3-tap CMA kickoff is possible.
- Data gaps: drop logging; latency stamp (alert sent_at → first broker action on person).
- UI destination implication: no destination of its own — it POINTS at destinations. Supervision class feeds a health/ops view.

## 12. Acceptance checks
- [ ] Insert a test lead → `crm_broker_alerts` row appears with correct broker + deep link (SQL: select from crm_broker_alerts order by created_at desc limit 1).
- [ ] Drain sends within 2 min (status `pending→sent`, Twilio SID recorded).
- [ ] Non-whitelisted `to_phone` row → `refused`, never sent.
- [ ] Duplicate `queueBrokerAlert` same kind+person → exactly one alert row.
- [ ] `CRM_SMS_ALERTS` unset in a test env → web push still delivers.
- [ ] Timed: alert SMS → person record open → CMA kickoff in ≤ 3 taps / ≤ 30s (LITMUS, re-prove on real path in P8).
