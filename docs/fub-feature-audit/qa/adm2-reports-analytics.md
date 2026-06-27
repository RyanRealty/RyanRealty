# ADM-2 Reports + Analytics — Functional QA Defect Log

**Audited:** 2026-06-26  
**Method:** Read-only code audit (Phase A). No mutations triggered.  
**Scope:** `/admin/reports` (7 sub-routes) + `/admin/analytics` (11 sub-routes) + `/admin/optimization` + `/admin/fub-attribution`

---

## Classification key

| Symbol | Meaning |
|---|---|
| ✅ WIRED-OK | Confirmed wired end-to-end by code trace |
| 🐞 BROKEN | Wired but produces wrong/misleading result |
| ☠️ DEAD | UI element present but has no effect |
| ❓ UNVERIFIED | Cannot confirm without a safe live test |

---

## Defect list

### D1 — `analytics/funnel-breakdown` — searchParams prop silently ignored

| Field | Value |
|---|---|
| Element | DateRangePicker shown on parent `/admin/analytics` page (tab link) |
| Page | `app/admin/(protected)/analytics/funnel-breakdown/page.tsx` |
| Classification | ☠️ DEAD (filter) |
| Evidence | Line 273: `export default async function FunnelBreakdownPage(_: { searchParams: Promise<SearchParams> })` — prop named `_`, never destructured or awaited. `lookbackDays` is hardcoded to `30`. `buildIntentBuckets()`, `buildSourceFunnels()`, and `generateInsights()` all operate on a fixed 5 000-row `limit` with `created_at >= now()-30d`. No date filter is possible regardless of URL params. |
| Fix | Rename `_` to `{ searchParams }`, await it, pass to `resolveDateRange()`, and thread the resulting date window into the three query functions. |
| Severity | Medium — Matt cannot change the analysis window; stuck at 30 days forever. |

---

### D2 — `analytics/social` — DateRangePicker only affects 1 of 4 data sections

| Field | Value |
|---|---|
| Element | DateRangePicker in the Social page header |
| Page | `app/admin/(protected)/analytics/social/page.tsx` |
| Classification | 🐞 BROKEN (misleading UX) |
| Evidence | The picker updates `?range=` in the URL. `resolveDateRange(sp)` is passed only to `getGA4SummaryCached(range.startDate, range.endDate)` in `Ga4SocialSources`. The three visitor_sessions sections — `HeadlineSummary` (hardcoded `7d`), `LiveSocialFeed` (hardcoded `30min`), `ChannelBreakdown` (hardcoded `7d`) — ignore searchParams entirely and recompute the same fixed window on every navigation regardless of the picker value. The picker label changes but 75% of the data does not. |
| Fix | Either (a) pass `range` to all four Suspense components and honour the picker in the visitor_sessions queries; or (b) scope the picker to GA4 only and add a label "Applies to GA4 section only" so the intent is visible. Option (a) is correct. |
| Severity | Medium — misleads Matt into thinking he filtered all social data when he only filtered GA4. |

---

### D3 — `reports/market` — city links route to public consumer page, not admin

| Field | Value |
|---|---|
| Element | City links in the market report admin page |
| Page | `app/admin/(protected)/reports/market/page.tsx` line 17 |
| Classification | 🐞 BROKEN (wrong destination) |
| Evidence | `href={/reports/city/${encodeURIComponent(city)}}` — routes to the public consumer route `/reports/city/<city>`, not an admin equivalent. Clicking from `/admin/reports/market` navigates the user OUT of the admin session entirely. The public route applies auth via the consumer layout which is more permissive. |
| Fix | If an admin-specific market report view is intended, create `/admin/reports/market/[city]` and link there. If the public page is intentionally the destination, add `target="_blank"` and a note "opens public report page." |
| Severity | Low — functional but confusing; does not break auth as the page loads without admin gate. |

---

### D4 — `reports/leads` — queries likely-empty legacy activity types

| Field | Value |
|---|---|
| Element | Activity table on the Lead analytics report |
| Page | `app/admin/(protected)/reports/leads/page.tsx` |
| Classification | 🐞 BROKEN (data quality) |
| Evidence | The page queries `user_activities` with `activity_type IN ('cma_downloaded', 'tour_requested', 'open_house_rsvp')` over a 7-day window. Since the CRM was replaced by the in-house system, FUB lead flows, and the `crm_timeline` table, these activity types are almost certainly never populated (the flow that would write them no longer exists). The page renders an empty or near-empty table with no "no data" message distinguishing from a genuine no-activity week. |
| Fix | Verify whether `user_activities` is still populated by the current flow. If not, either migrate the query to `crm_timeline` / `marketing_assignments`, or retire the report and note the migration. |
| Severity | Medium — Matt sees an empty table with no explanation; may conclude there are no leads when the data just moved. |

