# A6 QA — Dashboard, Approvals, CRM Health, FAB, ⌘K

**Cluster:** A6  
**Surfaces:** `/admin/broker-dashboard`, `/admin/crm/approvals`, `/admin/crm/health`, global FAB (`ConsoleQuickAction`), top-nav `ConsoleCommandPalette`  
**Auditor:** Claude Code (read-only + safe e2e)  
**Date:** 2026-06-26  
**Method:** Full source trace of every interactive element; no real client mutations; no git/snapshot edits.

---

## Defect summary

| Severity | Count | Description |
|---|---|---|
| 🐞 BROKEN | 3 | Noop filter selectors presented as functional controls |
| 🐞 BROKEN | 1 | FAB lead-context detection silent mismatch on `/admin/crm/[id]` |
| 🐞 BROKEN | 2 | Marketing launchpad "Listing reel" + "IG carousel" buttons land on wrong page |
| ❓ UNVERIFIED | 1 | KPI sparkline bars are decorative only — no prior-period delta value |
| ❓ UNVERIFIED | 1 | FAB "New task" lands on list, not an auto-open dialog |
| ❓ UNVERIFIED | 1 | FAB "New deal" lands on pipeline list with no create path |
| ✅ WIRED-OK | ~35 | All other interactive elements |

---

## `/admin/broker-dashboard` — detailed trace

**Source:** `app/admin/(protected)/broker-dashboard/page.tsx` (841 lines)  
**Data:** `getBrokerCommandCenterData`, `getBrokerActionQueue`, `fetchLiveSummary`, `getRecentWebsiteVisitors`, `getRecentEmailPeople`, `getRecentNewLeads`

### Header controls

| Element | Classification | Evidence |
|---|---|---|
| **"Everyone" audience selector** | 🐞 BROKEN (noop) | `<Select defaultValue="everyone">` with no `onValueChange`, no server action, no `onChange`. Page comment at line 308: "UI only, all data is already broker-scoped server-side". Changing the select does nothing — data does not re-scope. |
| **Date range selector** (7d/30d/90d/YTD) | 🐞 BROKEN (noop) | `<Select defaultValue="30d">` at line 319, same pattern — no handler, no `searchParams` read, page comment: "shown for visual parity with FUB". Selecting any option does not re-fetch or re-scope data. |
| **"All leads" button** (superuser only) | ✅ WIRED-OK | `<Link href="/admin?broker=all">` → `/admin` page exists at `app/admin/(protected)/page.tsx`, which immediately redirects to `/admin/broker-dashboard`. The `broker=all` param is not consumed anywhere — it is a noop param on a functional nav link. Cosmetically harmless. |
| **"Open CRM" button** | ✅ WIRED-OK | `<Link href="/admin/crm">` → route exists. |

### KPI tiles (5 tiles)

All five tiles show real live data from the fetched server results — no hardcoded numbers.

| Tile | Value source | Dir/sparkline | Classification |
|---|---|---|---|
| **New Leads** | `recentLeads.length` (from `getRecentNewLeads(12)`) | `dir` derived from count > 0 | ❓ UNVERIFIED — `delta` and `deltaLabel` props are never passed; the sparkline bars are purely decorative (not data-driven, see code comment "mini-graph that conveys trending using the delta sign — bars grow to the right when positive"). No prior-period comparison exists. Metric value is real. |
| **Needs Action** | `actionQueue.length + overdueTasks.length` (live from `getBrokerActionQueue` + task filter) | Derived from count | Same — real value, decorative bars, no YoY delta. |
| **Overdue Tasks** | `data.attention.tasksOverdue` (from `getBrokerCommandCenterData`) | Derived | Same. |
| **Appts Next 30 Days** | Filtered from `data.calendar` (TC closings + GCal events) in next 30 days | Derived | Same. |
| **Deals Next 30 Days** | `data.activeDeals.length` + sum of salePrice/listingPrice | Derived | Same. |

All five tiles link to real routes: `/admin/crm`, `/admin/crm/tasks`, `/admin/deals`. ✅

### Recent Activity section

