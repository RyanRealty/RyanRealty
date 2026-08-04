# Process: listing-alert-care — Consumer listing alerts (saved searches)

## 0. Meta
- Status: deepened
- Cadence: continuous (hourly scan); broker touch only via approvals + as lead signal
- Verdict: KEEP (proposed; P3 decides) — retention/nurture surface that feeds inbound intent
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
A consumer who saved a search gets timely, accurate listing-event emails on their chosen cadence, and that engagement flows back as lead signal.

## 2. Inception (what starts it)
- Trigger type: broker-side inbound event (signup) + schedule (scan)
- Concrete triggers:
  - Signup: `app/actions/saved-searches.ts:182` and `search-alert-capture.ts:103` — both ALSO call `sendEvent()` → lead-ingress (an alert signup IS a lead door); capture includes hot-lead task (`search-alert-capture.ts:15`)
  - Scan: `saved-search-alerts` cron hourly — due `listing_alerts`, event detection, sends (`lib/alerts/send.ts:20`)
- Preconditions: alert row with geography captured (memory: saved-search geography capture — `listing_alerts`), cadence schedule; email deliverable.
- Entry evidence: `listing_alerts`, `listing_alert_queue`, `email_events`; cadence semantics adversarially tested (`lib/alerts/cadence.adversarial.test.ts` — Mon+Thu fires twice weekly; all-7-days turns weekly into daily foot-gun documented).

## 3. Actors
- Human: consumer (owns cadence/criteria); broker only for pending alert-group approvals (`/admin/crm/subscriptions` — `listPendingAlertApprovalGroups`).
- Automated: scan cron, event detection (`lib/alerts/event-detection.ts`), send path, preference actions (`lib/alerts/alert-preferences.action.ts`).
- Accountable: system; broker for approval backlog.

## 4. Systems of record
- `listing_alerts` — subscription + criteria + cadence + geography. `listing_alert_queue` — pending deliveries. `email_events` — sends/engagement. `crm_people` — the subscriber as person.
- NOT SoR: the consumer's site session.

## 5. End-to-end path
1. **Save search / capture** · consumer · criteria + geography persisted; person ensured via lead-ingress; task queued on capture variant · either device (consumer site)
2. **Approval gate (where required)** · human · pending alert groups reviewed at subscriptions admin · desktop · failure: backlog delays first send (aging invisible — gap)
3. **Hourly scan** · system · due alerts by cadence; detect events (new/price/status) since last run · `lib/alerts/send.ts:20` · n/a
4. **Send** · system · email via Resend; suppression respected (email channel); `markListingAlertNotified` AFTER send — a failure here risks duplicate next run (known, logged loudly: "duplicate risk next run" — test evidence) · n/a
5. **Engagement flows back** · system · `email_events` + site visits (visitor sessions) enrich the person; hot behavior can escalate via visitor-escalate · n/a
6. **Consumer adjusts** · consumer · preference actions (pause, cadence, criteria) · n/a

## 6. Decision points
- Cadence due? → schedule_days semantics (Mon+Thu = twice weekly; 7-days = daily — foot-gun documented in tests).
- Events found? → send; none → silent skip.
- Suppressed email? → blocked.
- Mark-notified failed after send? → duplicate risk accepted + logged (defect to close in target shape).
- ISR empty-fallback class (memory): resilient pages can cache empty — alert content must not inherit that.

## 7. Completion
- Done-when (per cycle): every due alert either sent+marked or skipped-no-events; (per subscription): consumer active, paused, or unsubscribed.
- Artifacts: queue rows drained, email_events, notified stamps.
- Terminal states: active · paused · unsubscribed/suppressed.

## 8. Time & SLA
- Scan hourly; event→email ≤1h + cadence window.
- "Late": approval backlog before first send (unmeasured); scan failures caught by loop-health-check.

## 9. Variants
- Capture door: saved-search vs alert-capture (adds task) — same subscription afterward. Cadences per consumer. No split.

## 10. Current implementation map
- Routes: consumer-side site surfaces; admin: `/admin/crm/subscriptions` (approvals + delivery summary).
- Crons/libs: saved-search-alerts; `lib/alerts/*` (send, event-detection, cadence, preferences).
- Known defects: (a) notify-after-send duplicate window; (b) approval-backlog aging invisible; (c) subscriptions admin mixes THREE jobs (listing alerts + market reports + newsletters) on one surface.
- Duplicate paths: none in delivery.

## 11. Target shape (process-level, not pixels)
- Should exist: YES, as background automation + a small approvals lane.
- Ideal: transactional send+mark (kill the duplicate window); approval aging visible; the subscription concept unified per person ("everything we send this human, one panel").
- Data gaps: per-person subscription rollup (exists piecemeal: getContactReportSubscriptions).
- UI destination implication: no daily destination; approvals fold into the one approvals lane; per-person view lives on the person record.

## 12. Acceptance checks
- [ ] Save a search → listing_alerts row with geography; person exists; capture variant also yields task.
- [ ] Price-drop a matching listing → email within cadence window; email_events row; notified stamp advances.
- [ ] Mon+Thu schedule → exactly 2 sends/week (adversarial cadence semantics hold).
- [ ] Suppress subscriber email → scan skips, no send.
- [ ] Force mark-notified failure in test → duplicate documented/observed (until transactional fix lands).
