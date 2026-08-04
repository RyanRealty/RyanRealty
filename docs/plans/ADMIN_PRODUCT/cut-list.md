# Cut list (P5) — surfaces that do not exist in the new IA

Status: PROPOSED 2026-08-05, frozen only when the IA lock lands in decisions.md.
Two kinds of cut: **route cuts** (the URL/page dies) and **surface cuts** (the job
survives inside a destination, but the standalone surface dies). Never resurrect a
cut item during P9 rolls.

## Route cuts — the 26 redirect bridges

All are already pure redirects; in the new IA their targets are renamed/regrouped, so
each either dies outright or becomes a single canonical alias at cutover (decide per
route at P9; default die):

`/admin` (root dispatcher) · `/admin/console` · `/admin/console/leads` ·
`/admin/console/leads/[id]` · `/admin/people` · `/admin/people/[legacyId]` ·
`/admin/inbox` · `/admin/crm/automations` · `/admin/crm/reporting/deals` ·
`/admin/reports` · `/admin/performance` · `/admin/query-builder` · `/admin/search` ·
`/admin/transactions` · `/admin/expired-listings` · `/admin/expired-listings/[key]` ·
`/admin/expired-outreach` · `/admin/expireds` · `/admin/fsbos` · `/admin/banners` ·
`/admin/photos` · `/admin/stock-photos` · `/admin/resort-communities` ·
`/admin/spark-status` · `/admin/visitors` · `/admin/email`

## Surface cuts — jobs that fold into a destination

1. **The standalone CRM deals board** (`/admin/crm/deals`, `[id]`, `/pipelines`) — the
   one-deal-entity lock folds pre-close tracking into Closings. The pipeline-config
   generality (~21 rows used it) dies with it.
2. **`/admin/broker-dashboard` as a dashboard** — its jobs (triage, action queue, KPIs)
   become Today; a KPI wall is not a job.
3. **`/admin/operations` as a fourth landing page** — folds into Oversight.
4. **The second approval queue** — `/admin/approval-queue` and `/admin/crm/approvals`
   become ONE approvals lane in Today.
5. **`/admin/crm/tasks` + `/admin/crm/calendar` as destinations** — task/appointment
   items surface inside Today (Matt Q2: Tasks not weekly; a 590-row dump is not a lane).
6. **Duplicate lead-funnel renders** — `/admin/reports/leads`, `/admin/reports/lead-flow`,
   `/admin/analytics/action-required`, `/admin/analytics/ad-roi`,
   `/admin/analytics/cost-per-lead` collapse to one lead-funnel report (one
   `getLeadIntake` definition, one render) inside Reports.
7. **Triplicated report builder** — `/admin/reports/custom`, `/admin/reports/market`,
   `/admin/analytics` (builder part) collapse to one builder inside Reports.
8. **Three audience doors** — `/admin/newsletters/subscribers`,
   `/admin/crm/subscriptions`, `/admin/crm/settings/segments` collapse into Audiences.
9. **`/admin/crm` as "the CRM" namespace** — the namespace concept dies; its 60+ pages
   distribute to job destinations. No successor route carries the name.
10. **`/admin/crm/activity` global feed** — supervision evidence inside Oversight, not a
    destination.
11. **`/admin/visitors/live` as a standalone curiosity surface** — visitor trails become
    person-record evidence + an Oversight lane.
12. **BPO standalone triad** (`/admin/bpo*`) — one valuation worklist in Valuations
    (docType filter), per the P3 merge.

## Explicitly NOT cut

- `/admin/dscr` — maps to Prospecting (investor lane); open question #3 in ia-lock.md.
- Sequence editor + templates — survive under Settings (rare-use authoring).
- CSV import wizard — survives under People.
- Every TC surface — composes into Closings (six routes become lenses, none die).