| Element | Classification | Evidence |
|---|---|---|
| **"Filter Activity" select** (All/On site/Email/New leads) | 🐞 BROKEN (noop) | The outer Select at line 389 has no `onValueChange` and does not communicate with `DashboardActivityFeed`. The feed component manages its own `useState<Segment>` tab bar internally. Changing the outer select does nothing; the inner feed tabs duplicate the functionality correctly. |
| **"View all people" button** | ✅ WIRED-OK | `<Link href="/admin/crm">` → route exists (CRM contacts list). |
| **Live pulse strip** (On site now / Hot today / Identified today / Sessions today) | ✅ WIRED-OK | Values from `fetchLiveSummary()` (reads `visitor_sessions` via service-role). All four tiles link to `/admin/visitors/live` (route exists). |
| **DashboardActivityFeed tabs** (On the site / Email / New leads) | ✅ WIRED-OK | Client-side `useState` tab switch across pre-fetched data arrays. Real data from `getRecentWebsiteVisitors`, `getRecentEmailPeople`, `getRecentNewLeads`. |
| **Activity row links** | ✅ WIRED-OK | Each row links to `/admin/console/leads/${r.personId}` — route `app/admin/console/leads/[id]/page.tsx` exists. |

### "Needs your action" panel

| Element | Classification | Evidence |
|---|---|---|
| **Action row "Send" / "Confirm" button** | ✅ WIRED-OK | `<form action={confirmStepFromDashboard.bind(null, a.enrollmentId)}>` → calls `confirmNextStepAction(enrollmentId)` (line 197) → `app/actions/crm.ts` line 1646 — real DB write + timeline entry. Revalidates `/admin/broker-dashboard`. |
| **Action row "Open →" link** (blocked steps) | ✅ WIRED-OK | Links to `/admin/crm/${a.personId}` → route exists. |
| **Action row name/detail link** | ✅ WIRED-OK | Links to `/admin/crm/${a.personId}` → route exists. |
| **Overdue task "Done" button** | ✅ WIRED-OK | `<form action={completeTaskFromDashboard.bind(null, t.id, t.personId)}>` → `completeCrmTaskAction(fd)` — real dual-write (local + FUB if fub_legacy_id set). |
| **Overdue task name link** | ✅ WIRED-OK | Links to `/admin/crm/${t.personId}` or `/admin/crm/tasks` depending on whether personId exists. |
| **"See all →" link** (when overflow) | ✅ WIRED-OK | `<Link href="/admin/crm">` |

### Active deals section

| Element | Classification | Evidence |
|---|---|---|
| **Deal row links** | ✅ WIRED-OK | Links to `/admin/deals/${deal.propertyKey}` → route `app/admin/(protected)/deals/[key]/page.tsx` exists. |
| **"All deals" action link** | ✅ WIRED-OK | `/admin/deals` → route exists. |
| **Checklist progress bar** | ✅ WIRED-OK | Pure display from `deal.checklistComplete / deal.checklistTotal` (real data from TC cycles). |

### MonthCalendar

| Element | Classification | Evidence |
|---|---|---|
| **Day-select buttons** | ✅ WIRED-OK | Client `useState` — switches day without a server call (pre-fetched items). |
| **Calendar item links** | ✅ WIRED-OK | Each item's `href` is set server-side in `getBrokerCommandCenterData` (e.g. `/admin/deals/${key}` for closings). |
| **"Calendar synced" indicator** | ✅ WIRED-OK | Shows when `data.gcalConnected` is true — real flag from broker profile. |

### Tasks / Active clients sections

| Element | Classification | Evidence |
|---|---|---|
| **Task rows** | ✅ WIRED-OK | Display only; person name links to `/admin/crm/${task.personId}`. "All tasks" → `/admin/crm/tasks`. |
| **Client rows** | ✅ WIRED-OK | Each client links to `/admin/crm/${client.id}` → route exists. "CRM" section link → `/admin/crm`. |

### Marketing launchpad (superuser only)

