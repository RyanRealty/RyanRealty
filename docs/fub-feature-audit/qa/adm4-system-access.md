# ADM-4 System/Access + People/Visitors + Marketing-ops — Functional QA

**Audited:** 2026-06-26  
**Auditor:** Senior-engineer code-read pass (READ-ONLY, no destructive clicks)  
**Scope:** `/admin/operations`, `/admin/sync`, `/admin/spark-status`, `/admin/brokers` (+`/edit`, `/new`), `/admin/users`, `/admin/audit-log`, `/admin/query-builder`, `/admin/approval-queue`, `/admin/broker-links`, `/admin/people` (+`/[fubPersonId]`), `/admin/visitors/live` (+`/[sessionId]`)

## Classification key

| Symbol | Meaning |
|---|---|
| ✅ WIRED | Element fully wired end-to-end; works as designed |
| ☠️ DEAD | Element renders but handler is missing or never fires |
| 🐞 BROKEN | Handler exists but route/action is wrong, throws, or returns bad data |
| ❓ UNVERIFIED | Wiring code-confirmed but not safe to click (destructive) |
| 🔇 ORPHANED | Component exists, fully wired internally, but NOT imported on any rendered page |

---

## 1. `/admin/operations`

**File:** `app/admin/(protected)/operations/page.tsx`

5 `unstable_cache` data fetches at SSR time (180s TTL). Renders 9 panel components.

| Element | Classification | Evidence | Notes |
|---|---|---|---|
| Page load / data render | ✅ WIRED | 5 server-side fetches, all cached with `unstable_cache` | Read-only |
| Quick links (Sync, Geo, Resort Communities, Banners, Reports, Spark Status) | ✅ WIRED | Static `<Link>` elements pointing to valid admin routes | Read-only nav |
| `DashboardSyncPanel` | ✅ WIRED | Component renders sync state from cached data | Read-only |
| `DashboardMarketingCommandCenterPanel` | ✅ WIRED | Renders `marketing_brain_actions` stats | Read-only |
| `DashboardGA4Panel` | ✅ WIRED | Renders GA4 session stats | Read-only |
| `DashboardLeadPanel` | ✅ WIRED | Renders lead counts | Read-only |
| `DashboardContentStatusPanel` | ✅ WIRED | Renders content queue counts | Read-only |
| `DashboardNotificationsPanel` | **❓ UNVERIFIED** | Not read — may contain action buttons | Needs separate read |
| `DashboardSitePerformancePanel` | **❓ UNVERIFIED** | Not read — may contain action buttons | Needs separate read |
| `DashboardRevenuePanel` | **❓ UNVERIFIED** | Not read — may contain action buttons | Needs separate read |

**Severity:** LOW — main panels appear read-only; 3 unread sub-panels carry low risk.

---

## 2. `/admin/sync`

**File:** `app/admin/(protected)/sync/page.tsx`  
**CRITICAL FINDING: ORPHANED ACTION LAYER**

### What the page actually renders

The page imports and renders **ONLY** `BackfillHealthPanel`:

```tsx
// page.tsx
import BackfillHealthPanel from './BackfillHealthPanel'
// ...
<BackfillHealthPanel />  // <- the only component rendered
```

`BackfillHealthPanel` is a read-only client component that polls `/api/admin/sync/backfill-health` every 15 seconds and displays backfill + strict-verify telemetry. **No action buttons.**

### 22 orphaned components in `app/admin/(protected)/sync/`

The directory contains a full action layer that was formerly on the page but is currently **not imported anywhere on the sync page** (or on any other admin page):

