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

## Broker-facing quick caps (high priority — daily drivers)
- [ ] `analytics/action-required` — cap each lead bucket to top 5 + "See all" (only broker-facing dump).
- [ ] `deals` — cap the uncapped DESKTOP closed `<Table>` (mobile already curated).
- [ ] `signing` — cap "All envelopes" + "See all" (mobile cards exist).
- [ ] `crm/deals` kanban — cap each column to ~8 + "See all in stage".

## Analytics/reports cluster (adopt TableWithMobileCards + DashboardSummaryStrip + cap)
Worst-first: analytics/social (5) · reports/lead-flow (5) · analytics/meta-health (5)
· analytics/page (4) · reports/traffic-sources (4) · analytics/ad-roi (4)
· analytics/cost-per-lead (4) · analytics/funnel-breakdown (4)
· analytics/google-search (4) · analytics/demographics (3)
· analytics/listing-performance (3) · analytics/lp-leaderboard (3)
· reports/brokers (3) · email/campaigns (2) · geo (2) · search (2).

## DAL-boundary cleanups (G1) while touching these
`reports/leads`, `search`, `reports/lead-flow` call `supabase.from()` directly in
the page — move reads into `lib/data`.

## Verify (after curation) — /verify every workflow end to end
Lead lifecycle (create → enroll → next-step → send → log), tasks complete,
approvals approve/skip, deals checklist, signing, commissions, the analytics
reads. Confirm in a real browser, not just 200s.