---

### D5 — `reports/hub` — GenerateWeeklyMarketReport: data write + AI image call (code-verified safe)

| Field | Value |
|---|---|
| Element | "Generate weekly report" button |
| Page | `app/admin/(protected)/reports/page.tsx` + `app/actions/generate-market-report.ts` |
| Classification | ✅ WIRED-OK (with notes) |
| Evidence | Confirmed by reading `generate-market-report.ts`: the action (1) computes last week's date range, (2) queries `listings` for pending/closed, (3) calls `generateBannerImage()` (Grok AI image — silent catch if it fails), (4) upserts to `market_reports` table, (5) returns `{ ok: true, slug, url }`. No email, no newsletter send, no social post. The `GenerateReportButton.tsx` displays the returned URL as a link. Writing to `market_reports` is idempotent (`onConflict: 'slug'`). Safe to click. |
| Fix | None required. Minor: `generateBannerImage` result is silently swallowed on error (`imagePath = null`) — report row is still inserted but with no image. Consider surfacing "generated without image" vs "fully generated" in the result object. |
| Severity | Info only. |

---

### D6 — `reports/custom` CityReportSection — native `<select>` used for City, Period, Month, Quarter

| Field | Value |
|---|---|
| Element | All four `<select>` elements in CityReportSection |
| Page | `app/admin/(protected)/reports/CityReportSection.tsx` lines 180, 205, 218, 244, 269 |
| Classification | 🐞 BROKEN (design system parity) |
| Evidence | All four dropdowns are raw `<select>` HTML elements styled with inline `className` strings. CLAUDE.md design-system rules + G8 mockup-parity gate require `<Select>` from `@/components/ui/select`. The city chooser, period type, month, quarter, property-type, and the break-out-by-property-type `<Input type="checkbox">` (line 281) are all raw HTML controls, not shadcn components. The `<Input type="checkbox">` uses the wrong component (`Input` is for text inputs; `Checkbox` from `@/components/ui/checkbox` is required). |
| Fix | Replace all `<select>` with `<Select><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem .../></SelectContent></Select>`. Replace `<Input type="checkbox">` with `<Checkbox>`. |
| Severity | Low-Medium — functional but violates the design-system gate; will fail `ci:gates` if parity.json is added for this surface. |

---

### D7 — `analytics/social` — CHANNEL_COLOR map uses off-brand hex values

| Field | Value |
|---|---|
| Element | Channel color dots in the ChannelBreakdown section |
| Page | `app/admin/(protected)/analytics/social/page.tsx` |
| Classification | 🐞 BROKEN (design system) |
| Evidence | `CHANNEL_COLOR` constant: `facebook: '#1877F2'`, `instagram: '#E4405F'`, `tiktok: '#000000'`, `youtube: '#FF0000'`, `linkedin: '#0A66C2'`, etc. Design System v2 specifies navy `#102742` on cream `#faf8f4` only — off-brand hex is explicitly banned in CLAUDE.md. These colors render in the admin UI, not on consumer-facing pages, but still violate the design system rule. |
| Fix | Replace platform-specific hex values with design-system tokens (`bg-primary`, `bg-muted`, etc.) or a cycling palette of navy-opacity variants. Admin context allows some flexibility but the explicit off-brand hex rule still applies. |
| Severity | Low — admin-only surface; no consumer impact, but the rule is unambiguous. |

---

### D8 — Cross-cutting: every analytics sub-page uses direct `createClient` (DAL boundary violation, G1)