| Element | Classification | Evidence |
|---|---|---|
| **Tab pills** (Post ideas / Newsletter / My listings / Market report) | ✅ WIRED-OK | URL-param driven via `?tab=key`, `searchParams` read on line 227. Server re-renders on tab change. |
| **"Listing reel" button** | 🐞 BROKEN (wrong destination) | Links to `/admin/listings/${listing.listingKey}` (line 709). That route (`app/admin/(protected)/listings/[listingKey]/page.tsx`) is an **admin listing editor** (photo reorder, suppression, price edits). It has no reel builder. The button label says "Listing reel" but opens a metadata editor. |
| **"IG carousel" button** | 🐞 BROKEN (wrong destination) | Also links to `/admin/listings/${listing.listingKey}` (line 712) — same wrong destination as above. |
| **"Create asset" button** (My listings tab) | ✅ WIRED-OK | Links to `/admin/media?listing=${listing.listingKey}` → `/admin/media` route exists. This is the correct destination for asset creation. |
| **"View" button** (My listings tab) | ✅ WIRED-OK | `/admin/listings/${listing.listingKey}` → listing editor (appropriate for "View"). |
| **Newsletter idea cards** | ✅ WIRED-OK | All link to real routes: `/admin/crm`, `/admin/listings`, `/admin/crm/deals`, `/admin/crm?stage=Active+Buyer`. |
| **Market report cards** | ✅ WIRED-OK | All link to real routes: `/admin/reports/market?city=Bend`, etc. — `app/admin/(protected)/reports/market/page.tsx` exists. |
| **Post idea cards** (area guides, sold, tips) | ✅ WIRED-OK | `/admin/broker-dashboard?tab=market`, `/admin/crm/deals`, `/admin/media` — all real routes. |

---

## `/admin/crm/approvals` — detailed trace

**Source:** `app/admin/(protected)/crm/approvals/page.tsx` (175 lines)  
**Data:** `getAwaitingApprovals()` — reads `crm_enrollments` with `status='awaiting_broker'`

| Element | Classification | Evidence |
|---|---|---|
| **Auth gate** | ✅ WIRED-OK | `getCrmAccess()` → redirect to `/admin/access-denied` if no access. |
| **"Back to CRM" link** | ✅ WIRED-OK | `<Link href="/admin/crm">` — route exists. |
| **"View contact" link** | ✅ WIRED-OK | `/admin/crm/${item.personId}` — route exists. |
| **"Send and start" button** | ✅ WIRED-OK | `<form action={approveForm}>` → `approveEnrollmentAction(enrollmentId)` in `app/actions/crm.ts`. Sets enrollment to `running`, stamps `approved_by/at`, dual-writes `crm_timeline`, revalidates `/admin/crm/approvals` and `/admin/crm/workflows`. |
| **"Skip first text" button** | ✅ WIRED-OK | `<form action={skipForm}>` → `skipFirstTouchAction(enrollmentId)` → starts at `step_index: 1`. Real DB write. |
| **"Dismiss" button** | ✅ WIRED-OK | `<form action={dismissForm}>` → `dismissEnrollmentAction(enrollmentId)` → sets `status='stopped'`. Real DB write. |
| **"Edit text before sending" disclosure** | ✅ WIRED-OK | `<details>` expando with a `<Textarea name="body">` and `<form action={approveEditedForm}>` → `approveEnrollmentAction(enrollmentId, body)` — passes the edited body as `first_touch_override`. |
| **"View CMA" link** | ✅ WIRED-OK | `href={item.cmaLink}` opens in new tab; shown only when `item.cmaLink` is non-null. Falls back to a note about CMA building in progress. |
| **Empty state** | ✅ WIRED-OK | "Nothing waiting on you" message shown when `items.length === 0`. |
| **Error handling** | ✅ WIRED-OK | Each inline server action logs `r.error` to console but does not surface errors to the user — silent failure mode. Not a blocker but worth noting. |

---

## `/admin/crm/health` — detailed trace

**Source:** `app/admin/(protected)/crm/health/page.tsx` (305 lines)  
**Data:** `getA2pCampaignStatus()`, `getCrmSignalFreshness()`, `getSuppressionCounts()`, `getCrmLeadVolume()`, `getCrmContactTotal()`, `mirrorHealthStatus()`

This surface is **read-only** — no mutation buttons exist anywhere on the page. All status tiles display live signals.