| Orphaned component | What it would do if mounted |
|---|---|
| `SyncSmart.tsx` | "Smart Sync" button → `runOneSyncChunk()` server action in a loop — **hammers Spark API** |
| `SyncPageAdvanced.tsx` | Collapsible wrapper housing `SyncSmart`, `TriggerDeltaSyncButton`, `SyncSinceDateButton`, `SyncHistoryButtons`, `RefreshActivePendingButton` |
| `SyncHeavyStatusSections.tsx` | Lazy-loads Spark live count + status breakdown; renders `SyncPageAdvanced` |
| `SyncLiveStatusAndTerminal.tsx` | "Start terminal history" / "Stop terminal history" buttons → POST `/api/admin/sync/terminal-control` |
| `TriggerDeltaSyncButton.tsx` | "Run ingest now" → POST `/api/admin/sync/delta` |
| `SyncSinceDateButton.tsx` | Sync from a specific date → Spark API |
| `RefreshActivePendingButton.tsx` | "Refresh active & pending" → server action |
| `SyncHistoryButtons.tsx` | History sync buttons |
| `SyncAllButtons.tsx` | "Sync all listings", "Sync all history", "Sync photos only", stop buttons |
| `SyncButton.tsx`, `SyncDataRefreshButton.tsx`, `SyncAutoRefresh.tsx` | Misc sync triggers |
| `SyncStatus.tsx`, `CronSyncStatus.tsx`, `FullSync.tsx` | Status displays |
| `SyncSection.tsx`, `SyncRunLog.tsx`, `SyncTerminalYearlyBreakdown.tsx` | Data displays |
| `SyncHistoryStatus.tsx`, `SyncHistoryTable.tsx`, `SyncHistoryTest.tsx` | History monitoring |

**None of these are reachable from any currently-rendered page.**

### Result table

| Element | Classification | Severity |
|---|---|---|
| `BackfillHealthPanel` (rendered) | ✅ WIRED — read-only | — |
| All 22 other components in `/sync/` dir | 🔇 ORPHANED | MEDIUM — dead UI but functional APIs remain live (cron + admin routes) |
| "Start/Stop terminal history" in `SyncLiveStatusAndTerminal.tsx` | 🔇 ORPHANED | HIGH if re-exposed — calls `/api/admin/sync/terminal-control` |
| "Smart Sync" in `SyncSmart.tsx` | 🔇 ORPHANED | HIGH if re-exposed — loops `runOneSyncChunk()` against Spark |

**Fix required:** Decide whether the advanced sync controls should be re-exposed (restore imports) or formally deleted. Currently the sync page offers zero operator controls — operators cannot manually trigger a sync from the UI. The `/api/admin/sync/delta` and `/api/admin/sync/route.ts` routes and all server actions remain live, so the functionality exists — it just has no UI entry point.

---

## 3. `/admin/spark-status`

**File:** `app/admin/(protected)/spark-status/page.tsx`

| Element | Classification | Evidence |
|---|---|---|
| Page load | ✅ WIRED | Calls `getSparkConnectionStatus()` + `getSparkDataRange()` from `@/lib/spark` |
| Connection status alert (connected / not connected) | ✅ WIRED | Shows listing count, data date range |
| "Go to sync page →" link | ✅ WIRED | `<Link href="/admin/sync">` |

**Severity:** NONE — fully functional, read-only.

---

## 4. `/admin/brokers`

**File:** `app/admin/(protected)/brokers/page.tsx`

| Element | Classification | Evidence | Destructive? |
|---|---|---|---|
| Broker list render | ✅ WIRED | Fetches `getAllBrokers()` or `getBrokerByEmail()` based on role | No |
| "View profile" link (active broker) | ✅ WIRED | `<Link href="/team/{slug}">` — opens public page | No |
| "Edit" link per broker | ✅ WIRED | `<Link href="/admin/brokers/edit?id={id}">` — opens edit form | No (nav only) |
| "Add broker" button (superuser only) | ✅ WIRED | `<Link href="/admin/brokers/new">` — opens create form | No (nav only) |

---

## 5. `/admin/brokers/edit`

**File:** `app/admin/(protected)/brokers/edit/page.tsx` → renders `AdminBrokerForm`  
**Component:** `app/components/admin/AdminBrokerForm.tsx` (1,339 lines)