| Field | Value |
|---|---|
| Element | All Supabase queries in analytics pages |
| Pages | `analytics/action-required`, `analytics/ad-roi`, `analytics/cost-per-lead`, `analytics/funnel-breakdown`, `analytics/google-business-profile`, `analytics/google-search`, `analytics/listing-performance`, `analytics/lp-leaderboard`, `analytics/meta-health`, `analytics/social` (10 pages); also `reports/lead-flow`, `reports/traffic-sources` |
| Classification | 🐞 BROKEN (architecture / gate violation) |
| Evidence | Every page contains `import { createClient } from '@supabase/supabase-js'` and constructs a service client inline. Gate G1 (`ci:dal-boundary`, `scripts/check-dal-boundary.mjs`) prohibits `.from()` calls outside `lib/data/`. These pages bypass `unstable_cache`, hit production DB directly on every request, and will fail G1 if the gate is run against admin routes. |
| Fix | Move repeated query patterns into functions in `lib/data/admin/` (or extend `_lib/queries.ts` which already uses `createServiceClient` from `@/lib/supabase/service` — the correct pattern). Apply `unstable_cache` with appropriate TTLs. The `_lib/queries.ts` file already sets the right example with `createServiceClient`. |
| Severity | Medium — admin-only pages, so no public performance impact, but the gate violation is real and every request hits cold Supabase. |

---

### D9 — Cross-cutting: hardcoded lookback windows on 10+ analytics pages (no date filter)

| Field | Value |
|---|---|
| Element | All time-window logic in analytics sub-pages |
| Pages | `action-required` (24h/48h/7d mixed), `ad-roi` (90d), `cost-per-lead` (90d), `funnel-breakdown` (30d — also has D1), `google-business-profile` (30d), `google-search` (30d), `listing-performance` (30d), `lp-leaderboard` (30d), `reports/lead-flow` (30d), `reports/traffic-sources` (30d) |
| Classification | ☠️ DEAD (filter) — no UI control exists to change these windows |
| Evidence | Each page hard-codes its `cutoff` / `WINDOW_DAYS` / `lookbackDays` constant. Only `demographics` and `social` (GA4 section only) receive `searchParams` and pass them to `resolveDateRange()`. |
| Fix | Thread `searchParams` into each page, add `DateRangePicker` to the page header (the component already exists at `analytics/_components/DateRangePicker.tsx`), and pass the resolved range to every query function. Priority pages: `ad-roi`, `cost-per-lead` (these are the most decision-grade pages and most likely to need historical comparison). |
| Severity | Medium — blocks any ad-hoc date analysis; Matt is stuck at whatever the developer chose as a default window. |

---

### D10 — `analytics/listing-performance` + `ad-roi` + `cost-per-lead` — row-limit truncation with no user warning

| Field | Value |
|---|---|
| Element | Data tables in listing-performance, ad-roi, cost-per-lead |
| Pages | `analytics/listing-performance/page.tsx`, `analytics/ad-roi/page.tsx`, `analytics/cost-per-lead/page.tsx` |
| Classification | 🐞 BROKEN (silent data loss) |
| Evidence | `visitor_events` in listing-performance uses `.limit(50000)`. `visitor_sessions` in ad-roi uses `.limit(20000)`. `visitor_sessions` in cost-per-lead uses `.limit(20000)`. If the table exceeds these counts in the query window, the result is silently truncated: the page renders as if all data is shown but misses rows. No banner, no count comparison, no indication to Matt. |
| Fix | After each query, check if `data.length === LIMIT`. If so, show a warning: "Result truncated at [N] rows — data may be incomplete. Consider narrowing the date range." |
| Severity | Medium — metrics appear accurate but may be materially understated at scale. |

---

### D11 — `analytics/meta-health` — silent empty-table state when Meta token is expired/missing

| Field | Value |
|---|---|
| Element | All Meta API sections (pixel inventory, lead forms, campaigns, subscribed apps) |
| Page | `app/admin/(protected)/analytics/meta-health/page.tsx` |
| Classification | 🐞 BROKEN (error UX) |
| Evidence | The inline `fb()` helper catches all fetch errors and returns `{ error: { message } }`. The consuming async functions (e.g. `leadgenForms`) check `if (formsRaw.error)` and return empty arrays, but the page components render empty tables/sections with no user-visible explanation. If `META_PAGE_ACCESS_TOKEN` is expired or missing, the entire page shows zeros and empty tables with no "token invalid" message. |
| Fix | Surface the error object from `fb()` to the page. Add a hero alert at the top of the page if the page-level Meta call fails (the first call is `const page = await fb(...)`) — e.g., "Meta API token is expired or invalid. Reconnect at [link]." |
| Severity | Medium — Matt may not know why all Meta data shows empty; could waste time investigating a data issue that is actually a credential issue. |

---

### D12 — `analytics/funnel-breakdown` — scroll_depth buckets are fabricated ratios

