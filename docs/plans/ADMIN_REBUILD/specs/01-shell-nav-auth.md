# Spec 01 — Shell, Navigation, Auth, Capability Model

> **Area:** the admin shell and the foundation everything else sits on.
> **Derived from:** `../00-REASONING-AND-ARCHITECTURE.md` (§4.4 one auth primitive +
> one capability map; §4.3 one responsive tree; §4.6 render architecture; §5 the
> 8-destination IA; §7 sequencing — this is **Foundation, built first**) and the
> ground-truth audit `../audit-reports/shell-ia.md`.
> **Conforms to:** C1 (right size is small — ≤5 humans, 3 roles), C2 (the loop, not
> pages), C3 (phone-first), C5 (send integrity — sign-out is the only shell
> mutation and it is idempotent by construction). Kills **RC5** (three disagreeing
> authz layers) and the shell half of **RC3** (forked trees) and **RC4**
> (accretion — 8 nav systems, 56 items, 17 redirect stubs).

This spec is the load-bearing floor: the auth primitive, the capability map, the
nav generator, and the responsive shell that hosts every other spec's surfaces.
Nothing in specs 02–08 renders without it. A senior engineer can build every
feature below from this document with no further questions.

---

## 0. What this area owns (and what it explicitly does not)

**Owns:** the ONE responsive shell (top bar + adaptive nav + bottom tab bar +
sheet, single component tree); the capability model + capability→role map as the
single source of access truth; the `requireAdmin(capability)` primitive used
in-body by every action/route AND as the nav generator; the account menu +
sign-out; the auth funnel with preserved `next`; middleware session-refresh +
admin-chrome kill + geo-block exemption; the global command palette; the
notification→action deep-link routing; the `ci:admin-authz` mechanical gate; and
the final 8-destination IA with every current route mapped.

**Does not own (cross-spec seams, called out in §16):** the Inbox/conversation
model and the unread-count writer (spec 02); the PEOPLE list + PERSON workspace
and the send loop (spec 03); the metric layer behind PERFORMANCE (spec 04);
TRANSACTIONS internals (spec 05); the consumer-site account menu (spec 06 — this
spec owns only the *admin* account menu). The shell declares the destinations,
their capabilities, and their nav entries; the destination pages are built by the
owning specs against the capability constants defined here.

---

## 1. Kept core — what we build ON, never discard

The audit is explicit (`shell-ia.md` §4.2, §13) that the server-side auth core is
correct. The rebuild reuses it and extends it — it does **not** re-implement auth.

| Kept artifact | File / symbol | Why it stays | How this spec uses it |
|---|---|---|---|
| Shared admin guard | `lib/auth/guards.ts` — `getAdminContext()`, `requireAdminOr403()`, `requireSuperuserOr403()`, `isAuthorizedAdminOrCron()` | "The single source" for the ~6 inline authz patterns (its own docblock). Verified session → email → role chain is correct. | `requireAdmin(capability)` (§4) is a thin **extension** of `getAdminContext()`, not a replacement. |
| Role resolver | `app/actions/admin-roles.ts` — `getAdminRoleForEmail()` (React-cached via `resolveAdminRole`) | Superuser short-circuits with zero DB (`isSuperuserAdmin`); service-role read of RLS-locked `admin_roles` for brokers, correctly (silently denied Rebecca+Paul until 2026-06-09, `admin-roles.ts:44-47`). | Feeds the capability check; extended to also return `can_export` / `pause_leads`. |
| Superuser constant | `lib/admin.ts` — `isSuperuserAdmin()` (hardcoded `matt@ryan-realty.com`) | Deliberate: superuser is not a grantable DB row (`upsertAdminRole` refuses it, `admin-roles.ts:91`). | Superuser = every capability, by construction. |
| CRM access resolver | `app/actions/crm.ts` — `getCrmAccess()` (React-cached) | Resolves own-broker slug; fully deduped against role resolution (`crm.ts:46-52`). | Broker scope for capability + nav label. |
| Redirect sanitizer | `lib/auth/safeRedirect.ts` — `safeRedirectPath()` | Closed the `//evil.com` open-redirect (audit p0.2). Guarded by `ci:auth-redirect`. | Every `next` in the funnel routes through it (§8). |
| Sign-out action | `app/actions/auth.ts` — `signOut()` | Exists, correct, **zero admin callers** (audit §8). | Wired into the account menu (§7). |
| OAuth callback | `app/auth/callback/route.ts` | Already funnel-correct: reads `auth_next` cookie → `?next=` → `safeRedirectPath`, deletes the cookie, preserves the destination (`callback:102-104,151-153`). **Not broken** — the break is upstream (login form + layout hardcode `/admin`). | Reused unchanged; the login form is fixed to feed it the real `next` (§8). |
| Cron auth pattern | `lib/marketing-brain/snapshot.ts` — `isAuthorizedCron()` / `lib/auth/cron-auth.ts` — `isValidCronAuth()` | The fail-closed template §4.4 of the architecture names. | `isAuthorizedAdminOrCron()` (guards.ts) already composes it; unchanged. |
| Job-grouped nav intent | `app/components/admin/admin-nav.ts` — `buildAdminNav()` (the *grouping-by-job* idea) | Grouping by job not data source is correct (matches C2). The two-pass regroup that **bypasses role gating** (`admin-nav.ts:161-211`) is the bug, not the grouping. | Rebuilt as a declarative capability→destination table (§5); the "group by job" intent is preserved, the imperative regroup is deleted. |
| Mobile nav list | `app/components/admin/AdminNavList.tsx` | Verdict "works" — grouped, localStorage-persisted, longest-match active tracking (`AdminNavList.tsx:42-54`). | Reused as the sheet/rail renderer, fed the capability-filtered sections. |
| Quick-action FAB | `components/console/ConsoleQuickAction.tsx` | Verdict "works" — lazy context recommendation with pending state. | Reused; its create-action hrefs re-pointed to canonical destinations (§13). |
| Keyboard-inset sync | `components/console/KeyboardInsetSync.tsx` | Verdict "works" — the `--kb-inset`/`[data-kb-open]` contract mobile composers depend on. | Reused unchanged; the shell keeps publishing the contract. |
| Section tab pattern | `AdminLinkTabs` (geo/media/sync/ops) | Verdict "works" — consistent per-section tabs. | The pattern is reused for the tabs *inside* the 8 destinations. |
| Neutral token scope | `app/admin/(protected)/console-theme.css` (`.console-root`) | The Linear/Notion re-skin; Matt directive 2026-06-15 "does not need to enforce brand in admin". | Kept; the shell root stays `.console-root`. |

**Deleted (accretion, RC4/RC5 — §12 lists all):** the 8-way nav plurality, the
two-pass regroup, the double-mounted command palette, the hardcoded 5-tab mobile
bar as a *separate* data source, the 17 redirect stubs, the stale "brand admin"
labels, the vestigial `report_viewer→reports→superuser-wall` path, and the
per-component pathname-regex suppression sprawl (replaced by one layout contract,
§3.5).

---

## 2. The capability model — the single source of access truth (kills RC5)

RC5: access rules live in (a) nav conditionals, (b) 8 copy-pasted gate layouts,
(c) per-page checks — three sources that demonstrably disagree, producing **6
classes of broker dead-ends** (`shell-ia.md` §6). The fix (§4.4 of the
architecture): **one map, consumed by both the guard and the nav generator, so
they cannot disagree.**

### 2.1 Roles (unchanged set, `admin-roles.ts:11`)

`AdminRoleType = 'superuser' | 'broker' | 'report_viewer'`. Three roles for ≤5
humans (C1). Superuser = Matt (hardcoded email). Broker = Rebecca, Paul.
`report_viewer` = read-only numbers (currently 0 rows — see Open Question OQ-1).

### 2.2 Per-user flags (already on `admin_roles`, schema-verified)

From `docs/DATABASE_SCHEMA_SNAPSHOT.md` (`admin_roles`): `can_export boolean NOT
NULL default true`, `pause_leads boolean NOT NULL default false`. These are
per-user overrides layered on the role:

- `can_export` — gates the export capability even for a broker (§2.4).
- `pause_leads` — **routing state, not a capability** (whether this broker
  receives round-robin lead assignment). Out of scope for authz/nav; owned by the
  routing settings (spec 03/07). Documented here only so it is not mistaken for a
  capability.

### 2.3 Capabilities (the flat, closed enum)

Capabilities are verbs-on-resources, deliberately **code-defined** (not a DB
table) so the `ci:admin-authz` gate can verify statically that a page and its nav
item reference the *same* capability symbol (§10). New file:
`lib/admin/capabilities.ts`.