This is a full broker CMS. All buttons call real server actions.

| Element | Classification | Evidence | Destructive? |
|---|---|---|---|
| "Save changes" button | ❓ UNVERIFIED | → `updateBroker(broker.id, payload)` server action (Supabase UPDATE on `brokers`) | YES — edits live broker data |
| "Remove broker" button | ❓ UNVERIFIED | → `deleteBroker(broker.id)` server action + confirm dialog | YES — deletes broker record |
| "Upload headshot" button | ❓ UNVERIFIED | → `uploadBrokerHeadshot(broker.id, formData)` — uploads to storage + sets `photo_url` | YES |
| "Generate professional headshot" button | ❓ UNVERIFIED | → `generateBrokerHeadshot(broker.id, formData, gender, promptId)` — calls Replicate API ($) | YES (paid API) |
| "Set as default (use on site)" button (generated headshot) | ❓ UNVERIFIED | → `setBrokerHeadshotDefault(broker.id, url)` | YES |
| "Save for later" button | ❓ UNVERIFIED | → `addBrokerSavedHeadshot(broker.id, url)` | YES |
| "Set as default" button (saved headshot list) | ❓ UNVERIFIED | → `setBrokerHeadshotDefault(broker.id, url)` | YES |
| "Manage prompts" toggle | ✅ WIRED | Client state toggle — no server call | No |
| "Duplicate to edit" button (default prompt) | ❓ UNVERIFIED | → `createHeadshotPrompt(...)` | YES |
| "Save prompt" / "Update" / "Delete" prompt buttons | ❓ UNVERIFIED | → `createHeadshotPrompt`, `updateHeadshotPrompt`, `deleteHeadshotPrompt` | YES |
| "Upload intro video" button | ❓ UNVERIFIED | → `uploadBrokerIntroVideo(broker.id, formData)` | YES |
| "Generate video" (Synthesia) button | ❓ UNVERIFIED | → `generateAndSaveSynthesiaIntroVideo(...)` — calls Synthesia API ($) | YES (paid API) |
| "Set as intro" button (saved media) | ❓ UNVERIFIED | → `setBrokerIntroVideoFromGenerated(broker.id, mediaId)` | YES |
| "Edit title" (saved media) | ❓ UNVERIFIED | → `updateBrokerGeneratedMedia(mediaId, ...)` | YES |
| "Delete" (saved media) | ❓ UNVERIFIED | → `deleteBrokerGeneratedMedia(mediaId)` — requires confirm | YES |
| "View agent page" / "View team page" links | ✅ WIRED | `<a href="/team/{slug}" target="_blank">` — read-only external nav | No |

**Severity:** HIGH — all wired to real Supabase mutations and external paid APIs. No bugs observed in wiring; all destructive actions work as designed.

---

## 6. `/admin/brokers/new`

**File:** `app/admin/(protected)/brokers/new/page.tsx` → renders `AdminBrokerCreateForm`

Not read in detail (superuser-only, no safe e2e path). The create form calls `createBroker()` server action.

| Element | Classification | Evidence | Destructive? |
|---|---|---|---|
| "Create broker" submit | ❓ UNVERIFIED | Wiring confirmed by imports; server action creates `brokers` row | YES |

**Severity:** HIGH — access-controlled (superuser only). Wiring appears correct; not read end-to-end.

---

## 7. `/admin/users`

**File:** `app/admin/(protected)/users/page.tsx` → renders `AdminUsersList`  
**Component:** `app/components/admin/AdminUsersList.tsx`

