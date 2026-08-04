# Process: newsletter-run — Newsletter draft → send → reconcile

## 0. Meta
- Status: deepened
- Cadence: monthly (auto-draft) + ad hoc sends
- Verdict: KEEP (proposed; P3 decides) — working retention channel with a real send-integrity engine
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Subscribed contacts get the monthly (or ad hoc) newsletter reliably — right audience, suppression-clean, every send accounted for.

## 2. Inception (what starts it)
- Trigger type: schedule | broker action
- Concrete: `newsletter-monthly-draft` (1st of month 13:15 UTC) auto-drafts from market data + alerts Matt (`route.ts:51-64`); manual `/admin/newsletters/new`; enrollment via `/admin/newsletters/enroll` + segments (`crm-newsletter-segments`).
- Preconditions: audience buildable FAIL-CLOSED — any cohort read error aborts as `audience_build_failed`, never a partial audience (`lib/newsletter/cohort-enrollment` — test evidence: S-10 fail-closed `lookup_failed` too).
- Entry evidence: newsletter tables; `deliverability FAIL — not inbox-safe: no-unsubscribe` guard (`lib/email/prepare` — 9.E.7: an email without an unsubscribe path FAILS preparation).

## 3. Actors
- Human: Matt/broker — drafts, approves content, monitors delivery. Accountable: sender broker.
- Automated: monthly-draft, `newsletter-send` (*/2 drain), `newsletter-reconcile` (hourly: finalize, reset crashed claims, flag stalled).

## 4. Systems of record
- Newsletter draft + send-queue tables (`lib/newsletter/send-queue.ts:422` drain); `email_events`; subscriber/segment rows; deliverability_metrics (postmaster).
- NOT SoR: Resend's dashboard (mirror).

## 5. End-to-end path
1. **Draft exists** · system/human · auto-draft (market data, brand-voice governed) or manual; Matt alerted · n/a
2. **Audience built** · system · cohort enrollment fail-closed; suppression pre-filtered · n/a
3. **Broker reviews + launches** · human · `/admin/newsletters/[id]` edit/send · desktop · failure: none recorded for skipped months (acceptable)
4. **Queue drains** · system · */2 min, re-checks suppression AT SEND TIME, Resend transport · failure: crashed claims reset by reconcile · n/a
5. **Reconcile** · system · hourly — finalize done sends, reset crashes, flag stalled drains · n/a
6. **Measure** · system · delivery summary (`getGlobalDeliverySummary`), analytics (`getBrokerNewsletterAnalytics`), postmaster deliverability · n/a

## 6. Decision points
- Cohort read fails? → abort whole audience (never partial).
- No unsubscribe path? → preparation FAILS (inbox-safety gate).
- Suppressed at drain time? → skipped even if queued earlier.
- Stalled drain? → reconcile flags it.

## 7. Completion
- Done-when: queue empty, reconcile finalized, summary visible.
- Terminal states per send: delivered · suppressed-skip · failed-flagged.

## 8. Time & SLA
- Drain continuous (*/2); reconcile ≤1h behind. Monthly cadence is the only calendar.
- "Late": stalled-drain flag is the alarm.

## 9. Variants
- Monthly auto-draft vs ad hoc; segment-scoped vs full-list.

## 10. Current implementation map
- Routes: 6 `/admin/newsletters*` pages; `/admin/crm/settings/segments`; subscriptions overlap on `/admin/crm/subscriptions`.
- Crons: monthly-draft, send, reconcile; postmaster-sync feeds deliverability.
- Known defects: (a) subscriber management split across newsletters/subscribers, crm/subscriptions, and settings/segments — three doors to one audience concept; (b) DMARC/mail-infra spec still partially open (memory: newsletter spec — spec-only portions).
- Duplicate paths: audience-management doors.

## 11. Target shape (process-level, not pixels)
- Should exist: YES.
- Ideal: one audience concept (segments) with one door; draft→send→reconcile untouched (it is the healthiest engine in the admin); per-person subscription rollup shared with market-report-deliver.
- UI destination implication: newsletters fold under one communications/content home, not a top-level namespace.

## 12. Acceptance checks
- [ ] 1st of month → draft exists + Matt alerted.
- [ ] Kill one cohort read in test → whole audience aborts (`audience_build_failed`), zero partial sends.
- [ ] Suppress a subscriber after queueing → drain skips them.
- [ ] Strip the unsubscribe link in test → preparation refuses.
- [ ] Crash a drain mid-run → reconcile resets claims; no double-delivery.