```ts
export type Capability =
  // Destinations (top-level nav — one per §5 IA entry)
  | 'today.view'
  | 'inbox.view'
  | 'people.view'
  | 'transactions.view'
  | 'performance.view'
  | 'content.view'
  | 'settings.view'          // everyone: the account/my-settings subset always shows
  // Sensitive sub-capabilities (tabs + actions inside a destination)
  | 'inbox.send'
  | 'people.edit'
  | 'people.import'
  | 'people.export'          // flag-gated (can_export)
  | 'send.deliverable'       // CMA / BPO / newsletter / saved-search from PERSON
  | 'transactions.edit'
  | 'transactions.signoff'   // principal-broker sign-off
  | 'commissions.view'
  | 'financials.view'
  | 'content.manage'         // writes to the public site (listings/site-pages/media/blog)
  | 'settings.team'          // admin_roles management
  | 'settings.routing'       // pond/round-robin/assignment rules
  | 'settings.automations'   // sequences/workflows authoring
  | 'settings.templates'     // message/email templates
  | 'settings.suppression'   // suppression list / compliance
  | 'settings.account'       // my settings + sign-out (everyone)
  | 'audit.view'

export type AdminFlag = 'can_export'

/** The ONE map. Role → capabilities it holds. Superuser is omitted here and
 *  granted EVERY capability by construction in hasCapability (so a new capability
 *  is automatically superuser-held and can never dead-end Matt). */
export const CAPABILITY_ROLES: Record<Capability, AdminRoleType[]> = {
  'today.view':          ['broker', 'report_viewer'],
  'inbox.view':          ['broker'],
  'people.view':         ['broker'],
  'transactions.view':   ['broker'],
  'performance.view':    ['report_viewer'],           // + superuser; broker => OQ-2
  'content.view':        [],                           // superuser only
  'settings.view':       ['broker', 'report_viewer'],
  'inbox.send':          ['broker'],
  'people.edit':         ['broker'],
  'people.import':       [],                            // superuser only
  'people.export':       ['broker'],                   // AND requires can_export flag
  'send.deliverable':    ['broker'],
  'transactions.edit':   ['broker'],
  'transactions.signoff':[],                            // superuser only (principal broker)
  'commissions.view':    ['broker'],
  'financials.view':     [],                            // superuser only
  'content.manage':      [],                            // superuser only (RC5 security)
  'settings.team':       [],                            // superuser only
  'settings.routing':    [],
  'settings.automations':[],
  'settings.templates':  [],
  'settings.suppression':[],
  'settings.account':    ['broker', 'report_viewer'],
  'audit.view':          [],
}

/** Capabilities that additionally require a per-user flag. */
export const CAPABILITY_FLAG: Partial<Record<Capability, AdminFlag>> = {
  'people.export': 'can_export',
}
```

### 2.4 The check (one function, used everywhere)

```ts
export interface AdminContext {          // extends lib/auth/guards.ts AdminContext
  email: string
  role: AdminRoleType
  brokerId: string | null
  brokerSlug: CrmBrokerSlug | null       // from getCrmAccess
  flags: { canExport: boolean; pauseLeads: boolean }
}

export function hasCapability(ctx: AdminContext, cap: Capability): boolean {
  if (ctx.role === 'superuser') return true            // superuser holds all — no dead-ends, ever
  if (!CAPABILITY_ROLES[cap].includes(ctx.role)) return false
  const flag = CAPABILITY_FLAG[cap]
  if (flag && !ctx.flags[flag === 'can_export' ? 'canExport' : 'pauseLeads']) return false
  return true
}
```

`content.manage`, `content.view`, `financials.view`, `settings.team`,
`transactions.signoff`, `people.import`, `audit.view`, and all `settings.*`
authoring caps have empty role arrays → **superuser only** by construction. This
is the security posture RC5's criticals demand: the public-site writers
(blog/site-pages/branding, `content-geo-media.md crit #1`) and TC-doc reads
(`deals-tc.md high #1`) are `content.manage` / `transactions.view` gated in-body,
not merely layout-gated.

---

## 3. FEATURE — The one responsive shell (kills the shell half of RC3)

### 3.1 Purpose & the job it serves

RC3: 27 mobile components duplicate the desktop trees, CSS-toggled, both
server-rendered every request (`shell-ia.md` §10 — 28 files use `md:hidden`/
`lg:hidden` forking; `MobileSettingsScreen` + `MySettingsForm` both render into
every payload). The audit's own §0 headline: the "two shells" problem was fixed
2026-07-15 (one `ConsoleShell`), but the shell now "accretes patches instead of
owning a layout contract" (§9.5). The job (C3): a broker in a driveway opens the
admin on a phone and the primary nav, the destinations, and the loop all work —
**the same tree** that a laptop shows, adapted, not a lossy mobile fork.

### 3.2 What we keep / rebuild / delete

- **Keep:** `ConsoleShell` as the single host; `.console-root` token scope;
  `AdminNavList` (sheet renderer); `ConsoleQuickAction`; `KeyboardInsetSync`.
- **Rebuild:** the shell as ONE component that renders ONE `navSections` source at
  three breakpoints (top-bar dropdowns at `lg+`, bottom tab bar + hamburger sheet
  below) — no second data source, no hardcoded tab set. Fix the stale docblock
  ("sticky left rail on desktop" — there is no rail, `ConsoleShell.tsx:9-10`,
  `shell-ia.md §1.3`).
- **Delete:** the hardcoded 5-tab `CrmMobileTabBar` tab list as an *independent*
  source (`CrmMobileTabBar.tsx:29-37`) — the tab bar derives its tabs from the
  capability nav; the double-mounted command palette (§9); the per-component
  pathname-regex FAB-suppression sprawl (replaced by §3.5).

### 3.3 One tree, three breakpoints (not a fork)

`ConsoleShell` receives exactly one `navSections: NavSection[]` (capability-
filtered, §5). It renders:

- **`lg+`:** horizontal top bar (navy `#102742`, kept from `ConsoleTopNav`) —
  wordmark, the ≤8 destinations as links/dropdowns, command-palette trigger,
  account menu (§7).
- **`< lg`:** sticky top header (hamburger → sheet with `AdminNavList` fed the
  *same* `navSections`) + a bottom tab bar showing the **first 5 destinations from
  `navSections`** (derived, not hardcoded) + the account avatar opens the same
  account menu.
- **Progressive enhancement, not a second tree:** where desktop affords more (a
  multi-column PERSON workspace, a pipeline board with columns), it is CSS/
  container-query enhancement of the *same* component (§4.3 of the architecture),
  authored mobile-first. No `md:hidden` twin component. The `ci:admin-responsive`
  gate (baseline 0 violations, `admin-responsive-baseline.json`) continues to hold
  table/grid responsiveness mechanically.

### 3.4 Bottom tab bar — derived, badge wired-or-omitted