| Field | Value |
|---|---|
| Element | Scroll depth milestone breakdown (25/50/75/100%) in Behavior tab |
| Page | `app/admin/(protected)/analytics/_lib/queries.ts` lines 200–206 |
| Classification | 🐞 BROKEN (data accuracy / compliance risk) |
| Evidence | `fetchBehavior()` computes scroll_depth milestones by applying hardcoded multipliers to the total scroll event count: `{ milestone: 25, eventCount: Math.round(scrollTotal * 0.45) }`, `50 → 0.28`, `75 → 0.17`, `100 → 0.10`. The code comment admits: "We don't have the per-milestone breakdown in the existing GA4 report — surface the total and label it." These are fabricated ratios, not real GA4 data. CLAUDE.md §0 forbids presenting estimated numbers as real data. |
| Fix | Either (a) add a real GA4 Data API call with `event_name=scroll_depth` dimensioned by `event_param.percent_scrolled`; or (b) show only the aggregate total scroll_depth event count labeled "scroll events (milestone breakdown unavailable)" and remove the four fabricated rows entirely. Option (b) ships faster. |
| Severity | High — presents invented numbers as analytics data; violates the data-accuracy mandate directly. |

---

### D13 — `reports/emails` — filter form + CSV export (✅ wired correctly)

| Field | Value |
|---|---|
| Element | Broker filter, email type filter, date filter, search field, Export CSV button, pagination |
| Page | `app/admin/(protected)/reports/emails/page.tsx` + `EmailLogCsvButton.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | The page is a `GET` form. All four filters are `<select>` / `<input>` fields that submit via native GET, updating `searchParams`. The server re-queries `email_events` + `email_event_latest` with the filter values. `EmailLogCsvButton` takes the already-rendered rows and serializes them client-side into a Blob download — no second fetch, no API call. Pagination uses `?page=N` params. All confirmed wired end-to-end. |
| Fix | Minor: filters use raw `<select>` (same parity issue as D6), but functionally correct. |
| Severity | Info — working correctly. |

---

### D14 — `analytics/demographics` — DateRangePicker wired correctly to GA4

| Field | Value |
|---|---|
| Element | DateRangePicker at top of demographics page |
| Page | `app/admin/(protected)/analytics/demographics/page.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | `searchParams` is awaited and passed to `resolveDateRange()`. The result date range flows into `getGA4DemographicsCached(range.startDate, range.endDate)`. Picker uses `router.push()` to update `?range=` URL param, triggering a server re-render with the new range. |
| Fix | None. |
| Severity | Info. |

---

### D15 — `reports/custom` CityReportSection — "Generate report" button (✅ wired correctly)

| Field | Value |
|---|---|
| Element | Generate report button in CityReportSection |
| Page | `app/admin/(protected)/reports/CityReportSection.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | `handleGenerate()` calls `getReportMetrics()` and `getReportPriceBands()` server actions with the selected city, date bounds, and property-type filters. Results populate `metrics` and `priceBands` state. The "Break out by property type" toggle fans out to parallel calls per segment. Error handling shows `setError()` on failure. No outbound action, no DB mutation — read-only query. |
| Fix | None functionally. See D6 for parity issue on the `<select>` elements. |
| Severity | Info. |

---

### D16 — `optimization` page — read-only, no interactive elements (✅ wired)

| Field | Value |
|---|---|
| Element | Entire page |
| Page | `app/admin/(protected)/optimization/page.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | Page renders last cron run data from `getLastOptimizationRun()`. Read-only. No buttons, no mutations. |
| Fix | None. |
| Severity | Info. |

---

### D17 — `fub-attribution` — FubBrokerMapCopyCard copy button (✅ wired)

