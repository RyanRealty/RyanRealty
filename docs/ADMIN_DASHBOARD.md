# Super Admin Command Center

The dashboard at **/admin** is a single-page operational view: sync health, database totals, lead/visit intelligence, and placeholders for GA4, notifications, content engine, site performance, and financial metrics.

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
- **Placeholder panel** with short description of what will appear: real-time users, traffic overview, acquisition, organic search (Search Console), top content, conversion funnel, device/geography.
- **Setup instructions**: Enable Google Analytics Data API, use a Service Account or OAuth client + refresh token, link to `docs/GOOGLE_APIS_WHERE_TO_GET.md`. Once the API is configured, this panel can be wired to fetch and display GA4 metrics for the selected date range.

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

- **GA4 Data API**: No server-side calls to Google Analytics yet. Requires Service Account (or OAuth + refresh token) and GA4 property ID; then add runReport (and real-time) calls and render results in the GA4 panel.
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
| `app/actions/dashboard.ts` | `getDashboardSyncData`, `getDashboardLeadData`, `getDashboardDataQuality` |
| `components/admin/DashboardPanel.tsx` | Collapsible panel with localStorage persistence |
| `components/admin/DashboardSyncPanel.tsx` | Sync + DB health content |
| `components/admin/DashboardLeadPanel.tsx` | Lead/visit intelligence content |
| `components/admin/DashboardGA4Panel.tsx` | GA4 placeholder + setup instructions |
| `components/admin/DashboardNotificationsPanel.tsx` | Notifications placeholder |
| `components/admin/DateRangeSelector.tsx` | Date presets + custom range (for future use by GA4/reports) |

## Quick links

From the dashboard bottom section: Sync, Geo, Banners, Reports, Spark status. These point to the existing admin pages so the broker can jump to full sync, geo hierarchy, etc., without leaving the admin area.