| Element | Classification | Evidence |
|---|---|---|
| **Auth gate** | ✅ WIRED-OK | `getCrmAccess()` → redirect to `/admin/access-denied`. |
| **Overall roll-up StatusPill** | ✅ WIRED-OK | `worstLevel([...])` over all tile levels — pure function in `lib/crm/health-levels` (unit-tested). |
| **Mirror tile** | ✅ WIRED-OK | `mirrorHealthStatus({ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED })` — reads live env. |
| **Outbound SMS tile** | ✅ WIRED-OK | `getA2pCampaignStatus()` — hits Twilio API. Wrapped in `.catch(() => null)` so a Twilio outage doesn't blank the board. |
| **New leads tile** | ✅ WIRED-OK | `getCrmLeadVolume(nowMs)` — reads `crm_people` via DAL. |
| **Inbound webhook freshness tiles** | ✅ WIRED-OK | `getCrmSignalFreshness()` — reads `crm_timeline` per channel. Thresholds: warn > 24h, stale > 72h. |
| **Suppressions section** | ✅ WIRED-OK | `getSuppressionCounts()` — reads `crm_suppressions`. By-channel breakdown + top reasons by Badge. |
| **Suspense boundary** | ✅ WIRED-OK | `<Suspense fallback={<Skeleton>}>` wraps the async `HealthBoard`. No blocking on slow Twilio calls. |
| **No action buttons** | N/A | Health is a read-only board. No mutations. The only "action" in the design is informational (what to do if a tile is red). This is intentional. |

---

## `ConsoleQuickAction` (global FAB "+") — detailed trace

**Source:** `components/console/ConsoleQuickAction.tsx` (165 lines)  
**Mounted in:** `ConsoleShell` (line 91) → used by both `app/admin/(protected)/layout.tsx` AND `app/admin/console/layout.tsx`. FAB is present on every admin page.

### Context detection

| Scenario | Detection | Classification |
|---|---|---|
| **On `/admin/console/leads/:id`** | `leadIdFrom(pathname)` matches regex `^\/admin\/console\/leads\/(\d+)$` → shows lead-scoped actions + recommendation | ✅ WIRED-OK |
| **On `/admin/crm/:id`** (dashboard "Needs action" links land here) | `leadIdFrom()` does NOT match `/admin/crm/:id` pattern → shows global actions only | 🐞 BROKEN (silent context miss) — A broker clicking a contact from the broker-dashboard action queue lands on `/admin/crm/:id`. The FAB on that page shows global-only actions (no "Send text", "Add note", "Add task" for that contact), even though the broker is on a specific contact. The contact-scoped actions ARE available in the contact page itself, but the FAB's quick-action list is less useful than it should be. Fix: extend `leadIdFrom` to also match `/admin/crm/(\d+)` or navigate dashboard action-queue links to `/admin/console/leads/:id`. |

### Global actions

| Action | Target route | Route exists | Classification |
|---|---|---|---|
| **New contact** | `/admin/crm/new` | ✅ | ✅ WIRED-OK — full create form with `createCrmContactAction`, redirects to new contact on success. |
| **New task** | `/admin/crm/tasks` | ✅ | ❓ UNVERIFIED — lands on the task list page. `NewTaskDialog` is mounted but not auto-opened. Broker must find and click the "New task" button manually. The FAB label implies a direct create action but delivers a list page. No hash or query param to auto-open the dialog. |
| **New deal** | `/admin/crm/deals` | ✅ | ❓ UNVERIFIED — `/admin/crm/deals` is the pipeline Kanban list. No "create deal" button was found in that page's source. Deals are imported from FUB and TC cycles; there is no manual creation form. The FAB label implies creation but the destination has no create path. |
| **Compose email** | `/admin/email/compose` | ✅ | ✅ WIRED-OK — `AdminEmailCompose` (single recipient) + `ComposeToCohort` (smart list blast). Both wired to `sendAdminEmail` / cohort action. |
| **Start a CMA** | `/admin/cmas` | ✅ | ✅ WIRED-OK — route exists. |
| **Workflows** | `/admin/crm/sequences` | ✅ | ✅ WIRED-OK — sequence list with `createCrmSequenceAction` and `createCrmAutomationRuleAction`. |

### Lead-scoped actions (only on `/admin/console/leads/:id`)