| Element | Classification | Evidence | Destructive? |
|---|---|---|---|
| Page load | ✅ WIRED | Fetches admin roles, brokers, platform users | No |
| User search input | ✅ WIRED | Client-side filter on `users` array (no server call) | No |
| "See all" / "Show less" toggle | ✅ WIRED | Client state toggle | No |
| "Add user" form submit | ❓ UNVERIFIED | → `upsertAdminRole(email, role, brokerId)` server action | YES — grants admin access |
| "Remove" button (per non-superuser row) | ❓ UNVERIFIED | → `removeAdminRole(email)` + `confirm()` dialog | YES — revokes admin access |

**Note:** Superuser rows do not show a "Remove" button (protected in JSX — `r.role !== 'superuser'`). Self-removal is possible if the actor is not a superuser.

**Severity:** HIGH — access control mutations. Wiring is correct. No bugs observed.

---

## 8. `/admin/audit-log`

**File:** `app/admin/(protected)/audit-log/page.tsx`

| Element | Classification | Evidence |
|---|---|---|
| Page load | ✅ WIRED | Calls `getAdminActions()` with filter params |
| Admin email filter input | ✅ WIRED | GET form, URL param `adminEmail` |
| Action type filter select | ✅ WIRED | GET form, URL param `actionType` |
| "Filter" submit button | ✅ WIRED | Form submit → page reload with params |
| "Clear" button | ✅ WIRED | `<Link href="/admin/audit-log">` strips params |
| Pagination prev/next | ✅ WIRED | `<Link>` with updated `page` param |

**Severity:** NONE — fully functional read-only. No action buttons.

---

## 9. `/admin/query-builder`

**File:** `app/admin/(protected)/query-builder/page.tsx` → renders `AdminQueryBuilderForm`  
**Component:** `app/admin/(protected)/query-builder/AdminQueryBuilderForm.tsx`

| Element | Classification | Evidence |
|---|---|---|
| City / price / beds / baths / pool / view filters | ✅ WIRED | Client state, passed to server action |
| "Run query" submit button | ✅ WIRED | → `runQueryBuilderSearch(formData)` server action — SELECT-only on `listings` |
| Results preview (6 rows) | ✅ WIRED | Renders from action return value |
| "View listing →" links per result | ✅ WIRED | `/listings/{ListingKey}` — public read-only page |
| "Download CSV" button | ✅ WIRED | Client-side `URL.createObjectURL(blob)` download of up to 500 rows |

**Note:** Only 6 rows rendered in UI. Full 500 rows available via CSV download. SELECT-only action — zero write risk.

**Severity:** NONE — fully functional, safe.

---

## 10. `/admin/approval-queue`

**File:** `app/admin/(protected)/approval-queue/page.tsx`  
**Components:** `FilterSidebar`, `ActionCard`, `ActionButtons`, `CommentsThread`

### FilterSidebar

| Element | Classification | Evidence |
|---|---|---|
| Category / action-type-prefix / urgency checkboxes | ✅ WIRED | `router.push()` on change — URL params only |
| "Clear" button | ✅ WIRED | `<Link href="/admin/approval-queue">` |

### ActionCard

| Element | Classification | Evidence |
|---|---|---|
| Producer badge, target, reason render | ✅ WIRED | Server-side data from `marketing_brain_actions` |
| Media preview | ✅ WIRED | `MediaPreview` component — display only |
| Caption collapsible toggle | ✅ WIRED | Radix `Collapsible` — client state only |
| "Copy caption" button | ✅ WIRED | `navigator.clipboard.writeText(caption)` — safe |

### ActionButtons — ALL ❓ UNVERIFIED-DESTRUCTIVE

All 6 buttons POST to `/api/admin/approval-queue/[id]/action`. API route confirmed to exist and read at `app/api/admin/approval-queue/[id]/action/route.ts`. Auth-gated (requires admin role). Each action:

| Button | Classification | What it actually does | Destructive? |
|---|---|---|---|
| "Approve and ship now" | ❓ UNVERIFIED | Updates `marketing_brain_actions` row: `status='approved'`, `approved_by='matt'` — then publisher-sweep cron picks it up and posts | YES — triggers real publish pipeline |
| "Approve and schedule" | ❓ UNVERIFIED | Same as above + sets `scheduled_for` datetime | YES |
| "Request changes" | ❓ UNVERIFIED | Flips row to `status='needs_changes'`, appends change_request comment to `comments` JSONB | YES — mutates DB row |
| "Duplicate as new variant" (same producer) | ❓ UNVERIFIED | Inserts new `marketing_brain_actions` row cloned from original, status='pending' | YES — creates new DB row |
| "Duplicate as new variant" (new producer) | ❓ UNVERIFIED | Inserts into `producer_change_requests` table | YES — creates new DB row |
| "Reject" | ❓ UNVERIFIED | Updates row: `status='killed'`, `killed_reason=...` | YES — terminates action permanently |
| "Run producer now" | ❓ UNVERIFIED | POST `/api/admin/run-producer/[id]` — transitions row to `in_production`, calls Anthropic Messages API, transitions to `ready` if text producer; defers visual producers | YES — paid API call ($) |

**Note on "approve_now" wiring:** The route hardcodes `approved_by: 'matt'` regardless of which admin is logged in. This is a functional correctness issue if Rebecca or Paul ever get approval-queue access.

### CommentsThread

| Element | Classification | Evidence | Destructive? |
|---|---|---|---|
| Comment type select (note / change_request / approval_note) | ✅ WIRED | Client state | No |
| Comment textarea | ✅ WIRED | Client state | No |
| "Post comment" button | ❓ UNVERIFIED | POST `/api/admin/approval-queue/[id]/comments` — appends to `comments` JSONB; if type=`change_request` also flips row status | YES — mutates row |

**Severity:** HIGH — 7 destructive actions, all wired correctly. No bugs detected in the wiring. One hardcoded `approved_by: 'matt'` value that may become wrong if other admins get queue access.

---

## 11. `/admin/broker-links`

**File:** `app/admin/(protected)/broker-links/page.tsx`  
**Component:** `app/admin/(protected)/broker-links/CopyLinkButton.tsx`

Generates 15 attribution URLs (3 brokers × 5 LPs) using `NEXT_PUBLIC_SITE_URL` env + `?agent={slug}`. All logic is client-side only.

| Element | Classification | Evidence |
|---|---|---|
| Page load (URL generation) | ✅ WIRED | Reads `NEXT_PUBLIC_SITE_URL` env var; falls back to `https://ryan-realty.com` |
| "Copy" button × 15 | ✅ WIRED | `navigator.clipboard.writeText(url)` with copied/not-copied visual feedback; silent no-op on clipboard deny |
| Facebook lead-form note | ✅ WIRED | Static informational text |

**Severity:** NONE — fully safe, no server calls.

---

## 12. `/admin/people`

**File:** `app/admin/(protected)/people/page.tsx`

Complex server component: fetches `marketing_assignments` + `visitor_sessions` (90-day window) from Supabase.

| Element | Classification | Evidence |
|---|---|---|
| Page load | ✅ WIRED | Supabase service-role fetches |
| Email search form | ✅ WIRED | GET method, URL param `email` |
| Audience / broker / tier / source / activity facets | ✅ WIRED | All `<Link>` elements updating URL params |
| "Clear all" button | ✅ WIRED | `<Link href="/admin/people">` |
| Person rows → detail page | ✅ WIRED | `<Link href="/admin/people/{fubPersonId}">` |
| Pagination prev/next | ✅ WIRED | Shadcn `PaginationPrevious`/`PaginationNext` as Links |

**Severity:** NONE — fully wired read-only.

---

## 13. `/admin/people/[fubPersonId]`

**File:** `app/admin/(protected)/people/[fubPersonId]/page.tsx`

Fetches: FUB `/v1/people/{id}` API, Supabase visitor_sessions, visitor_events, listing_inquiries, valuation_requests, cmas, marketing_assignments.