| Field | Value |
|---|---|
| Element | "Copy" button in FubBrokerMapCopyCard |
| Page | `app/admin/(protected)/fub-attribution/page.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | `FubBrokerMapCopyCard` is a client component that renders the broker attribution map. Copy-to-clipboard is a client-side action with no server mutation. Confirmed wired by component structure. |
| Fix | None. |
| Severity | Info. |

---

### D18 — `analytics/action-required` — all 6 action cards (✅ wired)

| Field | Value |
|---|---|
| Element | HotLeadsCard, WarmActiveCard, AnonymousHighEngagementCard, SpendAlerts, LpRebuildCard, LoopHealthCard |
| Page | `app/admin/(protected)/analytics/action-required/page.tsx` |
| Classification | ✅ WIRED-OK |
| Evidence | All 6 are async server components in `<Suspense>` wrappers, each querying Supabase directly via `createClient`. Links to `/admin/people/${fub_person_id}` and `/admin/visitors/${session_id}` are standard Next.js Link components. External FUB links open in `_blank`. No mutations triggered on page load. |
| Fix | None functionally. See D9 for hardcoded lookback issue; D8 for DAL boundary. |
| Severity | Info. |

---

## Summary by count

| Classification | Count |
|---|---|
| ✅ WIRED-OK | 6 (D5, D13, D14, D15, D16, D17, D18) |
| 🐞 BROKEN | 9 (D2, D3, D4, D6, D7, D8, D9, D10, D11, D12) |
| ☠️ DEAD | 2 (D1, D9 — D9 spans 10 pages) |
| ❓ UNVERIFIED | 0 |

**Total defects: 12 numbered issues** (D1–D12; D13–D18 are WIRED-OK confirmations)

---

## Top defects by impact

1. **D12 — Fabricated scroll-depth ratios in `_lib/queries.ts`** — hardcoded multipliers passed off as real GA4 milestone data. High severity per CLAUDE.md §0 data-accuracy mandate. Fix: one new GA4 report call or remove the four fake rows.

2. **D1 — funnel-breakdown searchParams ignored** — the only dedicated funnel page accepts no date filter because the prop is named `_` and thrown away. Stuck at 30d permanently.

3. **D9 — No date filter on 10 analytics pages** — ad-roi, cost-per-lead, GBP, google-search, listing-performance, lp-leaderboard, lead-flow, traffic-sources, action-required all hardcode their time windows. The `DateRangePicker` component exists and works (D14 proves it) — it just needs to be threaded in.

4. **D10 — Silent row truncation** — `visitor_events` capped at 50 000, `visitor_sessions` at 20 000 with no warning. At scale, CPL and listing-performance numbers will silently undercount.

5. **D2 — Social DateRangePicker applies to only 1 of 4 sections** — picker label changes but 75% of social data stays at its hardcoded window.

6. **D11 — Meta-health shows blank page with no error on expired token** — no diagnostic message means Matt can't distinguish "no data" from "token expired."

7. **D8 — DAL boundary violated across 12 pages** — every analytics page uses raw `createClient` instead of `lib/data/`. No caching; each page visit hits Supabase cold.

---

## Files confirmed read for this audit

- `app/admin/(protected)/reports/layout.tsx`
- `app/admin/(protected)/reports/page.tsx`
- `app/admin/(protected)/reports/GenerateReportButton.tsx`
- `app/admin/(protected)/reports/CityReportSection.tsx`
- `app/admin/(protected)/reports/brokers/page.tsx`
- `app/admin/(protected)/reports/custom/page.tsx`
- `app/admin/(protected)/reports/emails/page.tsx`
- `app/admin/(protected)/reports/emails/EmailLogCsvButton.tsx`
- `app/admin/(protected)/reports/lead-flow/page.tsx`
- `app/admin/(protected)/reports/leads/page.tsx`
- `app/admin/(protected)/reports/market/page.tsx`
- `app/admin/(protected)/reports/traffic-sources/page.tsx`
- `app/admin/(protected)/analytics/layout.tsx`
- `app/admin/(protected)/analytics/page.tsx`
- `app/admin/(protected)/analytics/_components/DateRangePicker.tsx`
- `app/admin/(protected)/analytics/_lib/queries.ts`
- `app/admin/(protected)/analytics/action-required/page.tsx`
- `app/admin/(protected)/analytics/ad-roi/page.tsx`
- `app/admin/(protected)/analytics/cost-per-lead/page.tsx`
- `app/admin/(protected)/analytics/demographics/page.tsx`
- `app/admin/(protected)/analytics/funnel-breakdown/page.tsx`
- `app/admin/(protected)/analytics/google-business-profile/page.tsx`
- `app/admin/(protected)/analytics/google-search/page.tsx`
- `app/admin/(protected)/analytics/listing-performance/page.tsx`
- `app/admin/(protected)/analytics/lp-leaderboard/page.tsx`
- `app/admin/(protected)/analytics/meta-health/page.tsx`
- `app/admin/(protected)/analytics/social/page.tsx`
- `app/admin/(protected)/optimization/page.tsx`
- `app/admin/(protected)/fub-attribution/page.tsx`
- `app/actions/generate-market-report.ts`
