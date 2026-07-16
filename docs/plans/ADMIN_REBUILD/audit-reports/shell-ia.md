# Admin Shell, Navigation, Layouts, Auth/Role Model — Ground-Truth Audit

Auditor scope: `app/admin/layout.tsx`, `app/admin/(protected)/layout.tsx`, `app/admin/console/**`, `app/components/admin/**` (nav), `components/console/**` (shell), `app/admin/login|setup|access-denied`, `middleware.ts` (admin-relevant), `app/actions/admin-roles.ts`, every nested `layout.tsx` under `(protected)/**`.

Date: 2026-07-16. Every claim below carries file + line evidence. Line numbers are from the working tree at audit time.

---

## 0. Headline

The "two shells" problem was structurally fixed on 2026-07-15 — `app/admin/console/` is now three redirect stubs and ONE shell (`ConsoleShell` inside `(protected)/layout.tsx`) hosts the whole admin. What remains broken is everything around that shell: **the nav is a 56-item, 5-menu tree (superuser) regrouped twice in one function with items that dead-end by role** (brokers see "Listings", "Import contacts", and every Expireds/CMAs detail link but get bounced to access-denied), **there is no sign-out anywhere in the admin**, **the command palette is mounted twice and both instances listen for ⌘K**, **an unauthenticated deep link loses its destination** (hardcoded `next=/admin`), **every admin page ships the hidden public-site header (which runs 4 DAL fetches) in its payload**, and **no middleware session refresh exists** — expired Supabase tokens are re-refreshed on every RSC render and the new token can never be persisted (`setAll` swallowed in Server Components). The shell components themselves (tab bar, keyboard-inset sync, FAB suppression rules) are dense with special-case pathname regexes that encode months of mobile-audit patches — a sign the IA is being maintained by exception.

---

## 1. Route-group inventory — the "two shells" question answered

### 1.1 `app/admin/layout.tsx` (root admin layout)
- **File:** `app/admin/layout.tsx:1-11`. A no-op passthrough (`return <>{children}</>`) so `/admin/login` and `/admin/setup` are reachable without auth.
- Costs nothing itself; exists purely to scope children.

### 1.2 `app/admin/(protected)/layout.tsx` (THE shell)
- **File:** `app/admin/(protected)/layout.tsx:26-70`.
- Does auth (`getSession` → `getAdminRoleForEmail` → `getCrmAccess`, lines 31-40, three sequential awaits), builds nav (`buildAdminNav`, line 62), renders `ConsoleShell` + `HelpProvider` with `getHelpArticleIndex()` (line 67).
- Imports `./console-theme.css` (line 1) — the neutral token re-skin scoped to `.console-root` (156 lines, `app/admin/(protected)/console-theme.css`).
- Unauthenticated → `redirect('/auth-error?next=/admin')` (line 33) — **hardcoded `/admin`, drops the actual deep-link path** (see §7.1).
- Authenticated non-admin → `redirect('/admin/access-denied')` (line 37).