| Action | Target | Classification |
|---|---|---|
| **Send text** | `#comms` (hash — fires native `hashchange`) | ✅ WIRED-OK — native `<a>` tag (not Next Link) so `hashchange` fires on `LeadTabs`. |
| **Send email** | `#comms` | ✅ WIRED-OK |
| **Add note** | `#comms` | ✅ WIRED-OK |
| **Add task** | `#tasks` | ✅ WIRED-OK |
| **Enroll in workflow** | `#overview` | ✅ WIRED-OK |
| **Start a CMA** | `/admin/cmas` | ✅ WIRED-OK |
| **Recommended next step card** | `#overview` + `getNextRecommendation(leadId)` | ✅ WIRED-OK — lazy-loads on sheet open, handles error silently, shows channel + sequence name. |

---

## `ConsoleCommandPalette` (⌘K) — detailed trace

**Source:** `components/console/ConsoleCommandPalette.tsx` (119 lines)  
**Mounted in:** `ConsoleTopNav` → `ConsoleShell` → everywhere in admin.

| Element | Classification | Evidence |
|---|---|---|
| **⌘K / Ctrl+K keyboard shortcut** | ✅ WIRED-OK | `document.addEventListener('keydown', down)` on mount. |
| **Search button click** | ✅ WIRED-OK | `onClick={() => setOpen(true)}` |
| **Nav fuzzy match** (4 static entries) | ✅ WIRED-OK | Client-side `filter` on label — no server call needed. |
| **Lead search** (2+ chars, 180ms debounce) | ✅ WIRED-OK | Calls `consoleSearchLeads(q)` — `app/actions/console.ts` → `listCrmPeople({ q, broker, page: 1 })` scoped to caller. Returns up to 8 hits. |
| **Navigate to nav item** | ✅ WIRED-OK | `router.push(href)`, closes palette. |
| **Navigate to lead** | ✅ WIRED-OK | `router.push('/admin/console/leads/${h.id}')` — route exists. |
| **Empty state** | ✅ WIRED-OK | `<CommandEmpty>No matches.</CommandEmpty>` |
| **Static NAV routes** | Checked: `/admin/console` ✅, `/admin/console/leads` ✅, `/admin/crm/inbox` ✅, `/admin/deals` ✅ | All routes exist. |

**Note:** The static NAV in the palette only lists 4 entries. All functional admin routes (health, approvals, visitors, reports, etc.) are not searchable via ⌘K — only navigable via the sidebar. This is a scope/completeness gap, not a bug.

---

## Cross-cutting findings

### Dashboard contacts link to two different routes

- "Needs your action" contact links → `/admin/crm/:id`
- Activity feed (DashboardActivityFeed) contact links → `/admin/console/leads/:id`

Both routes exist and show the contact detail. However, they are **different UI shells** (the `(protected)` layout vs the `console` layout). This inconsistency means activity-feed clicks get the console shell (FAB context-aware), while action-queue clicks get the admin shell (FAB not context-aware). Recommend normalizing all broker-dashboard contact links to `/admin/console/leads/:id`.

### KPI tiles have no prior-period delta

The 5 KPI tiles show a `dir` (up/down/flat) and a sparkline visual, but neither a `delta` value nor a `deltaLabel` is ever passed. The sparkline bars are hard-coded sequences — not data-driven (page comment confirms this). This is not a bug (the values are real), but the visual implies a comparison that doesn't exist. A clear FUB parity gap.

---

## Element classification index