The tab bar takes its tabs from `navSections` (first 5 destinations: TODAY, INBOX,
PEOPLE, TRANSACTIONS, PERFORMANCE-or-SETTINGS by role). The **unread badge**
(`CrmMobileTabBar.tsx:56` — currently dead, never passed a value, `shell-ia.md
§9.1`) is wired to a real writer or **not rendered** (§8 done-ness, no placebo):
the shell reads `getInboxUnreadCount(ctx)` (cached DAL, tagged `inbox:unread`,
owned by spec 02's conversation model) and passes it to the INBOX tab + INBOX nav
item. **Until spec 02 lands, the badge is omitted, not shown as 0.**

### 3.5 One layout contract (replaces the regex sprawl)

The bottom-edge choreography (tab bar, FABs, composer, soft keyboard —
`shell-ia.md §9.5`) becomes one documented contract instead of per-component
pathname regexes:

- `KeyboardInsetSync` publishes `--kb-inset` / `[data-kb-open]` (kept).
- The shell owns a single `--admin-dock-offset` CSS var (replacing the
  "load-bearing 3.5rem" magic constant, `console-theme.css:33-39`) computed from
  the tab-bar height; composers and FABs read it.
- FAB visibility is a prop on the shell (`showQuickAction`, `showTabBar`) decided
  once by the current destination, not by N independent regexes in N components.

### 3.6 States

| State | Behavior |
|---|---|
| Loading (streamed) | Shell chrome (top bar, nav, tab bar) renders **instantly** from the cached auth context; the page body is `<Suspense>`-wrapped by the destination (§4.6 architecture). One generic `(protected)/loading.tsx` is replaced by chrome-instant + per-region suspense. |
| Populated | Nav reflects the caller's capabilities; active destination highlighted (longest-match, kept from `AdminNavList.tsx:42-54`). |
| Permission-denied (direct URL) | Structurally rare (nav can't show what the guard denies). A hand-typed URL to a capability the caller lacks → `/admin/access-denied` with the section name + a "Back to Today" link (§7.4). |
| Offline | The shell is a client component after hydration; nav is client-side routing. An offline hard-nav shows the browser offline page; a soft-nav to a cached route works; a mutation while offline surfaces the optimistic-fail Retry (§4.2 architecture, owned per-mutation). |
| Over-limit | N/A for the shell (no shell rate limit). |

### 3.7 Performance (§4.6 architecture)

- **Kill the hidden public-site chrome on admin (audit §2.2, §11).** `SiteHeader`
  (4 DAL fetches: `getMarketPulseCitySnapshots`, `getMarketPulseRegionSnapshot`,
  `getPriceDropDigest`, `getPriceDrops`), `SiteFooter`, and `GTMHead` must
  **return `null` server-side on `/admin/**`** — a conditional render, not the
  current CSS `display:none` (`HideOnLP.tsx:64-72`) that still serializes the
  header HTML + runs its DAL into every admin payload and leaks GTM
  (`GTMHead` in `<head>`, `app/layout.tsx:105`, ungated). Gate: read the
  `x-pathname` header stamped by middleware (§8.4) in the root layout; when it
  starts with `/admin`, skip site chrome. This also closes the GA4-pollution
  regression (`shell-ia.md §2.2`).
- **Help index off the request hot path.** Replace `getHelpArticleIndex()`'s
  per-request `fs.readdirSync` + 12 `readFileSync` + hand-rolled frontmatter parse
  (`lib/admin-help.ts:65-81`, audit §12) with a build-time generated JSON import
  (or `unstable_cache` with a long TTL keyed on a content hash). The help metadata
  stops re-reading disk and stops serializing into every payload.
- **Drop the `/admin` per-visit `getSetupComplete()` tax.** The anon-key `settings`
  query on every `/admin` hit years after setup (`(protected)/page.tsx:16`,
  `admin-setup.ts:5-14`, audit §4.5) is removed from the hot path: `/admin` index
  redirects straight to TODAY (or to the preserved `next`); setup-complete is
  checked only inside the one-time `/admin/setup` flow, cached module-side.
- Auth resolution stays React-cached (kept). No new per-request I/O added by the
  shell.

### 3.8 Acceptance criteria (writer→store→reader→outcome)

- [ ] One `ConsoleShell` renders at 375px (phone), 768px (tablet), 1280px
  (laptop) from the **same** `navSections` prop; no component under `app/admin/`
  imports a second nav data source (grep: no hardcoded tab arrays).
- [ ] An admin hard-loads `/admin/people`; the RSC payload contains **zero**
  `SiteHeader`/`SiteFooter` markup and **zero** market-pulse DAL calls (verify via
  network trace + payload inspection). GTM does not fire on `/admin`.
- [ ] `md:hidden`/`lg:hidden` twin-component count under `app/admin/` for the
  shell surfaces = 0 (settings, nav, tab bar); `ci:admin-responsive` baseline
  stays 0.
- [ ] The bottom tab bar's tabs equal the first 5 of `navSections` for the caller;
  switching role changes the tabs with no code edit.

---

## 4. FEATURE — `requireAdmin(capability)` (kills RC5, the security criticals)

### 4.1 Purpose & the job it serves

§4.4 of the architecture: **one** guard, called **in-body** by every server
action and route handler (defense in depth — the layout gate only protects page
*rendering*; actions are independently-invocable POSTs carrying no in-body auth,
`shell-ia.md §2.5`, the source of RC5's unauthenticated stored-XSS + service-role-
read criticals). Same guard is the nav generator's predicate (§5) so nav and
access can never disagree.

### 4.2 What we keep / rebuild / delete

- **Keep + extend:** `lib/auth/guards.ts` `getAdminContext()`. `requireAdmin` is a
  capability-aware wrapper over it.
- **Delete:** the 8 copy-pasted gate layouts (`analytics/layout.tsx`,
  `audit-log/layout.tsx`, `expired-listings/layout.tsx`, `listings/layout.tsx`,
  `media/banners/layout.tsx`, `media/stock-photos/layout.tsx`,
  `operations/optimization/layout.tsx`, `sync/layout.tsx`, `reports/layout.tsx` —
  `shell-ia.md §3`) as *authz*. Section layouts survive only where they add UI
  (tab bars); the authz moves in-body.

### 4.3 The primitive (three call shapes, one core)

New file: `lib/admin/require-admin.ts`, built on `getAdminContext()`.

```ts
// Core resolver: extends guards.ts AdminContext with brokerSlug + flags.
export async function resolveAdminContext(): Promise<AdminContext | null> { … }

// (a) PAGE / layout guard — redirects, preserving the destination for the funnel.
export async function requireAdminPage(cap: Capability): Promise<AdminContext> {
  const ctx = await resolveAdminContext()
  if (!ctx) redirect(`/admin/login?next=${encodeURIComponent(currentPath())}`)  // §8.1
  if (!hasCapability(ctx, cap)) redirect(`/admin/access-denied?cap=${cap}`)      // §7.4
  return ctx
}

// (b) SERVER-ACTION guard — returns a typed result the client renders (no throw
//     that becomes an opaque 500; the composer shows the message).
export async function requireAdminAction(cap: Capability):
  Promise<{ ok: true; ctx: AdminContext } | { ok: false; error: string }> {
  const ctx = await resolveAdminContext()
  if (!ctx) return { ok: false, error: 'Your session expired. Sign in again.' }
  if (!hasCapability(ctx, cap)) return { ok: false, error: 'You do not have access to this action.' }
  return { ok: true, ctx }
}

// (c) ROUTE-HANDLER guard — 403 Response (composes the kept requireAdminOr403).
export async function requireAdminRoute(cap: Capability): Promise<AdminContext | Response> {
  const ctx = await resolveAdminContext()
  if (!ctx) return new Response('Forbidden — admin access required', { status: 403 })
  if (!hasCapability(ctx, cap)) return new Response('Forbidden — capability required: ' + cap, { status: 403 })
  return ctx
}
```

`currentPath()` reads the `x-pathname` header (middleware-stamped, §8.4), since a
server component cannot otherwise see its own path.

### 4.4 In-body usage (the invariant `ci:admin-authz` enforces)

- Every **page** under `app/admin/(protected)/**/page.tsx` calls
  `requireAdminPage(<cap>)` as its first await, with `<cap>` imported from
  `lib/admin/capabilities.ts` — the **same symbol** its nav destination declares.
- Every **server action** under `app/actions/**` that mutates calls
  `requireAdminAction(<cap>)` before any service-role write. (Existing
  `upsertAdminRole`/`removeAdminRole` already guard superuser inline,
  `admin-roles.ts:84-87`; they migrate to `requireAdminAction('settings.team')`.)
- Every **route handler** under `app/api/admin/**` and any service-role read of
  sensitive data (TC docs, blog writes) calls `requireAdminRoute(<cap>)` or the
  kept `isAuthorizedAdminOrCron()` for cron-shared endpoints.

### 4.5 States & edge cases

| Case | Behavior |
|---|---|
| Expired session mid-action (e.g. mid-send) | `requireAdminAction` returns `{ok:false, error:'Your session expired…'}`. The optimistic row (§4.2 architecture) marks failed with **Retry**; the retry, after re-auth, replays with the **same idempotency key** → no double-send (C5). |
| Superuser gains a new capability | Zero config: `hasCapability` grants superuser everything; a new `Capability` is auto-superuser and cannot dead-end Matt. |
| Broker without `broker_id` | `resolveAdminContext` returns `brokerId:null`; capabilities that need own-scope (people.edit) still resolve, but the *scope* clamp (`buildCrmPeopleQuery`, kept) yields their own (empty) book. "My profile" resolves to a real page, not a dead-end (contrast `brokers/page.tsx:18` today). |
| `report_viewer` hits a mutation route | Empty role array for every mutate cap → `403` / typed refusal. Reads gated `performance.view`/`today.view` succeed. |
| Concurrent broker edits (two brokers edit the same contact) | Authz passes for both; conflict resolution is the mutation's concern (last-writer-wins with a returned entity, §4.2 architecture) — the guard does not serialize. |
| Direct POST to an action with a forged body | The guard reads identity from the **verified Supabase session**, never the body; a forged `role`/`email` field is ignored (same posture as `admin-roles.ts:46`). |
| Layout renders in parallel with page (Next.js) | Page's own `requireAdminPage` is the boundary at the data source; the parallel layout render no longer carries authz (moved in-body), so there is no "protected by response-abort timing" gap (`shell-ia.md §2.5`). |

### 4.6 Acceptance criteria

- [ ] A broker POSTs directly (curl with their session cookie) to a
  `content.manage` action (e.g. a blog write) → `403`/typed refusal, **no write**;
  verified against the DB (row unchanged). This closes `content-geo-media.md crit
  #1`.
- [ ] An unauthenticated POST to any `app/actions/**` mutation → refusal, no write.
- [ ] `ci:admin-authz` (§10) is green: every mutating action calls a `requireAdmin*`
  guard; every gated page imports its capability from `capabilities.ts`.

---

## 5. FEATURE — Nav generated from the capability map (kills the 6 dead-end classes)

### 5.1 Purpose

RC5's visible symptom: nav shows items the page denies — Listings, Import
contacts, every Expireds/CMAs detail link, the whole `report_viewer` path
(`shell-ia.md §6`, 6 classes). Because the nav is built imperatively in two passes
that *bypass* the role gates (`admin-nav.ts:161-211`), it regressed ≥4 times. The
fix: the nav is a **projection of the capability map** — an item exists iff
`hasCapability(ctx, item.capability)`.

### 5.2 The declarative destination table (replaces `buildAdminNav`)

`lib/admin/nav.ts`:

```ts
export interface NavDestination {
  key: string
  label: string
  href: string
  icon: AdminIconName
  capability: Capability          // the SAME symbol the page guards on
  children?: NavChild[]           // section tabs (also capability-gated)
}
export interface NavChild { label: string; href: string; capability: Capability }

export const DESTINATIONS: NavDestination[] = [
  { key:'today',        label:'Today',         href:'/admin/today',        icon:'dashboard', capability:'today.view' },
  { key:'inbox',        label:'Inbox',         href:'/admin/inbox',        icon:'inbox',     capability:'inbox.view' },
  { key:'people',       label:'People',        href:'/admin/people',       icon:'users',     capability:'people.view' },
  { key:'transactions', label:'Transactions',  href:'/admin/transactions', icon:'handshake', capability:'transactions.view',
    children:[
      { label:'Deals',       href:'/admin/transactions',             capability:'transactions.view' },
      { label:'Signing',     href:'/admin/transactions/signing',     capability:'transactions.edit' },
      { label:'Commissions', href:'/admin/transactions/commissions', capability:'commissions.view' },
      { label:'Financials',  href:'/admin/transactions/financials',  capability:'financials.view' },
      { label:'Forms',       href:'/admin/transactions/forms',       capability:'transactions.edit' },
      { label:'Sign-off',    href:'/admin/transactions/sign-off',    capability:'transactions.signoff' },
    ]},
  { key:'performance',  label:'Performance',   href:'/admin/performance',  icon:'bar-chart', capability:'performance.view' },
  { key:'content',      label:'Content',       href:'/admin/content',      icon:'files',     capability:'content.view',
    children:[
      { label:'Listings',   href:'/admin/content/listings',   capability:'content.manage' },
      { label:'Site pages', href:'/admin/content/site-pages', capability:'content.manage' },
      { label:'Media',      href:'/admin/content/media',      capability:'content.manage' },
      { label:'Blog',       href:'/admin/content/blog',       capability:'content.manage' },
      { label:'Geography',  href:'/admin/content/geo',        capability:'content.manage' },
    ]},
  { key:'settings',     label:'Settings',      href:'/admin/settings',     icon:'user-cog',  capability:'settings.view',
    children:[
      { label:'My account',   href:'/admin/settings',              capability:'settings.account' },
      { label:'Brokers',      href:'/admin/settings/brokers',      capability:'settings.team' },
      { label:'Routing',      href:'/admin/settings/routing',      capability:'settings.routing' },
      { label:'Templates',    href:'/admin/settings/templates',    capability:'settings.templates' },
      { label:'Automations',  href:'/admin/settings/automations',  capability:'settings.automations' },
      { label:'Suppression',  href:'/admin/settings/suppression',  capability:'settings.suppression' },
      { label:'Audit log',    href:'/admin/settings/audit',        capability:'audit.view' },
      { label:'Site users',   href:'/admin/settings/site-users',   capability:'settings.team' },
    ]},
]

export function buildNav(ctx: AdminContext): NavSection[] {
  return DESTINATIONS
    .filter(d => hasCapability(ctx, d.capability))
    .map(d => ({ ...d, children: (d.children ?? []).filter(c => hasCapability(ctx, c.capability)) }))
}
```

Eight destinations (`shell-ia.md §14`: was 56 superuser / 30 broker / 17
report_viewer across 5 menus). By role:

- **Superuser:** all 8, all children.
- **Broker:** Today, Inbox, People, Transactions (Deals/Signing/Commissions/Forms
  — no Sign-off/Financials), Settings (My account only, unless OQ-2 grants
  performance). ~5 destinations.
- **report_viewer:** Today, Performance, Settings (My account). ~3 destinations —
  and every one **reaches a real page** (kills the `report_viewer→reports→
  superuser-wall` dead-end, `shell-ia.md §6.5`).

### 5.3 Why dead-ends become impossible

Nav item and page both reference the *same* `Capability` constant. `buildNav`
filters on `hasCapability`; `requireAdminPage` checks `hasCapability`; the
`ci:admin-authz` gate asserts the destination's declared capability equals the
capability the destination page guards on (§10). Three references, one source →
they cannot disagree. There is no "second pass" that bypasses gates.

### 5.4 States & edge cases

| Case | Behavior |
|---|---|
| Empty section for a role | A destination whose children all fail `hasCapability` still shows if the top-level cap passes (e.g. Transactions with only Deals for a broker) — it never renders an empty dropdown. If the top cap fails, the whole destination is absent. |
| Duplicate item (today: `/admin/crm/settings` in two menus, `admin-nav.ts:133,189`) | Impossible — a destination appears once in `DESTINATIONS`. |
| Nav-invisible live page (today: `/admin/crm/workflows`, `/admin/guides`, `shell-ia.md §1.4`) | Every live route is either a destination, a child, or a DELETE (§13). The `ci:nav-reachability` gate is extended to admin (§10) so an orphan live route fails CI. |
| Role changes mid-session (superuser demotes a broker) | Next request re-resolves `admin_roles` (React-cached per request, fresh across requests); nav + guards reflect the new role on the next navigation. |

### 5.5 Acceptance criteria

- [ ] For each role, every nav item's href resolves to a page whose
  `requireAdminPage` capability == the nav item's capability (proven by
  `ci:admin-authz`). Zero dead-ends for superuser, broker, report_viewer.
- [ ] A broker sees no Listings/Import/Content items (they're `content.manage`/
  `people.import` = superuser-only) — the 6 audited dead-end classes are gone.
- [ ] Adding a capability to a role's array changes both nav visibility and access
  with no other code edit.

---

## 6. FEATURE — Account menu + sign-out (fills the audited absence)

### 6.1 Purpose

`grep -rni "sign.?out|log.?out"` across `app/admin/`, `components/console/`,
`components/admin/` returns **zero UI hits** (`shell-ia.md §8`). To sign out today
a broker must leave for the public site. On a shared device, wrong-account
recovery is unsupported. The `signOut()` action exists with no caller.

### 6.2 The component (one, in the single tree)

A `DropdownMenu` on the avatar, rendered once by the shell (used by both the `lg+`
top bar and the `< lg` header — one component, not two). Contents:

- **Identity header:** name, email, role label (reuse the `brokerLabel` the layout
  already computes: `"Matt Ryan · superuser"` / `"All brokers · superuser"`,
  `(protected)/layout.tsx:42-46`).
- **My account** → `/admin/settings` (`settings.account`).
- **View site** → `/` (moved here from the `xl+`-only top-bar link,
  `ConsoleTopNav.tsx:96-100`, so mobile finally has a path back to the public site
  — `shell-ia.md §10`).
- **Switch account** → sign-out then `/admin/login` (so One Tap can offer a
  different Google account).
- **Sign out** → `signOut()` server action → redirect `/admin/login`.

### 6.3 Sign-out flow (the only shell mutation; idempotent per C5/§4.2)

1. Tap **Sign out** → optimistic "Signing out…" (disable the menu).
2. Call `signOut()` (`app/actions/auth.ts:169`) → `supabase.auth.signOut()` clears
   the session cookies.
3. Hard-redirect to `/admin/login`. Signing out twice is a no-op (idempotent by
   construction — no idempotency key needed).

### 6.4 States & edge cases

| Case | Behavior |
|---|---|
| Sign-out network failure | Optimistic state reverts to the menu with an inline "Couldn't sign out — try again." The local session may still be valid; nothing is half-torn. |
| Already signed out in another tab | `signOut()` succeeds (no session to clear); redirect to login proceeds. |
| Avatar image 403s (Google referrer policy) | Fallback initials chip (kept, `ConsoleShell.tsx:100-102`); menu still opens. |
| Session expired when menu opens | Menu still opens (client state); tapping any item routes to `/admin/login?next=…`. |

### 6.5 Acceptance criteria

- [ ] Sign-out is reachable in ≤2 taps from every admin page on phone and laptop.
- [ ] After sign-out, `/admin/*` redirects to login; the back button does not
  restore an authenticated view (session cookies cleared).
- [ ] "Switch account" lands on One Tap able to pick a different Google account.

---

## 7. FEATURE — Auth funnel with preserved `next` (fixes the deep-link loss)

### 7.1 Purpose

The single biggest daily-use failure (`shell-ia.md §7.1`): a broker taps an
SMS/notification link to `/admin/crm/12345` with an expired session and lands on
the **dashboard**, not the lead — 4 redirects, 2 user actions, destination lost,
because `(protected)/layout.tsx:33` hardcodes `next=/admin` and
`AdminLoginForm` hardcodes `ADMIN_NEXT='/admin'` and never reads `?next=`. This is
C2's top edge (notification→action) severed.

### 7.2 The corrected funnel (destination preserved end to end)

```
1. Deep link /admin/people/12345#send  (expired session)
2. middleware refreshes the token (§8.3); still no user
      ⇒ request proceeds, x-pathname stamped = /admin/people/12345#send   (§8.4)
3. (protected)/layout.tsx: requireAdminPage(...) sees no ctx
      ⇒ redirect('/admin/login?next=' + encodeURIComponent('/admin/people/12345'))   (real path, not /admin)
4. /admin/login reads ?next, sanitizes via safeRedirectPath
      One Tap path:  signInWithIdToken → on success router.push(safeNext)
      Redirect path: signInWithOAuthBrowser('google', safeNext) → sets auth_next cookie
5. /auth/callback (unchanged): reads auth_next → ?next → safeRedirectPath → 302 to /admin/people/12345
6. Broker lands ONE tap from Send.
```

Net: **1 redirect + 1 sign-in tap**, lands on the lead. (Was 4 redirects, 2
actions, wrong page.) `#send` is a fragment; the person-workspace spec (03) owns
scrolling to the Send region on arrival.

### 7.3 The three fixes

1. **`(protected)/layout.tsx`** (and `requireAdminPage`): redirect target becomes
   `/admin/login?next=<real path from x-pathname>`, **not** `/auth-error?next=/admin`.
   `/auth-error` is reserved for genuine OAuth token-exchange failures (still used
   by the callback, `callback:114,188`); a routine session expiry no longer shows
   the alarming "Sign-in issue" copy with developer Supabase-setup instructions
   (`auth-error/page.tsx:30-33`).
2. **`app/admin/login/page.tsx` + `AdminLoginForm.tsx`:** read `?next=` from the
   URL (server: `searchParams`; passed to the client form). Replace the hardcoded
   `ADMIN_NEXT='/admin'`:
   - One Tap (`signInWithIdToken`, client-side, **does not** hit `/auth/callback`):
     on success `router.push(safeRedirectPath(next, '/admin/today'))` — client-side
     sanitize (mirror of `safeRedirectPath`, safe subset in `lib/auth/safeRedirect`
     is server-only; add a client-safe variant or pass the already-sanitized value
     from the server page).
   - Redirect fallback (`signInWithOAuthBrowser`): pass `next` so `getSignInUrl`
     sets the `auth_next` cookie (`auth.ts:75`) and the callback consumes it.
3. **`/admin` index:** drop `getSetupComplete()` from the hot path (§3.7); redirect
   to `/admin/today` (or straight to `next` when present).

### 7.4 `/admin/access-denied` — role-aware copy

Rewrite (`access-denied/page.tsx`) to distinguish the two arrivals, using the
`?cap=<capability>` param `requireAdminPage` now passes:

- **Not an admin at all** (no `?cap`): "You're signed in, but this account doesn't
  have admin access." + Sign out / switch account.
- **Admin lacking this capability** (`?cap` present — rare, only hand-typed URLs):
  "Your account can't open <section>." + **Back to Today** + Sign out. No dead-end,
  a real way back (contrast today's "Go home"/"Switch account" only).

Stays outside `(protected)` to avoid the redirect loop (kept, `access-denied/
page.tsx:3-6`).

### 7.5 States & edge cases

| Case | Behavior |
|---|---|
| `next` is an open-redirect payload (`//evil.com`, `javascript:`) | `safeRedirectPath` collapses/rejects it → falls back to `/admin/today`. Guarded by `ci:auth-redirect`. |
| `next` points to a capability the caller lacks | Sign-in succeeds, land on the deep link, `requireAdminPage` there redirects to `/admin/access-denied?cap=…` — honest, not a silent bounce to dashboard. |
| `next` fragment (`#send`) | Fragments aren't sent to the server; preserved through the client `router.push` on the One Tap path; on the redirect path the fragment is lost at `/auth/callback` (server can't see it) — the person page re-derives the Send scroll from a `?panel=send` query param the deep-link also carries (spec 03 contract). |
| One Tap unavailable (FedCM off) | Falls back to the redirect button (kept, `AdminLoginForm.tsx:163-171`); `next` still flows via the cookie. |
| Non-admin Google account signs in | Session created, `requireAdminPage` → `/admin/access-denied` (no `?cap`) with the "not an admin" copy. |
| `next` cookie + `?next=` disagree | Callback prefers the cookie (`callback:102-103`, set at sign-in initiation) — the intended destination, not a stale query param. |
| Expired session during a long (30–60s) build (e.g. CMA) | The build runs server-side under the action's own auth snapshot; if the *action* re-auths mid-flight it returns the typed session-expired error and the optimistic row offers Retry (idempotent replay). |

### 7.6 Acceptance criteria

- [ ] Tapping `/admin/people/12345?panel=send` with an expired session, then
  signing in, **lands on `/admin/people/12345` with the Send panel open** — not the
  dashboard. ≤1 redirect + 1 sign-in tap.
- [ ] `ci:auth-redirect` stays green (every `next` through `safeRedirectPath`).
- [ ] `/admin/access-denied?cap=content.manage` shows section-specific copy + a
  Back-to-Today link.

---

## 8. FEATURE — Middleware session-refresh, admin-chrome kill, geo exemption

### 8.1 Purpose

The single most likely root cause of "the admin is slow and randomly logs me out"
(`shell-ia.md §4.4`): `lib/supabase/server.ts:16-24` swallows `setAll` ("Ignore in
Server Components" — Next forbids cookie writes during RSC render), and middleware
never touches Supabase (`middleware.ts` — zero supabase imports). So when GoTrue
rotates an expired access token during an RSC `getUser()`, **the refreshed token
is thrown away**; every subsequent RSC render re-refreshes (a full GoTrue round
trip) and concurrent refreshes flirt with refresh-token-reuse detection → random
sign-outs.

### 8.2 The fix: `updateSession` in middleware (the canonical `@supabase/ssr` pattern)

Middleware is the **only** request-scope point where rotated cookies can be
persisted for page navigations (cookie writes otherwise happen only inside server
actions / route handlers, `shell-ia.md §4.4`). Add a Supabase session step to the
existing `middleware.ts` (which already runs on `/admin`, matcher
`middleware.ts:522-525`), placed after host-canonicalization/legacy-redirects
(so OAuth still lands on the canonical host, `middleware.ts:384`) and before the
bot screen:

```ts
// lib/supabase/middleware.ts  (new)
export async function updateAdminSession(request: NextRequest, response: NextResponse) {
  if (!request.nextUrl.pathname.startsWith('/admin')) return       // scope to admin
  if (isAdminAuthPublicPath(request.nextUrl.pathname)) return       // /admin/login|setup|access-denied
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => toSet.forEach(({name,value,options}) => {
        request.cookies.set(name, value)          // for downstream reads this request
        response.cookies.set(name, value, options) // PERSIST rotated token for navigations
      }),
    },
  })
  await supabase.auth.getUser()   // triggers refresh; setAll now actually persists
}
```

- The RSC `setAll` swallow in `lib/supabase/server.ts` **stays** (RSC still can't
  write cookies) — but it no longer matters, because the refresh already happened
  and persisted in middleware, so the RSC read sees a fresh token.
- Middleware does **not** resolve role/capability (no service-role read at the
  edge, no double auth source) — it only refreshes the session and (when there is
  *no* user on an `/admin` path) may short-circuit to `/admin/login?next=<path>`.
  Role/capability stays in-body (§4). This keeps ONE auth source of truth.

### 8.3 Geo-block exemption (traveling-broker lockout)

`screenBotRequest` 403s page routes from `CN, HK, RU, SG` with a bare "Forbidden"
and no admin exemption (`middleware.ts:194-215,169`, `shell-ia.md §2.1`) — a broker
traveling in Singapore is locked out of the entire admin. Fix: **never geo/bot-
screen `/admin/**`.** Add `pathname.startsWith('/admin')` to the bot-screen skip
set. (Admin is auth-gated already; a bot without a session gets nothing anyway.)

### 8.4 `x-pathname` stamp (enables in-body deep-link preservation + chrome kill)

Middleware stamps the incoming path+search on the forwarded request header
`x-pathname` (cheap, all routes). Consumers:
- `requireAdminPage` / `(protected)/layout.tsx` — build the real `next` for the
  login redirect (§7.2).
- Root `app/layout.tsx` — skip `SiteHeader`/`SiteFooter`/`GTMHead` when
  `x-pathname` starts with `/admin` (§3.7).

### 8.5 States & edge cases

| Case | Behavior |
|---|---|
| Token valid | `getUser()` no-ops (no refresh); negligible cost; no cookie write. |
| Token expired, refresh token valid | Refresh happens once, in middleware; rotated cookies persisted onto the response; RSC reads fresh. No repeated per-render refresh. |
| Refresh token reused/invalid (already rotated in another tab) | `getUser()` returns no user; middleware short-circuits `/admin/**` to `/admin/login?next=…`; no random silent 500. |
| Two concurrent admin tabs refresh at once | The first rotation persists; the second sees the rotated token via the shared cookie jar — the reuse-detection race that caused random sign-outs is gone (single refresh point). |
| Non-admin route | `updateAdminSession` early-returns; unaffected (consumer-site auth unchanged — spec 06). |
| Middleware env missing Supabase keys | `updateAdminSession` guards on env like `lib/supabase/server.ts:6`; on missing keys it no-ops (fail-open to in-body guard, which still fail-closes). |

### 8.6 Acceptance criteria

- [ ] With an access token aged past ~1h, hard-navigating three admin pages
  triggers **one** token refresh (in middleware), not three; the rotated token is
  present in the response `Set-Cookie` (verify via network trace).
- [ ] A request with a `Cf-Ipcountry: SG` header to `/admin/today` is **not**
  403'd by the geo screen.
- [ ] `x-pathname` is present on the RSC request; `SiteHeader` DAL calls do not run
  on `/admin`.

---

## 9. FEATURE — Global command palette / search (destinations + people + deals)

### 9.1 Purpose

C2's "reach any surface fast." Today: `ConsoleCommandPalette` is **mounted twice**
(mobile header `ConsoleShell.tsx:96` + desktop `ConsoleTopNav.tsx:92`), each
registers its own `⌘K` listener, so ⌘K opens **two stacked dialogs**; Escape
dismisses only the top one; the two hold independent query state
(`shell-ia.md §9.2`). Its nav coverage is **4 of 56** destinations with stale
"(brand admin)" labels for a deleted shell (`ConsoleCommandPalette.tsx:27-32`,
§9.3).

### 9.2 What we keep / rebuild / delete

- **Keep:** the cmdk dialog, the debounced scoped lead search
  (`consoleSearchLeads`, `ConsoleCommandPalette.tsx:53-64`), the inline ⌘K hint.
- **Rebuild:** cover **all** capability-visible destinations (from `buildNav`,
  passed to the palette — not a hardcoded list) + people + **deals** (currently
  absent). Deep-links to a person → `/admin/people/[id]`, a deal →
  `/admin/transactions/[id]`.
- **Delete:** the second mount; the stale hardcoded NAV array; the duplicate ⌘K
  listener.

### 9.3 Single instance, real coverage

- Mount **once** at the shell root; the trigger buttons in the top bar / mobile
  header dispatch to it (a shared open-state via context or a single portal), so
  **one** `⌘K` listener toggles **one** dialog.
- Results, grouped: **Go to** (capability-filtered destinations + children,
  matched client-side from the same `navSections`), **People** (scoped server
  search), **Deals** (scoped server search — new). Lead/deal scope respects the
  caller's broker clamp (own book vs all) via the existing scoped action.

### 9.4 States & edge cases

| Case | Behavior |
|---|---|
| ⌘K pressed | Exactly one dialog opens; Escape closes it fully. |
| Query < 2 chars | Only destination matches show (kept threshold, `ConsoleCommandPalette.tsx:55`). |
| Stale async result (fast typing) | Sequence guard drops out-of-order responses (kept `seq` ref, `ConsoleCommandPalette.tsx:56-60`). |
| No matches | "No matches." (kept `CommandEmpty`). |
| report_viewer opens palette | Only their capability-visible destinations + (no people/deals if they lack `people.view`) appear — the palette never offers a destination the guard would deny. |
| Raw phone / unknown token typed | People search returns contacts by name/phone; a non-matching token yields no people group (no crash). |

### 9.5 Acceptance criteria

- [ ] One ⌘K listener document-wide (grep: single `keydown` registration for the
  palette); ⌘K opens one dialog; Escape closes it.
- [ ] Every capability-visible destination is reachable via the palette; zero
  "(brand admin)" labels.
- [ ] A person and a deal are each reachable by name in ≤ typing + Enter.

---

## 10. FEATURE — `ci:admin-authz` mechanical gate (enforcement over prose)

### 10.1 Purpose

RC5 regressed ≥4 times because "gate the nav item to match the layout" was a
*comment*, not a *gate* (`shell-ia.md §6`). Per CLAUDE.md "gates not prose", the
invariant is made mechanical. New script `scripts/check-admin-authz.mjs`, wired
into `ci:gates` (the chain at `package.json:166`), modeled on the existing
`check-admin-role-guard.mjs` / `check-admin-endpoint-auth.mjs`.

### 10.2 What it asserts (all statically, no DB)

1. **Every mutating server action guards.** For each exported async function in
   `app/actions/**` that performs a write (calls `.insert(`/`.update(`/`.upsert(`/
   `.delete(` or a known mutating lib), the function body must call a
   `requireAdmin*` guard (or the allowlisted `isAuthorizedAdminOrCron`). Fail lists
   the unguarded function. (Extends `check-admin-endpoint-auth.mjs`'s GUARDED
   allowlist to the full action surface.)
2. **Every gated admin page guards with a capability constant.** Each
   `app/admin/(protected)/**/page.tsx` calls `requireAdminPage(<Capability>)` with
   `<Capability>` imported from `lib/admin/capabilities.ts` (no string literals).
3. **Nav↔page capability parity (the dead-end killer).** For every
   `NavDestination`/`NavChild` in `lib/admin/nav.ts`, the page at its `href`
   guards on the **same** `Capability` symbol. A mismatch (nav shows `X`, page
   guards `Y`) fails — this is the mechanical version of the missing check that let
   the 6 dead-end classes regress.
4. **No orphan live admin route.** Every live `page.tsx` under
   `app/admin/(protected)/**` is either a destination, a child, or on the
   documented DELETE/redirect list (§13). Extends `ci:nav-reachability` to admin.
5. **Every `Capability` in the enum is referenced** by at least one destination or
   page (no dead capabilities).

### 10.3 Acceptance criteria

- [ ] Removing a `requireAdminPage` call from any gated page fails
  `ci:admin-authz`.
- [ ] Changing a nav destination's capability without changing its page's guard
  fails the gate.
- [ ] Adding a live admin route not in `DESTINATIONS`/children/DELETE-list fails.
- [ ] The gate is listed in `ci:gates` and `ci:gates-wired` sees it (no orphan).

---

## 11. FEATURE — Notification → action deep-link routing (C2 top edge)

### 11.1 Purpose

C2's loop starts with "the broker is notified (phone, right now)" and must land
"one tap from Send" (architecture §5, §6). The shell owns the *routing* half: an
admin-facing alert ("New lead · wants a CMA") links to a canonical deep-link that
survives auth (§7) and lands in the PERSON workspace scrolled to Send.

### 11.2 The contract

- Alerts (SMS/push/email to the broker) link to
  `/admin/people/[id]?panel=send` (query param, server-visible — survives the
  redirect-path callback where a `#fragment` would not, §7.5).
- The shell's routing guarantees: expired session → preserved `next` → land on the
  exact URL (§7). The person page (spec 03) reads `?panel=send` and opens Send.
- The alert *content/sending* is owned by spec 02/03; the shell owns the URL shape,
  the auth preservation, and the access-denied honesty if the notified broker lacks
  the capability.

### 11.3 Edge cases

| Case | Behavior |
|---|---|
| Notified broker lacks `people.view` for that contact (scope) | Lands, `requireAdminPage('people.view')` passes but the scope clamp shows "not in your book" — honest, not a blank dead-end. (Routing should not notify a broker for a contact outside their book; if it does, this is the safety net.) |
| Person deleted/merged between alert and tap | `/admin/people/[id]` resolves the merge redirect (spec 03) or shows "this contact was merged into <name>" with a link. |
| Alert link opened on desktop | Same URL, same panel-open behavior (one tree). |

### 11.4 Acceptance criteria

- [ ] An alert link to `/admin/people/[id]?panel=send` lands (after any needed
  sign-in) on that person with Send open, on phone and desktop.

---

## 12. Dead / stale artifacts this spec deletes (RC4/RC6 cleanup)

From `shell-ia.md §12`, all removed (not merely fixed):

- The 8-way nav plurality → 1 declarative source (§5).
- The two-pass `buildAdminNav` regroup (`admin-nav.ts:161-211`).
- Double-mounted `ConsoleCommandPalette` + duplicate ⌘K listener (§9).
- Hardcoded 5-tab `CrmMobileTabBar` as a separate source (`CrmMobileTabBar.tsx:29`).
- Dead inbox-unread badge (wired or omitted, §3.4).
- Stale "(brand admin)" palette labels; "sticky left rail" docblock;
  `check-admin-mobile-shell.mjs:37` "desktop rail" text.
- The 8 copy-paste gate layouts (authz moves in-body; tab-bar-only layouts kept).
- 17 redirect stubs (§13 folds them into destinations or DELETE).
- `report_viewer→reports→superuser-wall` vestigial path (`reports/layout.tsx`
  report_viewer branch).
- Per-component pathname-regex FAB suppression (→ one layout contract, §3.5).
- `getHelpArticleIndex` per-request disk parse (→ build-time JSON, §3.7).
- `/admin` per-visit `getSetupComplete()` (§3.7).
- Hidden `SiteHeader`/`SiteFooter`/`GTMHead` on admin (→ server-null, §3.7).

---

## 13. The final 8-destination IA — every current route mapped

**Legend:** KEEP@ = lands inside this destination (route may be renamed by the
owning spec; ownership noted). REDIRECT = 301/308 stub kept only for old
bookmarks/deep-links. DELETE = removed (dead/duplicate/placebo).

### 13.1 → TODAY (`/admin/today`, `today.view`)

| Current route | Disposition |
|---|---|
| `/admin/broker-dashboard` | KEEP@ TODAY (canonical; spec 04 owns the triage content) |
| `/admin` (index) | REDIRECT → `/admin/today` (drop `getSetupComplete`, §3.7) |
| `/admin/console/page.tsx` (stub → broker-dashboard) | DELETE (redundant stub) |
| `/admin/analytics/action-required` ("Hot leads") | KEEP@ TODAY as a section (triage), not a superuser-only analytics page |

### 13.2 → INBOX (`/admin/inbox`, `inbox.view`) — spec 02

| Current route | Disposition |
|---|---|
| `/admin/crm/inbox` | KEEP@ INBOX (canonical route `/admin/inbox`; REDIRECT old path) |
| `/admin/console/leads` (stub → crm) | DELETE |

### 13.3 → PEOPLE (`/admin/people`, `people.view`) + PERSON (`/admin/people/[id]`) — spec 03

| Current route | Disposition |
|---|---|
| `/admin/crm` (contacts list) | KEEP@ PEOPLE (canonical `/admin/people`; REDIRECT `/admin/crm`) |
| `/admin/crm/[id]` (lead detail) | KEEP@ PERSON (`/admin/people/[id]`; REDIRECT) |
| `/admin/crm/deals` (pipeline board) | KEEP@ PEOPLE (board tab) |
| `/admin/crm/activity` | KEEP@ PEOPLE (activity tab/section) |
| `/admin/crm/new` | KEEP@ PEOPLE ("New contact" action; `people.edit`) |
| `/admin/crm/tasks`, `/admin/crm/calendar` | KEEP@ PEOPLE/TODAY (tasks surface; spec 03) |
| `/admin/crm/approvals` (enrollment) | KEEP@ TODAY approvals stream (spec 04) |
| `/admin/crm/workflows` (enrollment board, nav-invisible today) | KEEP@ SETTINGS→Automations (spec 03/07) — now reachable |
| `/admin/crm/sequences` ("Workflows" nav) | KEEP@ SETTINGS→Automations |
| `/admin/crm/reporting` | KEEP@ PERFORMANCE (spec 04) |
| `/admin/cmas`, `/admin/bpo` | KEEP@ PERSON send loop (deliverables; `send.deliverable`) — the 6 CMA entry points collapse to one (spec 03) |
| `/admin/expireds`, `/admin/expired-outreach`, `/admin/fsbos` | KEEP@ PEOPLE prospecting section (spec 03) — **fixes the broker dead-end** (row links no longer hit a superuser-only `expired-listings/layout.tsx`) |
| `/admin/expired-listings/[key]` (detail) | KEEP@ PEOPLE prospecting (guard `people.view`, not superuser — the audited dead-end, `shell-ia.md §6.2`) |
| `/admin/expired-listings` (index stub) | DELETE |
| `/admin/people/[legacyId]` (FUB legacy shim) | KEEP as REDIRECT shim (resolves old FUB ids) |
| `/admin/people` (current stub → crm) | becomes the canonical PEOPLE route |
| `/admin/console/leads/[id]` (stub) | KEEP as REDIRECT (load-bearing for old SMS/FUB deep-links, `console/leads/[id]/page.tsx:4-11`) until spec 03 confirms no inbound references, then DELETE |

### 13.4 → TRANSACTIONS (`/admin/transactions`, `transactions.view`) — spec 05

| Current route | Disposition |
|---|---|
| `/admin/deals` | KEEP@ TRANSACTIONS (canonical; REDIRECT) |
| `/admin/signing` | KEEP@ TRANSACTIONS→Signing (`transactions.edit`) |
| `/admin/commissions` | KEEP@ TRANSACTIONS→Commissions (`commissions.view`) |
| `/admin/financials` | KEEP@ TRANSACTIONS→Financials (`financials.view`, superuser) |
| `/admin/forms` | KEEP@ TRANSACTIONS→Forms |
| `/admin/sign-off` | KEEP@ TRANSACTIONS→Sign-off (`transactions.signoff`, superuser) |

### 13.5 → PERFORMANCE (`/admin/performance`, `performance.view`) — spec 04

| Current route | Disposition |
|---|---|
| `/admin/analytics` (+11 sub) | KEEP@ PERFORMANCE (one hub; the 11 children become tabs/sections, spec 04) |
| `/admin/reports` (index stub → analytics) + 7 sub-reports | KEEP@ PERFORMANCE; DELETE the stub; the 7 sub-reports fold into the hub (RC4 — "Performance hub AND its 10 children as flat siblings", `shell-ia.md §5.1`) |
| `/admin/crm/reporting` (FUB-parity hub) | KEEP@ PERFORMANCE (CRM metrics tab) |
| `/admin/visitors` (index stub), `/admin/visitors/live` | KEEP@ PERFORMANCE→Live visitors; DELETE the index stub |
| `/admin/operations/optimization` | KEEP@ PERFORMANCE (optimization tab) |

### 13.6 → CONTENT (`/admin/content`, `content.view`; children `content.manage`) — spec 07/08

| Current route | Disposition |
|---|---|
| `/admin/listings` (+`[listingKey]`) | KEEP@ CONTENT→Listings (`content.manage`, superuser — **fixes the "broker clicks Listings → access denied" dead-end** by not showing it, `shell-ia.md §6.1`) |
| `/admin/site-pages` | KEEP@ CONTENT→Site pages |
| `/admin/media` (+ photos/banners/stock tabs) | KEEP@ CONTENT→Media (tabs kept via `AdminLinkTabs`) |
| `/admin/blog` | KEEP@ CONTENT→Blog |
| `/admin/geo` (+2) | KEEP@ CONTENT→Geography |
| `/admin/guides` (nav-invisible today, `shell-ia.md §1.4`) | KEEP@ CONTENT→Guides (now reachable) |
| `/admin/banners`, `/admin/stock-photos`, `/admin/photos` (stubs) | DELETE (media tabs) |
| `/admin/resort-communities` (stub) | DELETE (geo tab) |
| `/admin/newsletters` (+3 sub), `/admin/email/campaigns`, `/admin/email/compose` | KEEP@ CONTENT or PEOPLE send loop per spec 02/03 (compose → PERSON; campaigns/newsletters → CONTENT marketing); `/admin/email` index stub DELETE |
| `/admin/broker-links` (ad links) | KEEP@ CONTENT (marketing) or SETTINGS per spec 04 |
| `/admin/approval-queue` (marketing approvals) | KEEP@ TODAY approvals stream (one queue, typed sub-streams — architecture §4.7; collapses the 3 approval surfaces) |

### 13.7 → SETTINGS (`/admin/settings`, `settings.view`; children per-cap)

| Current route | Disposition |
|---|---|
| `/admin/settings` ("My settings", + `MobileSettingsScreen`) | KEEP@ SETTINGS→My account (ONE responsive component — delete the `MySettingsForm`/`MobileSettingsScreen` fork, `shell-ia.md §10`) |
| `/admin/crm/settings` (+19 sub) | KEEP@ SETTINGS (the 19 cards become capability-gated sections: routing, templates, automations, suppression, team; `settings.*`) |
| `/admin/brokers` (+2) | KEEP@ SETTINGS→Brokers (`settings.team`); "My profile" for a broker resolves to their own row, not a dead-end (`shell-ia.md §6.6`) |
| `/admin/users` (site-signup viewer) | KEEP@ SETTINGS→Site users (`settings.team`); also fix the 60-round-trip counter (`admin-roles.ts:145-191`, `listPlatformUsersForAdmin` → `GROUP BY` aggregate) |
| `/admin/audit-log` | KEEP@ SETTINGS→Audit log (`audit.view`) |
| `/admin/sync` (+spark) | KEEP@ SETTINGS→System health (`settings.*`/superuser; tabs kept) |
| `/admin/operations` (+optimization) | KEEP@ SETTINGS→System (command center) / PERFORMANCE (optimization) |
| `/admin/crm/health` | KEEP@ SETTINGS→System health |
| `/admin/crm/import` | KEEP@ SETTINGS or PEOPLE ("Import contacts", `people.import`, superuser — **fixes the dead-end**, `shell-ia.md §6.3`) |
| `/admin/crm/settings/team` | KEEP@ SETTINGS→Brokers/Team |
| `/admin/crm/subscriptions`, `/admin/crm/settings/templates` | KEEP@ SETTINGS→Templates / PEOPLE per spec 03 |

### 13.8 Auth / utility routes (outside the 8, kept)

| Route | Disposition |
|---|---|
| `/admin/login` | KEEP (reads `?next`, §7) |
| `/admin/setup` | KEEP (one-time; setup-complete check cached off the hot path) |
| `/admin/access-denied` | KEEP (role-aware copy, §7.4) |
| `/admin/help` (+`[slug]`) | KEEP (Help FAB; help index build-time, §3.7) |
| `/admin/layout.tsx` (no-op passthrough) | KEEP (scopes login/setup/access-denied without auth) |
| `/admin/(protected)/layout.tsx` | KEEP (THE shell host; funnel + chrome fixes) |
| `/admin/optimization`, `/admin/query-builder`, `/admin/search`, `/admin/spark-status` (stubs) | DELETE (folded into destinations) |
| `/admin/crm/automations` (stub → sequences) | DELETE (FUB-parity URL, nothing links it) |

**Result:** 8 destinations (was 56 items / 8 nav systems). 17 redirect stubs →
≤5 load-bearing redirects (legacy FUB/SMS deep-links) + the rest DELETED. Every
live route is a destination, a child, a kept redirect, or deleted — enforced by
`ci:admin-authz` #4 (§10).

---

## 14. Cross-cutting states matrix (the shell as a whole)

| State | Shell behavior |
|---|---|
| **Empty** | New admin, no data: chrome renders; destinations show; each page owns its own empty state. |
| **Loading (streamed)** | Chrome instant from cached auth ctx; page body suspends per-region (§3.6). |
| **Populated** | Capability-correct nav; active highlight; unread badge iff writer exists. |
| **Pending/optimistic** | Only shell mutation is sign-out (optimistic "Signing out…", §6.3). |
| **Success** | Navigation is client-side; no full-page refresh (`router.refresh()` tax removed per §4.2 architecture — shell never calls it). |
| **Partial** | Inbox badge omitted if count DAL absent (no placebo). |
| **Error** | Auth-resolve error → treat as unauthenticated → login funnel; page errors owned per page. |
| **Offline** | Hydrated shell client-routes cached destinations; hard-nav → browser offline; mutations surface optimistic-fail. |
| **Permission-denied** | Structurally rare; honest access-denied with a way back (§7.4). |
| **Over-limit** | N/A (shell unthrottled; `/api/*` rate limit unchanged, `middleware.ts:477`). |
| **Session expired** | Middleware refresh (§8) or, if unrecoverable, preserved-`next` login (§7). |

---

## 15. Performance budget (shell-attributable, per navigation)

Targets vs the audit's measured costs (`shell-ia.md §11`):

| Cost | Today | Target |
|---|---|---|
| GoTrue `getUser()` | serial before every render | kept (cached), + one middleware refresh replacing N per-render refreshes |
| Un-persistable token refresh | every RSC render past ~1h | **eliminated** (§8) |
| `admin_roles` service query | every request (non-Matt) | kept (React-cached per request) |
| Hidden `SiteHeader` + 4 DAL + footer | every hard load | **eliminated** on `/admin` (§3.7) |
| 12 help markdown reads | every request | **eliminated** (build-time JSON, §3.7) |
| `getSetupComplete` on `/admin` | every home hit | **eliminated** (§3.7) |
| Dual mobile+desktop trees | settings/CRM surfaces | **eliminated** for shell (one tree, §3) |
| Redirect-stub double-nav | 17 stubs | ≤5 load-bearing redirects (§13) |
| `force-dynamic` everywhere | 123/150 | shell/layout stay dynamic (auth); pages drop blanket force-dynamic where cacheable (per-page, cross-spec) |

---

## 16. Cross-spec dependencies (seams this spec defines, others build)

- **Spec 02 (Inbox/conversation):** owns `getInboxUnreadCount()` (the badge writer,
  §3.4) and the INBOX destination page guarding `inbox.view`/`inbox.send`.
- **Spec 03 (People/Person + send loop):** owns PEOPLE/PERSON pages guarding
  `people.view`/`people.edit`/`send.deliverable`; the `?panel=send` deep-link
  contract (§11); the CMA/BPO collapse; the merge-redirect shim.
- **Spec 04 (Metric layer):** owns PERFORMANCE guarding `performance.view`; the
  TODAY triage content; the one-definition-per-number rule (a metric with no writer
  is never rendered — same no-placebo doctrine as the inbox badge here).
- **Spec 05 (Transactions):** owns TRANSACTIONS children guarding
  `transactions.*`/`commissions.view`/`financials.view`.
- **Spec 06 (Consumer funnel):** owns the *public-site* account menu; this spec
  owns only the *admin* account menu — the two are distinct components on distinct
  chrome (admin chrome is server-null on the site and vice-versa, §3.7).
- **Spec 07/08 (Content/site):** own CONTENT children guarding `content.manage`;
  the RC5 security fix (in-body `content.manage` on every public-site writer) uses
  this spec's `requireAdminAction('content.manage')`.

Every one of those specs imports its `Capability` constants and `requireAdmin*`
guards from this spec's `lib/admin/capabilities.ts` + `lib/admin/require-admin.ts`.

---

## 17. Open questions for Matt (real decisions, not defaults)

- **OQ-1 — Keep or delete `report_viewer`?** It has **zero rows** in `admin_roles`
  (`admin-nav.ts:92`, `shell-ia.md §4.1`). The new metric layer (spec 04) makes a
  clean read-only "numbers only" role meaningful (e.g. an assistant or an
  accountant who should see Performance but touch nothing). Default in this spec:
  **keep it, wired to `today.view` + `performance.view` + `settings.account`
  only** (a real, non-dead-end role). If you'd rather have exactly two roles
  (superuser + broker) for simplicity (C1), say so and I delete it from the enum
  and the type.
- **OQ-2 — Do brokers see PERFORMANCE?** Today brokers get **0** Reports items
  (`shell-ia.md §5.1`). The loop (C2) says "outcome measured" — a broker arguably
  should see *their own* leads/conversion, but not marketing spend/CPL/SEO. Default:
  brokers do **not** get the `performance.view` marketing hub; their own outcomes
  surface inside PEOPLE/PERSON (spec 03/04). Confirm, or grant brokers a scoped
  `performance.view` (own-book metrics only).
- **OQ-3 — 4th-broker onboarding.** Adding a broker today needs an `admin_roles`
  row + a `brokers` row + **code edits** to 5 hardcoded maps (`CRM_BROKER_BY_EMAIL`,
  `FUB_USER_ID_BY_BROKER`, `CRM_BROKER_DISPLAY`, `BROKER_HEADSHOT`,
  `BROKER_HEADSHOTS`, `shell-ia.md §4.1`). Should this rebuild move broker identity
  fully into the `brokers` table (data, not code) so onboarding is one settings
  screen? It touches spec 03/07's CRM constants, so it's a scope call, not a
  default I should silently make.
- **OQ-4 — Bottom tab bar order/content on phone.** The first 5 capability
  destinations become the tab bar (§3.4). For a broker that's Today · Inbox ·
  People · Transactions · Settings. Is that the right 5, or should the FAB's
  "New" or a Tasks tab replace one? (FUB uses Home/Inbox/People/Deals/Activity —
  the audit notes the current bar deliberately lights nothing on calendar/tasks,
  `CrmMobileTabBar.tsx:43-44`.)
- **OQ-5 — Geo-block on admin.** §8.3 removes the CN/HK/RU/SG page-block for
  `/admin/**` entirely (a traveling broker is locked out today). Confirm you're
  fine with admin being reachable from those regions when authenticated (it's
  auth-gated regardless), or you want an explicit allowlist instead of a blanket
  exemption.

---

*End Spec 01. Build order (architecture §7): this spec is Foundation, shipped
first — the auth primitive + capability map + nav generation + responsive shell +
middleware session-refresh + admin-chrome kill, each independently shippable and
observable, before the conversation model (spec 02) lands on top.*