### 1.3 `app/admin/console/**` (the former second shell — now stubs)
- `console/page.tsx:11-13` — redirect to `/admin/broker-dashboard` ("Today launchpad was one of three redundant dashboards", Matt directive 2026-06-16).
- `console/leads/page.tsx:14-26` — redirect to `/admin/crm` carrying `q/stage/view/page` params (Matt punch list #3: "basically I have what looks like 2 CRMs").
- `console/leads/[id]/page.tsx:17-33` — redirect to `/admin/crm/[id]` carrying ALL query params, kept because "server actions that still redirect here surface their flash/error messages" (docblock lines 4-11) and old SMS/FUB-era deep links (`app/api/twilio/inbound-sms/route.ts:200` references the consolidation).
- **There is no `console/layout.tsx` anymore** — deleted 2026-07-15 per `scripts/check-admin-mobile-shell.mjs:17-21`, which now mechanically asserts the duplicate never returns.
- **Residue of the dead shell:** the component directory is still named `components/console/`, the CSS scope is `.console-root`, the command palette's static nav labels still say "Inbox (brand admin)" / "Transactions (brand admin)" (`components/console/ConsoleCommandPalette.tsx:27-32`), and `ConsoleShell`'s docblock still claims "a sticky left rail on desktop" (`ConsoleShell.tsx:9-10`) — **there is no desktop rail**; `AdminNavList` renders only inside the mobile Sheet (`ConsoleShell.tsx:120-128`). The gate text in `check-admin-mobile-shell.mjs:37` ("hides the desktop rail below lg") is equally stale.

### 1.4 Full top-level route inventory under `(protected)` and which nav reaches it

150 `page.tsx` files under `app/admin/` total; 123 declare `force-dynamic`. Top-level groups:

| Route group | Live or stub | Reached by |
|---|---|---|
| `/admin` (index) | redirect → broker-dashboard after `getSetupComplete()` DB check (`(protected)/page.tsx:15-19`) | wordmark links (`ConsoleShell.tsx:39`, `ConsoleTopNav.tsx:56`) |
| `/admin/broker-dashboard` | live | nav "Dashboard", mobile tab "Home", palette "Today" |
| `/admin/crm` + 40 sub-routes | live | nav "CRM" menu (18 items superuser), mobile tabs, FAB |
| `/admin/crm/workflows` | live (enrollment board) | **NOT in nav** — only a link on `/admin/crm/sequences` (`sequences/page.tsx:214`) and `AutomationsListView.tsx:456,474` |
| `/admin/crm/automations` | stub → `/admin/crm/sequences` (`automations/page.tsx:18`) | nothing links to it (FUB-parity URL) |
| `/admin/deals`, `/signing`, `/commissions`, `/financials`, `/forms`, `/sign-off` | live | nav "Deals" menu (canBrokers; sign-off superuser) |
| `/admin/listings` + `[listingKey]` | live | nav "Admin → Listings" **shown to every role but superuser-gated by layout** (§6.1) |
| `/admin/expireds`, `/expired-outreach`, `/fsbos`, `/cmas`, `/bpo` | live | nav (canBrokers) |
| `/admin/expired-listings` | index stub → `/admin/expireds`; `[key]` detail live | detail linked from Expireds + CMAs rows — **superuser-only layout dead-ends brokers** (§6.2) |
| `/admin/analytics` + 11 sub-pages | live | nav "Reports" (superuser only) + ReportCatalog hub |
| `/admin/reports` | index stub → `/admin/analytics` (`reports/page.tsx:13`); 7 sub-reports live | sub-reports reached only via ReportCatalog on `/admin/analytics` (`analytics/_components/ReportCatalog.tsx:48-117`) and broker-dashboard market links (`broker-dashboard/page.tsx:644-648`) |
| `/admin/approval-queue`, `/blog`, `/broker-links`, `/newsletters`(+3 sub) , `/email/compose`, `/email/campaigns` | live | nav |
| `/admin/email` | index stub → compose (`email/page.tsx:6`) | nothing |
| `/admin/geo` (+2), `/site-pages`, `/media` (+3 tabs) | live | nav "Admin" (superuser) |
| `/admin/operations` (+optimization), `/sync` (+spark), `/crm/health`, `/crm/settings` (+19 sub), `/users`, `/audit-log`, `/brokers` (+2) | live | nav |
| `/admin/guides` | live CRUD (guides editor, `guides/page.tsx`) | **NOT in nav** — only via a link inside `DashboardContentStatusPanel` rendered on `/admin/operations` (`components/admin/DashboardContentStatusPanel.tsx:53`) |
| `/admin/help` + `[slug]` | live KB | Help FAB (`HelpButton`) only |
| `/admin/settings` | live ("My settings") | nav "Admin → My settings" |
| `/admin/visitors` | index stub → `/visitors/live` (`visitors/page.tsx:6`) | nav has `/admin/visitors/live` directly |
| `/admin/people` | index stub → `/admin/crm` ; `[legacyId]` live redirect shim resolving FUB legacy ids (`people/[legacyId]/page.tsx:16-21`) | old bookmarks only |
| Pure redirect stubs at top level | `/admin/banners`, `/stock-photos`, `/photos`, `/optimization`, `/query-builder`, `/resort-communities`, `/search`, `/spark-status` | consolidation shims (2026-07-07) |

**Count of redirect-stub pages under `app/admin/`: 17** (banners, stock-photos, photos, optimization, query-builder, resort-communities, search, spark-status, reports index, people index, email index, visitors index, expired-listings index, crm/automations, (protected) index, console ×3). Each is a full server render + `getSetupComplete`-style cost where present, then a second navigation.

---

## 2. The request chain, end to end (what every admin page load actually runs)

### 2.1 Middleware (`middleware.ts`)
- **No auth of any kind for `/admin`** — middleware does host canonicalization (line 384), legacy redirects (396), geo-slug 404s (444), bot screening (455), rate limiting `/api/*` only (477), and cookie stamping. Admin page requests pass through the bot screen (regex over UA + geo).
- **Geo block applies to the admin**: `screenBotRequest` (lines 194-215) 403s page routes from `CN, HK, RU, SG` by default (line 169). A broker traveling in Singapore is locked out of the entire admin with a bare-text `Forbidden` — no bypass for authenticated users, no admin exemption. Kill switch is an env var (`BOT_SCREEN_DISABLED`, line 195).
- **No Supabase session refresh in middleware.** The standard `@supabase/ssr` pattern (updateSession in middleware) is absent. See §4.4.

### 2.2 Root layout (`app/layout.tsx`) — runs above the admin
- `SiteHeader` is an **async server component that fetches nav data on every request**: `getMarketPulseCitySnapshots`, `getMarketPulseRegionSnapshot`, `getPriceDropDigest` in `Promise.allSettled`, plus a follow-up `getPriceDrops` enrichment (`components/site/SiteHeader.tsx:83-84, 124-199`). On admin routes this header is **rendered, serialized into the RSC payload, and then CSS-hidden** — `HideChrome` keeps a structurally stable wrapper and toggles `display:none` (`components/layout/HideOnLP.tsx:64-72`; the mount-toggle alternative caused the 2026-07-11 double-header bug). So every admin page pays: the header render, its (cached) DAL calls, the mega-menu HTML, and the footer HTML, none of which is ever visible.
- `AnalyticsScripts` is correctly suppressed on admin via `HideOnAdmin` (`components/site/providers/RootProvider.tsx:31-33`), **but `GTMHead` is not** — it sits directly in `<head>` (`app/layout.tsx:105`) gated only on cookie consent (`components/GTMHead.tsx:26`). If GA4 fires from the GTM container, broker admin usage still pollutes the public scoreboard — the exact regression the 2026-06-10 fix (HideOnLP.tsx:76-79) was for.

### 2.3 `(protected)/layout.tsx` awaits, in order
1. `getSession()` — one GoTrue `auth.getUser()` network round trip, request-memoized via React `cache()` (`app/actions/auth.ts:48-63`).
2. `getAdminRoleForEmail()` — superuser email short-circuits with **zero DB** (`isSuperuserAdmin`, `lib/admin.ts:2-7`, hardcoded `matt@ryan-realty.com`); any other admin costs **one `admin_roles` query on the service client** per request (`app/actions/admin-roles.ts:42-55`, React-cached).
3. `getCrmAccess()` — fully deduped against 1+2 (`app/actions/crm.ts:46-52`), adds ~0.
4. `buildAdminNav()` — pure function, no I/O.
5. `getHelpArticleIndex()` — `fs.readdirSync` + 12 × `fs.readFileSync` of `docs/admin-help/*.md` (48 KB dir), hand-rolled frontmatter parse, React-cached **per request only** (`lib/admin-help.ts:65-81`) — re-read from disk on every admin request; metadata serialized into every page payload.

Net per hard load for Matt: 1 auth round trip + 12 file reads + the hidden SiteHeader fetches. For Rebecca/Paul: + 1 `admin_roles` query. The three awaits at lines 31-40 are **sequential** — session, then role, then access — before any page HTML streams.

### 2.4 Nested section layouts (see §3) re-run `getSession` + `getAdminRoleForEmail` but both are React-cached, so within a single request they add no I/O. On **soft navigations**, Next re-renders only changed segments; every page is `force-dynamic` (123 of 150), so **every nav click is a full server round trip** whose first serial cost is the auth resolution the destination page/layout performs. The single `(protected)/loading.tsx` skeleton (generic 2-column shape, not per-page) is the only transition feedback for all ~130 live pages.

### 2.5 Layouts render in parallel with pages (Next.js architecture)
The role gates live in layouts (§3), but App Router renders layout and page segments concurrently — a page under a superuser-gated layout still *starts* its data fetches for a broker before the layout's `redirect()` aborts the response. No data leaks to the client (the redirect wins the stream), but the fetch cost is paid, and any page that skipped its own check is protected only by response-abort timing, not by an auth boundary at the data source. Pages sampled do re-check (`crm/settings/page.tsx:42-43`, `crm/import/page.tsx:36-38`, `users/page.tsx:20-21`, `brokers/page.tsx:16-18`), which is the correct pattern — but it also makes the gate-only layouts pure overhead (§3).

---

## 3. Nested layouts under `(protected)` — what each adds and costs

| Layout | Adds | Gate | Cost per request (post-dedupe) |
|---|---|---|---|
| `analytics/layout.tsx:10-21` | nothing visual | superuser else → access-denied | 0 extra I/O (cached), 1 render |
| `audit-log/layout.tsx` | nothing visual | superuser | same |
| `expired-listings/layout.tsx` | nothing visual | superuser — **dead-ends brokers following row links** (§6.2) | same |
| `geo/layout.tsx:22-40` | `AdminLinkTabs` (Communities & geo / Resort & master plan) | superuser | same |
| `listings/layout.tsx` | nothing visual | superuser — **nav shows Listings to all roles** (§6.1) | same |
| `media/layout.tsx` | `AdminLinkTabs` ×4 (Library/Photos/Banners/Stock) | none (per-page gates) | render only |
| `media/banners/layout.tsx`, `media/stock-photos/layout.tsx` | nothing visual | superuser | double-nested gate under an ungated parent |
| `operations/layout.tsx` | `AdminLinkTabs` ×2 (Command center/Optimization) | none | render only |
| `operations/optimization/layout.tsx` | nothing visual | superuser | nested gate |
| `reports/layout.tsx:11-19` | nothing visual | superuser **or `report_viewer`** — but `/admin/reports` itself redirects to superuser-only `/admin/analytics` (`reports/page.tsx:13`), so the `report_viewer` allowance is vestigial | same |
| `sync/layout.tsx:14-36` | `AdminLinkTabs` ×2 (Sync/Spark) | superuser | same |

Pattern observations:
- **Eight near-identical copy-pasted gate layouts** (session → role → redirect). The role knowledge is duplicated a NINTH time in `buildAdminNav`'s conditionals, and a TENTH+ time in per-page checks. Three sources of truth for "who can see what" — nav, layout, page — and they demonstrably disagree (§6).
- Because gates are layouts, **the redirect target is always `/admin/access-denied`, whose copy is wrong for this case** — it says "this account does not have admin access" (`access-denied/page.tsx:21-23`) to users who *do* have admin access but not this page. No "back", no role explanation, no request-access path. Links offered: "Go home" (public site) and "Switch account" (login).

---

## 4. Auth / role model

### 4.1 Roles
- `AdminRoleType = 'superuser' | 'broker' | 'report_viewer'` (`app/actions/admin-roles.ts:11`).
- Superuser is a **hardcoded email constant** (`lib/admin.ts:2`), not a DB row. `upsertAdminRole` refuses to grant superuser to any other email (`admin-roles.ts:91`).
- `admin_roles` is RLS-locked; role resolution uses the **service client** because a broker's own session can't read its row ("silently denied Rebecca + Paul until 2026-06-09", `admin-roles.ts:44-47`).
- **`report_viewer` is dead weight**: `admin-nav.ts:92` records "no report_viewer roles exist (verified against admin_roles)", and its one privilege (`reports/layout.tsx`) leads to a page that redirects into a superuser-only section.
- Broker→CRM identity is **a hardcoded 3-entry email map** (`lib/crm/constants.ts:15-19`) layered on top of `admin_roles.broker_id`. Onboarding a fourth broker requires: an `admin_roles` row, a `brokers` row, AND code edits to `CRM_BROKER_BY_EMAIL`, `FUB_USER_ID_BY_BROKER`, `CRM_BROKER_DISPLAY`, `BROKER_HEADSHOT` (`components/console/TopBarScope.tsx:15-19`), and `BROKER_HEADSHOTS` (inbox mobile-data). Miss one and e.g. `getCrmAccess().brokerSlug` is null → the layout's broker label degrades (`(protected)/layout.tsx:42-46`) and templates fall back to acting as 'matt' (`crm/settings/templates/page.tsx:82`).

### 4.2 Mutation guards
- `upsertAdminRole` / `removeAdminRole` carry explicit superuser caller guards (`admin-roles.ts:84-87, 108-111`) — enforced mechanically by `scripts/check-admin-role-guard.mjs` (ci:admin-role-guard). Good.
- Role mutations write an audit log (`logAdminAction`, lines 98, 117).

### 4.3 `listPlatformUsersForAdmin` (site-signup viewer backing `/admin/users`)
- Pages `auth.admin.listUsers` up to 20×1000 (lines 145-153) and **counts engagement by paging up to 20,000 rows per table across three tables in JS** (lines 162-191). That is up to 60 PostgREST round trips of 1,000 rows each to compute per-user counts that a `GROUP BY` would return in three queries. Bounded (won't hang) but heavy, and silently under-counts past 20k rows (`user_activities` is described in-code as "an event log that outgrows that fast").

### 4.4 No session-refresh persistence path (architecture defect)
- `lib/supabase/server.ts:16-24`: `setAll` is wrapped in try/catch with "Ignore in Server Components". Next.js forbids cookie writes during RSC render, so when GoTrue rotates an expired access token during `getUser()`, **the refreshed token is thrown away**.
- Middleware never touches Supabase (`middleware.ts` — zero supabase imports), so there is no request-scope point where refreshed cookies CAN be persisted for page navigations. Cookie writes only happen inside Server Actions / route handlers.
- Consequence: once the access token expires (~1h), **every admin RSC render performs a token refresh that cannot stick**, adding a full GoTrue round trip to every request until the user happens to trigger a server action; concurrent RSC refreshes flirt with refresh-token reuse detection (random signed-out states). This is the single most likely root cause of "the admin is slow and randomly logs me out" class complaints.

### 4.5 Sign-in flow
- `/admin/login` (`login/page.tsx`) renders Google One Tap + fallback redirect flow (`components/admin/AdminLoginForm.tsx`). Post-login destination is the constant `ADMIN_NEXT = '/admin'` (line 10) for both the One Tap path (line 106) and the redirect path (line 148). **The page never reads a `?next=` param.**
- First-run: `/admin` checks `getSetupComplete()` — an **anon-key Supabase query against `settings` on every single `/admin` hit** (`(protected)/page.tsx:16-17`, `app/actions/admin-setup.ts:5-14`) — years after setup completed. Permanent per-visit DB tax on the admin home redirect.

---

## 5. Navigation systems — how many, and what each shows

**Eight distinct navigation systems coexist:**

1. **`ConsoleTopNav`** — desktop (lg+) dark navy top bar; 5 groups; single-item groups are links, multi-item groups are Radix dropdowns (`ConsoleTopNav.tsx:61-89`). Contains its own command-palette instance + "View site" (xl+ only, line 96-100) + avatar (no menu — see §8).
2. **Mobile hamburger Sheet + `AdminNavList`** (< lg) — the FULL grouped nav as collapsible sections with icons and localStorage-persisted open state (`ConsoleShell.tsx:120-128`, `AdminNavList.tsx:32-116`). Desktop never sees this presentation; mobile never sees dropdowns. Same data, two entirely different renderings.
3. **`CrmMobileTabBar`** — fixed bottom 5-tab bar (Home/Inbox/People/Deals/Activity), phones only (`CrmMobileTabBar.tsx:29-37`). Hardcoded tabs, not derived from `buildAdminNav`; deliberately lights *nothing* on `/admin/crm/calendar|tasks` (lines 43-44). Unread badge is **dead** (§9.1).
4. **`ConsoleCommandPalette`** (⌘K) — 4 hardcoded nav destinations with stale "brand admin" labels + live lead search (`ConsoleCommandPalette.tsx:27-32`). Does not know the other ~52 nav items, so as a navigation device it covers 7% of the tree.
5. **`ConsoleQuickAction` FAB** — global "+" bottom-right; 6 global create actions + 7 lead-context actions with hash deep-links, mobile-vs-desktop divergent hrefs (`ConsoleQuickAction.tsx:34-41, 111-133`), and three pathname-regex suppression rules (lines 82-86, 150-152).
6. **`AdminLinkTabs`** — per-section route tab bars in 4 layouts (geo, media, sync, operations).
7. **Launchpad card grids** — `/admin/crm/settings` (19+ cards, `crm/settings/page.tsx`), `/admin/crm/reporting` (card hub), `/admin/analytics` ReportCatalog (links to 13+ reports incl. the whole legacy `/admin/reports/*` family).
8. **`LeadTabs`** — mobile-only tab row inside the lead detail; desktop hides the tabs and shows all sections in one scroll (`components/console/LeadTabs.tsx:4-15`). Plus the **Help FAB** (bottom-left, `HelpButton.tsx:55`) which is a ninth floating control if not strictly navigation.

### 5.1 Nav item counts per role (computed from `buildAdminNav`, `admin-nav.ts:34-221`)

| Menu | superuser | broker | report_viewer |
|---|---|---|---|
| Dashboard | 1 | 1 | 1 |
| CRM | 18 | 15 | 12 |
| Deals | 7 | 6 | 1 |
| Reports | 11 | 0 (section hidden) | 0 |
| Admin | 19 | 8 | 3 |
| **Total** | **56** | **30** | **17** |

- Superuser's CRM dropdown is **18 items in a single Radix dropdown** (`ConsoleTopNav.tsx:80-86`, w-56) — a full-height scroll on a laptop.
- **Duplicate entry:** `/admin/crm/settings` appears in BOTH the CRM menu (`admin-nav.ts:189`) and the Admin menu (line 133) for superusers.
- **Same-concept splits:** three approval surfaces ("Approvals" `/admin/crm/approvals`, "Marketing approvals" `/admin/approval-queue`, "Sign-off queue" `/admin/sign-off`); "Performance" hub AND its 10 children as flat siblings in Reports (hub-and-spoke duplicated as spoke-list); "Workflows" (nav → `/admin/crm/sequences`) vs the actual enrollment board at `/admin/crm/workflows` which is nav-invisible.
- The function builds the nav **twice**: first into 7 job-based arrays (today/people/transactions/listings/marketing/content/system, lines 39-155), then regroups those into 5 menus by href string-matching (`has`/`exclude`, lines 161-211). Items appended in the regroup step (activity, calendar, reporting, workflows, templates, subscriptions, import, my settings — lines 173-210) **bypass the role gating discipline of the first pass entirely** — which is exactly where the dead ends below come from.

---

## 6. Role-gating dead ends (nav lies to non-superusers)

All verified against both the nav conditionals and the destination gates:

1. **Listings** — `admin-nav.ts:72` creates `/admin/listings` unconditionally; it survives into the Admin menu for every role (line 203). `listings/layout.tsx` redirects non-superusers to access-denied. **A broker clicking Admin → Listings hits "Access denied" with copy telling them they don't have admin access.**
2. **Expireds/CMAs row links** — `/admin/expireds` and `/admin/cmas` are nav-visible to brokers (`admin-nav.ts:81-84`), and every dashboard row links to `/admin/expired-listings/[key]` (`expireds/page.tsx:77`, `cmas/page.tsx:380,460`) — whose layout is superuser-only (`expired-listings/layout.tsx`). **A broker can see the Expireds dashboard but cannot open a single detail row.**
3. **Import contacts** — appended unconditionally to the Admin menu for all roles (`admin-nav.ts:209`); the page is superuser-only (`crm/import/page.tsx:38`).
4. **Mobile Settings → "CRM settings"** — `MobileSettingsScreen` (rendered for every role at `/admin/settings`) links to `/admin/crm/settings` (`settings/MobileSettingsScreen.tsx:260`), which is superuser-only (`crm/settings/page.tsx:43`).
5. **report_viewer** — sees Dashboard/CRM/Deals/Admin items whose pages variously require broker or superuser (`/admin/listings` superuser; `brokers/page.tsx:17` explicitly bounces report_viewer). The role cannot reach the one section named for it (Reports → analytics → superuser-only).
6. **Broker with no `broker_id`** — "My profile" (`admin-nav.ts:140`) renders `/admin/brokers` without highlight; the page redirects broker-without-brokerId to access-denied (`brokers/page.tsx:18`).

The nav's own comments prove the team knows the invariant ("gate the nav item to match the layout", `admin-nav.ts:44-47`, 90-92) — but there is **no mechanical gate** checking nav-item role conditions against destination gates, so it regressed at least 4 times (items added in the 2026-07-01 regroup and 2026-07-14/15 restorations).

---

## 7. Login / deep-linking / access-denied flows

### 7.1 Deep-link loss on expired session (biggest daily-use failure)
Chain: broker taps an SMS/notification link to `/admin/crm/12345` with an expired session →
1. `(protected)/layout.tsx:33` → `redirect('/auth-error?next=/admin')` — **the real path is discarded; `next` is hardcoded**.
2. `/auth-error` ("Sign-in issue" — alarming copy for a routine session expiry, plus Supabase redirect-URL setup instructions aimed at developers, `app/auth-error/page.tsx:30-33`) → "Try again" → `/admin/login` (no `next` param since `next === '/admin'`).
3. `AdminLoginForm` completes → `router.push('/admin')` (`AdminLoginForm.tsx:106`).
4. `/admin` runs `getSetupComplete()` → redirect → `/admin/broker-dashboard`.

**Result: 4 redirects, 2 user actions, and the user lands on the dashboard instead of the lead they were sent to.** Cost of re-finding the lead: open palette or People tab → search → tap = 3+ more actions.

### 7.2 `/admin/setup`
- Outside the protected group; checks `getSetupComplete()` and bounces to `/admin` when complete (`setup/page.tsx:15-16`). One-time surface kept alive in the hot path (§4.5).

### 7.3 `/admin/access-denied`
- Correctly outside the protected group to avoid a redirect loop (`access-denied/page.tsx:3-6`, audit p0.2c) — but the copy addresses only the "not an admin at all" case (§3), which after the 2026-07 nav changes is the *minority* of arrivals; role-gated admins are the majority (§6).

---

## 8. No sign-out in the admin (verified)

`grep -rni "sign.?out|log.?out"` across `app/admin/`, `components/console/`, `components/admin/` returns **zero UI hits**. The `signOut()` server action exists (`app/actions/auth.ts:169-171`) with no admin caller. The desktop top-nav avatar is a bare `<img>`/`<span>` with no menu (`ConsoleTopNav.tsx:101-108`); the mobile header avatar likewise (`ConsoleShell.tsx:97-102`); `MobileSettingsScreen`'s support rows are mailto links + a link to CRM settings (`MobileSettingsScreen.tsx:237-260`). The public site header (which presumably carries the account menu) is `display:none` on all `/admin` routes (`HideOnLP.tsx:64-72`). **To sign out of the admin, a broker must navigate to the public site and use its chrome.** Combined with §7.1's account-switch story ("Switch account" → /admin/login → One Tap may auto-suggest the same Google account since the Supabase session persists), shared-device or wrong-account recovery is effectively unsupported.

---

## 9. Shell component defects

### 9.1 Inbox unread badge can never render (dead feature)
`CrmMobileTabBar` accepts `inboxUnread` and draws a 99+-capped badge (`CrmMobileTabBar.tsx:56, 81, 94-98`); `ConsoleShell` defaults it to 0 (`ConsoleShell.tsx:51`) and the **only** instantiation — `(protected)/layout.tsx:50-63` — never passes it. No other caller exists (grep verified). The FUB-parity tab bar ships a permanently blank unread indicator.

### 9.2 Command palette double-mount — double ⌘K listeners, stacked dialogs
`ConsoleCommandPalette` is mounted twice per page: mobile header (`ConsoleShell.tsx:96`) and desktop top nav (`ConsoleTopNav.tsx:92-94`). Both instances mount at every viewport (visibility is CSS-only: `lg:hidden` / `hidden lg:flex`), and **each registers its own document-level `keydown` listener** (`ConsoleCommandPalette.tsx:42-51`). Pressing ⌘K toggles BOTH `open` states → two identical Radix dialogs stack; Escape dismisses only the top dismissable layer, leaving the second palette open; the two instances also hold independent query/hits state. Same duplicate-listener pattern costs double `consoleSearchLeads` server-action churn if both ever receive input.

### 9.3 Palette nav coverage is stale and near-useless
4 hardcoded destinations, two labeled for the deleted "brand admin" shell (`ConsoleCommandPalette.tsx:27-32`): "Today" (→ broker-dashboard, a name no longer used anywhere), "Leads", "Inbox (brand admin)", "Transactions (brand admin)". The palette does not consume `buildAdminNav`, so 52 of 56 destinations are unreachable through it.

### 9.4 Shell padding fought by pages
`ConsoleShell` hardwires `main` padding (`px-4 pt-5 pb-24 …`, `ConsoleShell.tsx:106`); at least three CRM surfaces "cancel the ConsoleShell main padding" with full-bleed negative-margin hacks (`crm/page.tsx:218`, `crm/deals/page.tsx:102`, `crm/[id]/page.tsx:480`). The shell's one layout decision is wrong for its highest-traffic pages.

### 9.5 Coordination via global CSS attributes (fragile by design)
The bottom-edge choreography — tab bar, two FABs, SMS composer, soft keyboard — is coordinated through document-root attributes and variables: `--kb-inset`/`[data-kb-open]` published by `KeyboardInsetSync` (`KeyboardInsetSync.tsx:38-50`), `--crm-dock-offset` in `console-theme.css:33-39` (with a comment that its 3.5rem constant is "load-bearing" against the tab bar's `h-14`, `CrmMobileTabBar.tsx:75-76`), `[data-crm-comms]` set by the comms tab, and per-component pathname regexes deciding which FAB hides where (`ConsoleQuickAction.tsx:82-86`, `HelpButton.tsx:55`, `CrmMobileTabBar.tsx:43-44`). Every rule cites a specific mobile-audit escape (2026-07-02 punch list, 2026-07-15 audit) — the shell accretes patches instead of owning a layout contract.

---

## 10. Mobile vs desktop divergence (shell level)

| Concern | Desktop (lg+/md+) | Mobile (< lg/< md) |
|---|---|---|
| Primary nav | Dark top bar, 5 dropdowns, no icons | Hamburger → Sheet with grouped icon list + collapsible sections + localStorage state |
| Secondary nav | none | Bottom 5-tab bar (hardcoded CRM tabs) |
| Scope switcher | none in shell (page-level on contacts) | `TopBarScope` replaces the wordmark, only when `pathname === '/admin/crm'` (`ConsoleShell.tsx:66, 87-93`) |
| "View site" | xl+ only (`ConsoleTopNav.tsx:96-100`) | **absent entirely** — no path back to the public site from the mobile shell (the wordmark links to `/admin`) |
| Quick actions FAB | always (bottom-5) | suppressed on inbox/calendar/tasks; hidden under keyboard/comms (`ConsoleQuickAction.tsx:82-86,150-152`) |
| Lead detail IA | all sections, single scroll | `LeadTabs` 6-tab CSS-toggle |
| Send text / Send email (FAB on a lead) | hash-link `#comms` on the same page | reroutes to `/admin/crm/inbox?c=<id>&m=sms|email` — a **different surface** for the same job (`ConsoleQuickAction.tsx:113-122`) |
| My settings | `MySettingsForm` (md+) | entirely different `MobileSettingsScreen` component — **both are server-rendered into every request and CSS-toggled** (`settings/page.tsx:69-80`), doubling payload |
| Tablets | iPad landscape (≥1024) gets desktop | iPad portrait (<1024) gets the phone experience incl. bottom tab bar |

28 files under `app/admin/` use `md:hidden`/`lg:hidden` CSS forking (grep count) — the dominant mobile strategy is render-both-hide-one. `scripts/check-admin-responsive.mjs` ratchets phone-break patterns and its baseline is currently **0 violations** (`admin-responsive-baseline.json`), so table/grid-level responsiveness is mechanically held; the divergence above is structural, not regression.

Deep-linking on mobile behaves identically to desktop (hard load runs the full chain of §2) with two mobile-specific costs: the lost-deep-link flow of §7.1 hits mobile hardest (notification links are the mobile entry point), and every hard load pays the hidden SiteHeader payload on a phone connection.

---

## 11. Performance summary (shell-attributable, per navigation)

| Cost | When | Evidence |
|---|---|---|
| GoTrue `getUser()` round trip, serial before render | every server request (page or layout resolves auth first) | `auth.ts:48-63`, layout lines 31-40 |
| Un-persistable token refresh once session > ~1h old | **every** RSC render until a server action runs | `lib/supabase/server.ts:21-23`, no middleware refresh |
| `admin_roles` service query (non-Matt) | every request | `admin-roles.ts:47-52` |
| Hidden `SiteHeader` render + 4 DAL fetches + footer | every hard load / full request | `app/layout.tsx:130-136`, `SiteHeader.tsx:124-199`, `HideOnLP.tsx:64-72` |
| 12 markdown file reads + index serialization | every request through `(protected)/layout.tsx:67` | `lib/admin-help.ts:65-81` |
| `getSetupComplete` settings query + extra redirect hop | every `/admin` hit (both wordmarks link here) | `(protected)/page.tsx:16`, `ConsoleShell.tsx:39`, `ConsoleTopNav.tsx:56` |
| force-dynamic everywhere → zero page caching | 123/150 pages | grep count |
| Dual-rendered mobile+desktop trees | settings, CRM list/detail/inbox surfaces | §10 |
| Redirect-stub double navigations | 17 stub routes incl. `/admin` home | §1.4 |

---

## 12. Dead / stale artifacts inventory

- `CrmMobileTabBar` unread badge — unreachable (§9.1).
- `ConsoleCommandPalette` NAV labels "(brand admin)" ×2 — reference a deleted shell (§9.3).
- `ConsoleShell` docblock "sticky left rail on desktop" + `check-admin-mobile-shell.mjs:37` "desktop rail" — no rail exists.
- `report_viewer` role — no rows exist, its one layout allowance leads into a superuser wall (§4.1, §6.5).
- `reports/layout.tsx` report_viewer branch — vestigial.
- `/admin/crm/automations` — redirect to sequences; nothing links to it (kept as "FUB-parity URL").
- `/admin/email` index, `/admin/visitors` index, `/admin/people` index — stub indexes for menus that never link to them.
- `AdminNavIcons` registry (~44 lucide imports, `AdminNavIcons.tsx`) — icons render only in the mobile Sheet; desktop dropdowns ignore them.
- `admin-nav.ts` icon union includes icons no item uses (`building`, `camera`, `image`, `images`, `file-search`… minor).
- `/admin/console/leads/[id]` stub — load-bearing for legacy links; the other two console stubs are near-expired.
- `getHelpArticleIndex` hand-rolled YAML parser — duplicate of gray-matter functionality, per-request disk I/O.

---

## 13. Per-surface verdicts

| Surface | Verdict | One-line reason |
|---|---|---|
| `app/admin/layout.tsx` | works | intentional no-op |
| `(protected)/layout.tsx` | partial | auth chain correct + deduped, but hardcoded auth-error target loses deep links; help index read per request |
| `ConsoleShell` | partial | single shell achieved; stale docs; padding fought by pages; double palette mount |
| `ConsoleTopNav` | partial | works; 18-item dropdown; no account menu/sign-out; navy hardcoded inline |
| `AdminNavList` (mobile sheet) | works | grouped, persisted, active-tracking correct (longest-match, `AdminNavList.tsx:42-54`) |
| `buildAdminNav` | broken (as a contract) | two-pass regroup produces role dead-ends ×4+ and a duplicate item; three sources of truth for access |
| `CrmMobileTabBar` | partial | works as nav; unread badge dead; hardcoded tab set diverges from nav source |
| `ConsoleCommandPalette` | partial | lead search works; nav coverage 4/56 with stale labels; double-mount ⌘K/Escape bug |
| `ConsoleQuickAction` | works | context recommendation lazy-loads with pending state (`ConsoleQuickAction.tsx:92-101`); suppression-rule sprawl is a maintainability smell |
| `KeyboardInsetSync` / console-theme tokens | works | careful, documented; but a global-attribute protocol multiple components must obey by convention |
| Nested gate layouts ×8 | partial | correct but copy-pasted; produce wrong-copy dead ends |
| `AdminLinkTabs` sections (geo/media/sync/ops) | works | consistent tab pattern |
| `/admin/login` | partial | One Tap flow solid; ignores `next`; no error state for non-admin Google accounts until after full redirect |
| `/admin/setup` | works | one-time gate; costs a query on every /admin visit forever |
| `/admin/access-denied` | partial | renders (no loop), but copy wrong for role-gated arrivals, no back-link |
| `/admin/console/*` | dead (stubs) | consolidation shims, intentionally |
| `middleware.ts` (admin-relevant) | partial | no auth/session layer at all for /admin; geo-block can lock out a traveling broker |
| `admin-roles.ts` actions | works | guarded, audited, memoized; platform-user listing is a 60-round-trip counter |
| Auth/session architecture | broken | no persistable refresh path on page renders (§4.4) |
| Help system (HelpProvider/Button/KB) | works | tours filter to visible targets; KB at /admin/help reachable via FAB only |

---

## 14. Numbers the rebuild architect asked for

- **Nav items per role:** superuser 56 (5 menus), broker 30 (4 menus), report_viewer 17 (4 menus) — §5.1 table.
- **Distinct navigation systems: 8** (9 counting the Help FAB) — §5.
- **Per-request protected-layout overhead:** 1 GoTrue round trip (2 once token expired — refresh + retry, never persisted) + 0-1 `admin_roles` query + 12 fs reads + hidden SiteHeader (4 DAL fetches, cached TTL) + `settings` query when landing on `/admin` — §2, §11.
- **Nested layouts:** 12 files; 8 are pure copy-paste role gates adding zero UI; 4 add tab bars — §3.
- **Role dead ends: 6 distinct classes** — §6.
- **Deep-linking on mobile:** works signed-in; expired session = 4 redirects and destination loss — §7.1.
- **Redirect stubs: 17; force-dynamic pages: 123/150; pages with CSS viewport forks: 28 files.**