| # | Surface | Element | Classification |
|---|---|---|---|
| 1 | Dashboard | "Everyone" audience selector | 🐞 BROKEN (noop) |
| 2 | Dashboard | Date range selector | 🐞 BROKEN (noop) |
| 3 | Dashboard | "Filter Activity" select | 🐞 BROKEN (noop) |
| 4 | Dashboard | All 5 KPI tile links | ✅ WIRED-OK |
| 5 | Dashboard | KPI sparkline/delta display | ❓ UNVERIFIED (decorative, no real prior-period data) |
| 6 | Dashboard | Live pulse strip (4 tiles) | ✅ WIRED-OK |
| 7 | Dashboard | Activity feed tabs (3) | ✅ WIRED-OK |
| 8 | Dashboard | Activity feed row links | ✅ WIRED-OK |
| 9 | Dashboard | Action queue "Confirm"/"Send" buttons | ✅ WIRED-OK |
| 10 | Dashboard | Action queue "Open →" links | ✅ WIRED-OK |
| 11 | Dashboard | Action queue contact name links | ✅ WIRED-OK |
| 12 | Dashboard | Overdue task "Done" buttons | ✅ WIRED-OK |
| 13 | Dashboard | Overdue task name links | ✅ WIRED-OK |
| 14 | Dashboard | "See all →" overflow link | ✅ WIRED-OK |
| 15 | Dashboard | Active deal row links | ✅ WIRED-OK |
| 16 | Dashboard | "All deals" link | ✅ WIRED-OK |
| 17 | Dashboard | MonthCalendar day-select buttons | ✅ WIRED-OK |
| 18 | Dashboard | MonthCalendar item links | ✅ WIRED-OK |
| 19 | Dashboard | Tasks "All tasks" link | ✅ WIRED-OK |
| 20 | Dashboard | Task person-name links | ✅ WIRED-OK |
| 21 | Dashboard | Active client row links | ✅ WIRED-OK |
| 22 | Dashboard | "CRM" section link | ✅ WIRED-OK |
| 23 | Dashboard | Marketing launchpad tab pills | ✅ WIRED-OK |
| 24 | Dashboard | "Listing reel" buttons | 🐞 BROKEN (wrong destination — lands on listing editor, not reel builder) |
| 25 | Dashboard | "IG carousel" buttons | 🐞 BROKEN (wrong destination — same as above) |
| 26 | Dashboard | "Create asset" buttons | ✅ WIRED-OK |
| 27 | Dashboard | Newsletter cards (4) | ✅ WIRED-OK |
| 28 | Dashboard | Market report cards (6) | ✅ WIRED-OK |
| 29 | Dashboard | Post idea cards (5) | ✅ WIRED-OK |
| 30 | Dashboard | "All listings" link | ✅ WIRED-OK |
| 31 | Dashboard | "All leads" button (superuser) | ✅ WIRED-OK |
| 32 | Dashboard | "Open CRM" button | ✅ WIRED-OK |
| 33 | Approvals | "Send and start" button | ✅ WIRED-OK |
| 34 | Approvals | "Skip first text" button | ✅ WIRED-OK |
| 35 | Approvals | "Dismiss" button | ✅ WIRED-OK |
| 36 | Approvals | "Edit text before sending" + "Send edited text" | ✅ WIRED-OK |
| 37 | Approvals | "View contact" link | ✅ WIRED-OK |
| 38 | Approvals | "View CMA" link | ✅ WIRED-OK |
| 39 | Approvals | "Back to CRM" link | ✅ WIRED-OK |
| 40 | Health | All 5 vital-sign tiles | ✅ WIRED-OK (read-only, live data) |
| 41 | Health | Suppression by-channel stats (4) | ✅ WIRED-OK |
| 42 | Health | Suppression reason badges | ✅ WIRED-OK |
| 43 | FAB | "+" open button | ✅ WIRED-OK |
| 44 | FAB | Lead context detection | 🐞 BROKEN (only matches `/admin/console/leads/:id`, misses `/admin/crm/:id`) |
| 45 | FAB | "New contact" | ✅ WIRED-OK |
| 46 | FAB | "New task" | ❓ UNVERIFIED (lands on task list, not auto-open dialog) |
| 47 | FAB | "New deal" | ❓ UNVERIFIED (lands on pipeline list, no create path found) |
| 48 | FAB | "Compose email" | ✅ WIRED-OK |
| 49 | FAB | "Start a CMA" | ✅ WIRED-OK |
| 50 | FAB | "Workflows" | ✅ WIRED-OK |
| 51 | FAB | Lead-scoped: "Send text/email/Add note" (hash links) | ✅ WIRED-OK |
| 52 | FAB | Lead-scoped: "Add task/Enroll in workflow" (hash links) | ✅ WIRED-OK |
| 53 | FAB | Recommendation card | ✅ WIRED-OK |
| 54 | ⌘K | ⌘K keyboard trigger | ✅ WIRED-OK |
| 55 | ⌘K | Click trigger | ✅ WIRED-OK |
| 56 | ⌘K | Nav fuzzy match (4 entries) | ✅ WIRED-OK |
| 57 | ⌘K | Lead name search | ✅ WIRED-OK |
| 58 | ⌘K | Nav item navigation | ✅ WIRED-OK |
| 59 | ⌘K | Lead result navigation | ✅ WIRED-OK |