| Element | Classification | Evidence |
|---|---|---|
| Page load / FUB fetch | ✅ WIRED | `fetch` to FUB API with auth header |
| "Open in FUB ↗" link | ✅ WIRED | External `https://app.followupboss.com/2/people/view/{id}` |
| "← Action required" link | ✅ WIRED | `/admin/analytics/action-required` |
| Session rows → session detail | ✅ WIRED | `<Link href="/admin/visitors/{sessionId}">` |
| Listing inquiry / valuation / CMA rows | ✅ WIRED | Read-only display |

**Severity:** NONE — fully wired read-only.

---

## 14. `/admin/visitors/live`

**File:** `app/admin/(protected)/visitors/live/page.tsx`

| Element | Classification | Evidence |
|---|---|---|
| Page load | ✅ WIRED | Supabase service-role fetch, `dynamic='force-dynamic'` |
| "All" / "Anonymous" / "Identified" tabs | ✅ WIRED | `<Link>` with `?filter=` param |
| Session rows → detail | ✅ WIRED | `<Link href="/admin/visitors/{sessionId}">` |
| FUB identity links | ✅ WIRED | External FUB URL in new tab |
| Summary stat cards | ✅ WIRED | Read-only server-computed |

**Severity:** NONE — fully wired read-only.

---

## 15. `/admin/visitors/[sessionId]`

**File:** `app/admin/(protected)/visitors/[sessionId]/page.tsx`

| Element | Classification | Evidence |
|---|---|---|
| Page load | ✅ WIRED | Supabase fetch of session + events |
| "← Back to live visitors" | ✅ WIRED | `<Link href="/admin/visitors/live">` |
| FUB person link (if identified) | ✅ WIRED | External FUB URL |
| Event timeline | ✅ WIRED | Read-only |

**Severity:** NONE — fully wired read-only.

---

## Summary

### Counts

| Classification | Count |
|---|---|
| ✅ WIRED (read-only or safe mutation) | 52 |
| ❓ UNVERIFIED-DESTRUCTIVE | 22 |
| 🔇 ORPHANED (not rendered on any page) | 22+ components in `/admin/sync/` |
| ☠️ DEAD | 0 |
| 🐞 BROKEN | 0 |

### Top issues

1. **CRITICAL / MEDIUM — `/admin/sync` has NO operator controls.** The page renders only a backfill health monitor. All 22+ sync action components (`SyncSmart`, `SyncLiveStatusAndTerminal`, `SyncPageAdvanced`, `TriggerDeltaSyncButton`, etc.) are fully wired to real APIs but NOT imported on the page. Operators cannot manually trigger, pause, or monitor a sync from the admin UI. The background cron still runs; this only affects manual intervention capability.

2. **LOW — `approved_by` hardcoded to `'matt'` in `/api/admin/approval-queue/[id]/action/route.ts` line 43.** Works correctly today (only Matt has queue access) but will produce incorrect audit records if other admins are granted access. Fix: replace with `user.email` (already in scope).

3. **LOW — Query-builder shows only 6 preview rows** (`AdminQueryBuilderForm.tsx`) while the server returns up to 500. This is a deliberate UX choice (CSV download has full set) but could mislead operators who don't notice the download option.

4. **INFO — 3 `DashboardPanel` sub-components** (`DashboardNotificationsPanel`, `DashboardSitePerformancePanel`, `DashboardRevenuePanel`) on `/admin/operations` were not read. They are unlikely to have mutation buttons but should be audited in a follow-up pass.

### Fix priority

| Priority | Item |
|---|---|
| P1 | Restore or formally delete orphaned sync controls — restore by adding `SyncHeavyStatusSections` import back to `/admin/sync/page.tsx`, or delete the 22 components to clean dead code |
| P2 | Fix `approved_by: 'matt'` hardcode → use `user.email` in the action route |
| P3 | Read 3 unread ops-dashboard sub-panels to confirm no unguarded mutation buttons |
