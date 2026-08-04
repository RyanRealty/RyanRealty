# Process: market-report-deliver — Market report publish + subscriber cadence sends

## 0. Meta
- Status: deepened
- Cadence: weekly publish + 4×/day cadence matcher
- Verdict: KEEP (proposed; P3 decides) — data-led nurture; candidate to MERGE its subscription admin with newsletter-run's audience concept
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Contacts who want market data get the current report on their own cadence, with every figure §0-verified upstream.

## 2. Inception (what starts it)
- Trigger type: schedule
- Concrete: `market-report` cron (Sun 14:00 UTC) builds/publishes weekly report (HTML + chart banner → `market_reports` + Storage — `generate-market-report.ts:285`); `crm-market-report-send` (4,10,16,22 UTC) matches due `crm_report_subscriptions` and sends (`lib/crm/market-report-send.ts:170`); broker one-off `sendOneSubscriber` (`crm-send-now.ts:90-103`).
- Preconditions: report published; figures ride the §0-gated pipeline (market_stats_cache/pulse; Spark×Supabase reconciliation is the upstream hard gate); subscription active with cadence due.
- Entry evidence: `crm_report_subscriptions`, `market_reports`, `email_events`.

## 3. Actors
- Human: broker manages subscriptions (`/admin/crm/settings/market-reports`, `/admin/crm/subscriptions`); one-off sends.
- Automated: publish cron, cadence matcher (suppression fail-closed inside — same posture as cadence cron per evidence).

## 4. Systems of record
- `market_reports` (the artifact), `crm_report_subscriptions` (who/cadence), `email_events` (delivery), doc-tracker views on /cma+/bpo class docs (memory: CRM send tracking E2E).
- NOT SoR: any hand-typed figure (§0).

## 5. End-to-end path
1. **Report builds** · system · weekly; figures from cached §0 pipeline; chart banner via internal API · failure: build failure → no new report; cadence sends would re-send... verify latest-vs-dated semantics in P4 · n/a
2. **Subscription exists** · human/system · broker subscribes a contact (or contact self-serves via site) with geo + cadence · n/a
3. **Cadence match** · system · 4×/day scan for due subscriptions · n/a
4. **Send** · system · suppression fail-closed; email out; event logged · n/a
5. **Engagement** · system · email_events; site visits feed lead signal · n/a

## 6. Decision points
- Due today? → cadence math per subscription.
- Suppressed? → skip (fail-closed).
- Geo-specific? → report variant per subscription geography (city/neighborhood scope).

## 7. Completion
- Done-when (per cycle): all due subscriptions sent or skipped-with-reason.
- Terminal states per subscription: active · paused · unsubscribed.

## 8. Time & SLA
- Publish weekly; sends within the day they're due (4 windows).
- "Late": missed windows invisible unless loop-health catches the cron.

## 9. Variants
- Cadence (weekly/monthly/quarterly per row) · geography · broker one-off send-now.

## 10. Current implementation map
- Routes: `/admin/crm/subscriptions`, `/admin/crm/settings/market-reports`; consumer subscribe surfaces on site.
- Crons: market-report, crm-market-report-send.
- Known defects: (a) subscription admin split across two admin surfaces (and conceptually overlapping newsletter audience); (b) no per-person "everything they receive" rollup surfaced (DAL exists: `getContactReportSubscriptions`).
- Duplicate paths: subscription-door sprawl (shared with newsletter-run + listing-alert-care).

## 11. Target shape (process-level, not pixels)
- Should exist: YES.
- Ideal: one per-person subscriptions panel (market reports + newsletter + listing alerts together); cadence engine untouched.
- UI destination implication: no destination; a panel on the person record + one audience admin.

## 12. Acceptance checks
- [ ] Sunday publish → new `market_reports` row with citations upstream.
- [ ] Subscription due today → sent in one of the 4 windows; email_events row.
- [ ] Suppressed subscriber → skipped with reason.
- [ ] Person record shows all their subscriptions in one read (`getContactReportSubscriptions`).
