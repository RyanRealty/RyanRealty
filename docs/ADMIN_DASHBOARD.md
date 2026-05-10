# Super Admin Command Center

The dashboard at **/admin** is a single-page operational view: sync health, GA4, Meta + FUB marketing performance, lead/visit intelligence, and operational panels for notifications, content status, site performance, and financial metrics.

## What’s implemented

### Layout and shell
- **Admin layout** (`app/admin/layout.tsx`): Header with “Super Admin” title, nav (Dashboard, Sync, Geo, Banners, Reports, Spark), and a global **admin search** bar (UI only; search across entities is not wired yet).
- **Dashboard page** (`app/admin/page.tsx`): Single page that loads all dashboard data and renders **collapsible panels**. Panel open/closed state is stored in **localStorage** (`admin_dashboard_panels`) so it persists across sessions.
- **Date range**: A date-range strip at the top (Last 30 days, Last 7 days, Today, Custom). Presets are UI only; GA4 and report panels will use this range once their APIs are connected.

### Sync operations and database health
- **Database totals**: Listings (total and active), photos, videos, history row count.
- **Current sync state**: Cron sync phase, listing page progress, “Run one chunk now” (reuses `CronSyncStatus` from the sync page).
- **Sync job history**: Last 10 runs with completed time, type, duration, listings count, and error (failed rows highlighted).
- **Data quality**: Active listings missing primary photo, photos classified (vision pipeline), history table status. Link to full sync page.
- **Listings by status**: Breakdown by status (from reporting cache) when available.

### Google Analytics (GA4) deep integration
- **Live panel** from `getGA4Summary()` with sessions, users, engagement/bounce, top sources, top pages, lead events, lead sources, and social channel sessions for the last 30 days.
- **Setup diagnostics**: Shows missing env vars or GA permission issues when service-account access is not configured.

### Marketing command center (Meta + GA4 + FUB)
- **Unified panel** with one marketing snapshot for the last 30 days:
  - Meta Ads summary (spend, CTR, frequency, lead actions, cost-per-lead when available)
  - GA4 seller acquisition context (sessions, social sessions, Facebook lead events, lead event rate)
  - FUB contact sync quality (total synced contacts and Facebook-sourced contacts)
  - Seller funnel conversion checkpoints (seller visits, Facebook-attributed seller visits, valuation requests)
- **Action layer**: Auto-generated next actions that highlight setup gaps or optimization priorities.
- **Weekly optimization report card**: Score + verdict + specific scale/pause/test/fix recommendations for fast execution.
- **Automated packet generation**: Weekly cron creates a structured `agent_insights` packet (`insight_type = marketing_optimization_weekly`) with an agent pickup prompt so the next agent can execute improvements immediately.
- **My Leads governance**: FUB panel computes a Matt-assigned pipeline snapshot, excludes likely realtor contacts from targeting, and shows stage distribution for a cleaner seller-focused follow-up system.
- **Outreach automation playbook**: Stage-based text/email/call sequence blueprint is included in the dashboard and automation packet.
- **FUB execution packet**: A second weekly cron (`/api/cron/fub-outreach-execution`) generates My Leads-only outreach packets, suppresses likely realtor contacts, and can optionally apply stage/tag updates plus notes directly in FUB when `FOLLOWUPBOSS_EXECUTION_ENABLED=true`.

### Lead and contact intelligence
- **Visit-based metrics**: Total visits, identified sessions (with `user_id`), identification rate, visits in last 24h (and identified in last 24h).
- **Recent activity**: Last 50 visits with time, path, and whether the visit had a user (identified). Hot leads, engagement scoring, and FUB link require Follow Up Boss API or a local contacts table.

### Notification center
- **Placeholder**: Short description of planned alerts (sync failure, API auth, hot leads, content queue, data quality). In-app feed and email/SMS toggles are not implemented yet.

### Other panels (stubs)
- **Content engine performance**: Placeholder for social content pipeline, content performance, queue health (when the content engine exists).
- **Site performance and technical health**: Placeholder for Core Web Vitals (Search Console API), index status, sitemap health, uptime, error log, CDN (requires Search Console and optional uptime monitoring).
- **Financial and business metrics**: Placeholder for manually maintained costs, listings under management, lead-to-close pipeline (Super Admin only).

## What’s not implemented yet

- **GA4 Data API**: Implemented for summary reporting, but still depends on service-account env vars and GA property access.
- **Meta Ads API visibility**: Panel needs `META_AD_ACCOUNT_ID` and a valid Meta token to render paid metrics.
- **FUB contacts quality depth**: Panel currently reads synced contact counts from `fub_contacts_cache`; deeper appointment/listing outcome metrics can be layered next.
- **FUB workflow execution**: Execution packet generation and optional write-back are now wired. Full always-on automated send behavior should still be staged carefully (start with dry-run mode, then enable apply mode after workflow QA in FUB).
- **Full autonomous execution loop**: Packet generation is automated, but execution still requires an agent run to apply changes and mark progress.
- **30-day sparklines**: No time-series storage or charts yet; all metrics show current values only.
- **Admin search**: The search input does not query listings, clients, agents, or communities yet. Plan: global search API or server action that searches across tables and returns grouped results.
- **Notification system**: No alert storage, no in-app feed, no email/SMS delivery. Plan: notifications table, event triggers (sync failure, etc.), and optional integration with an email/SMS provider.
- **Audit log**: No immutable audit log of record changes. Plan: append-only store, middleware or hooks to record user, timestamp, record type, field, old/new value; search and export for Super Admin/Admin.
- **Content engine / social pipeline**: Not built; panel is a stub.
- **Core Web Vitals / Search Console**: Not integrated; panel is a stub.
- **Financial panel**: Not populated; manual entry and display can be added later.

## Files

| Path | Purpose |
|------|--------|
| `app/admin/layout.tsx` | Admin shell, nav, search bar |
| `app/admin/page.tsx` | Dashboard: fetches data, renders panels |
| `app/actions/dashboard.ts` | Dashboard data loaders including sync, leads, data quality, content status, marketing command-center metrics |
| `components/admin/DashboardPanel.tsx` | Collapsible panel with localStorage persistence |
| `components/admin/DashboardSyncPanel.tsx` | Sync + DB health content |
| `components/admin/DashboardLeadPanel.tsx` | Lead/visit intelligence content |
| `components/admin/DashboardGA4Panel.tsx` | GA4 live metrics + setup diagnostics |
| `components/admin/DashboardMarketingCommandCenterPanel.tsx` | Unified Meta + GA4 + FUB marketing KPI panel |
| `app/api/cron/marketing-optimization-report/route.ts` | Weekly automation packet writer to `agent_insights` |
| `app/api/cron/fub-outreach-execution/route.ts` | Weekly FUB outreach execution packet (dry-run or apply mode) |
| `components/admin/DashboardNotificationsPanel.tsx` | Notifications placeholder |
| `components/admin/DateRangeSelector.tsx` | Date presets + custom range (for future use by GA4/reports) |

## Quick links

From the dashboard bottom section: Sync, Geo, Banners, Reports, Spark status. These point to the existing admin pages so the broker can jump to full sync, geo hierarchy, etc., without leaving the admin area.