---

## Defect detail (actionable)

### D-A6-01 — Three noop filter selects (Dashboard)
**Severity:** Medium  
**Files:** `app/admin/(protected)/broker-dashboard/page.tsx` lines 309, 319, 389  
**Problem:** "Everyone" audience select, date-range select, and "Filter Activity" select all render as interactive controls but have no `onValueChange` handlers and produce no data change. The "Filter Activity" select is particularly confusing because `DashboardActivityFeed` already has its own working internal tab bar covering the same three segments.  
**Fix options:**
1. Remove the "Filter Activity" outer select entirely (the inner feed tabs cover it).
2. Wire the "Everyone"/"date-range" selects to `searchParams` and pass them to the data-fetching layer — or add a comment/label making clear these are coming-soon placeholders.

### D-A6-02 — FAB context detection misses `/admin/crm/:id` (FAB)
**Severity:** Medium  
**File:** `components/console/ConsoleQuickAction.tsx` line 42  
**Problem:** `leadIdFrom()` only matches `/admin/console/leads/:id`. When a broker follows a "Needs your action" link from the dashboard (which goes to `/admin/crm/:id`), the FAB shows global-only actions. The "Send text", "Add note", "Add task" lead-scoped shortcuts are silently unavailable.  
**Fix:** Either extend the regex to also match `/admin/crm/:id`, or change the broker-dashboard action-queue links from `/admin/crm/:id` to `/admin/console/leads/:id`.

### D-A6-03 — "Listing reel" and "IG carousel" buttons land on listing editor (Dashboard)
**Severity:** Medium  
**File:** `app/admin/(protected)/broker-dashboard/page.tsx` lines 709, 712  
**Problem:** Both `<Link href="/admin/listings/${listing.listingKey}">` send the broker to `AdminListingEditor` — a photo/metadata editing surface. There is no reel builder or carousel builder there. The "Create asset" button correctly uses `/admin/media?listing=...`. These two buttons should either be removed, relabeled ("Edit listing"), or redirected to `/admin/media?listing=${listing.listingKey}`.  
**Fix:** Change both hrefs to `/admin/media?listing=${listing.listingKey}` (matching the "Create asset" button), or label them "Edit listing" to match what they actually do.

### D-A6-04 — FAB "New task" doesn't auto-open create dialog (FAB)
**Severity:** Low  
**File:** `components/console/ConsoleQuickAction.tsx` line 35  
**Problem:** `/admin/crm/tasks` lands on the task queue list. `NewTaskDialog` is present but not triggered by any URL param. A broker tapping "New task" in the FAB expects an immediate create prompt, not a list they have to scan to find the "+ New task" button.  
**Fix:** Either add a `?new=1` searchParam that `tasks/page.tsx` reads to auto-open `NewTaskDialog`, or route the FAB to a dedicated `/admin/crm/tasks/new` page.

### D-A6-05 — FAB "New deal" has no create destination (FAB)
**Severity:** Low  
**File:** `components/console/ConsoleQuickAction.tsx` line 36  
**Problem:** `/admin/crm/deals` is the pipeline Kanban view. No "New deal" create form exists anywhere in the codebase (deals are created via TC cycle sync from FUB/SkySlope). The FAB button implies deal creation but has no functional target.  
**Fix:** Either remove "New deal" from the FAB or replace it with "View pipeline" (and relabel accordingly).

---

## Safe e2e results

**⌘K search:** code-verified. `consoleSearchLeads(q)` calls `listCrmPeople` scoped to the caller's broker book — no ZZTEST create needed; the action is read-only.

**Dashboard filter selects:** verified noop in source; no e2e needed.

**Approvals:** No ZZTEST item was found in `crm_enrollments` with `status='awaiting_broker'` — approve/reject server actions verified via source trace only. Actions call real DB writes (confirmed in `app/actions/crm.ts` lines 1555-1615).

**FAB "New contact":** verified in source — `/admin/crm/new` has a working form + `createCrmContactAction`. No ZZTEST contact created (clean-up would require live Supabase write; safety protocol followed: source-verified only).

**Health board:** read-only; no mutations possible.

---

*End of A6 QA audit.*
