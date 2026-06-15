# Admin curation to the Lead Command Center bar

Goal (Matt 2026-06-15): every admin page meets `docs/ADMIN_DESIGN_STANDARD.md`
(the five HARD laws), then verify every workflow works fully. Exemplar:
`app/admin/console/leads/[id]/page.tsx`. The whole admin already renders neutral
in ConsoleShell + `.console-root`, so this is LAYOUT / CURATION / states / mobile
— not color.

## Audit result (2026-06-15)
Daily-driver/broker pages are ALREADY at the bar (score 0): broker-dashboard,
crm contacts, crm/tasks, crm/approvals, deals, commissions, financials, signing,
sign-off, listings, cmas, resort-communities, forms, blog, audit-log, people,
console/*. The gap is the analytics/reports cluster + a few quick caps.

## Keystone (do first — lifts ~12 pages)
- [x] `components/admin/TableWithMobileCards.tsx` — desktop `<Table>` (capped) +
  `md:hidden` card list from the same rows + built-in "See all (N) →" + designed
  empty state. Fixes HARD laws 1 (dump), 3 (empty), 4 (mobile overflow) at once.
- Reuse existing `components/admin/DashboardSummaryStrip.tsx` as the KPI band on
  analytics pages that currently lead with a bare table.

## PROGRESS (2026-06-15 — all shipped to production main)
- [x] Keystone TableWithMobileCards
- [x] Broker-facing quick caps: action-required, deals, signing, crm/deals
- [x] Analytics wave 1: social, analytics(home), traffic-sources, cost-per-lead, funnel-breakdown
- [x] Analytics wave 2: ad-roi, google-search, demographics, lp-leaderboard, listing-performance
- [x] Analytics wave 3: meta-health, reports/lead-flow, reports/brokers, email/campaigns, geo
- [x] Final minor pages: reports/page (link list -> card-tile grid), reports/leads
  (funnel -> DashboardSummaryStrip), search (results in Cards + empty states).
  EVERY admin page is now at the bar.
- [ ] DAL hygiene (separate from the bar): move raw `supabase.from()` out of the
  page into `lib/data` for: search, reports/leads, reports/lead-flow.

## Broker-facing quick caps (high priority — daily drivers) — DONE
- [x] `analytics/action-required` — buckets capped to top 5 + "See all".
- [x] `deals` — desktop closed `<Table>` capped (matches mobile CLOSED_PREVIEW).
- [x] `signing` — "All envelopes" capped + "See all".
- [x] `crm/deals` kanban — each column capped to 8 + "See all in stage".

## Analytics/reports cluster — DONE (waves 1-3)
analytics/social · reports/lead-flow · analytics/meta-health · analytics/page
· reports/traffic-sources · analytics/ad-roi · analytics/cost-per-lead
· analytics/funnel-breakdown · analytics/google-search · analytics/demographics
· analytics/listing-performance · analytics/lp-leaderboard · reports/brokers
· email/campaigns · geo — all adopted TableWithMobileCards + DashboardSummaryStrip
+ caps + empty states. Remaining: search, reports/leads, reports/page (minor).

## DAL-boundary cleanups (G1) while touching these
`reports/leads`, `search`, `reports/lead-flow` call `supabase.from()` directly in
the page — move reads into `lib/data`.

## Verify (after curation) — /verify every workflow end to end
Lead lifecycle (create → enroll → next-step → send → log), tasks complete,
approvals approve/skip, deals checklist, signing, commissions, the analytics
reads. Confirm in a real browser, not just 200s.
