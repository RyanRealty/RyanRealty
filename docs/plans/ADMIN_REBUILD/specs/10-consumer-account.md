# Spec 10 — Consumer Account · Save-Home/Search Funnel · Buyer-Signal → CRM

> **Status:** ready to build. Derived from `00-REASONING-AND-ARCHITECTURE.md` (locked) and
> `audit-reports/consumer-account.md` (evidence base). Every "keep/kill" cites the audit; every
> schema/lib fact was re-verified against the live tree at `d3dd457a`.

This spec owns **the consumer half of the loop's top edge** (C2): the anonymous visitor who saves a
home or a search, becomes a known account, and — critically — becomes a **buyer-intent signal that
reaches the broker's response loop**. It is the domain the architecture names as RC7: *"the consumer
funnel is severed at every seam"* (`00-…§2 RC7`). The owner's verbatim complaint — *"when a user logs
in and tries to save searches/homes it's confusing"* — collapses to three broken seams the audit
proves with `file:line` evidence: no account door in the chrome, a save→sign-in→resume loop that never
replays the save, and seven parallel "I care about this home" stores that disagree.

The one healthy spine in this domain — the unified `listing_alerts` pipeline (guest + signed-in +
broker rows in one table, hourly cron with seen-set diff and compliance gates, read by both the
account page and the broker CRM) — is **kept intact and made the model everything else follows**
(`consumer-account.md §0.7, §4`).

---

## 0. What this spec owns vs depends on

**Owns (this spec is the source of truth):**
- The **ONE session-aware account menu** in the site chrome + sign-out (replaces the orphaned
  `AuthDropdown`, which has zero importers — `consumer-account.md §3.3, §7`).
- The **ONE save → sign-in → resume flow** that actually replays the intended save across every entry
  point (fixes the 3 dead return-URL conventions — `consumer-account.md §3.2`).
- **Store consolidation** — collapse the 7 "homes I care about" stores to `listing_alerts` (searches)
  + one canonically-keyed `saved_listings` (homes) + `saved_cities`/`saved_communities` (places);
  retire `likes`, the `saved_searches` public-mirror zombie, `community_likes`, and the dead
  `user_activities` read (`consumer-account.md §1, §6, §7`).
- The **buyer-signal → CRM seam (§4.8)** — a writer + a DAL reader that put saved homes (and the
  already-flowing saved searches) in front of the broker as intent signal.
- **Placebo removal / wiring** — dead viewing-history, 5 placebo notification toggles, the
  password-signin path that skips guest-alert claim + `rr_pid` stamp (`consumer-account.md §2.6, §2.7,
  §3.5`).
- The **responsive `/account/**` pages** and the **`/account` vs `/dashboard` route map**.

**Depends on (owned by sibling specs — this spec conforms and consumes):**
- **§4.2 optimistic/idempotent mutation primitive** → Spec 01 (Foundation). The consumer save toggles
  use the `useOptimistic`/`useTransition` client primitive and the "return the changed entity, don't
  `revalidatePath` the whole page" server contract authored there.
- **§4.8 CRM buyer-signal spine** → the broker-side rendering of the intent signal lands in the
  **Person Workspace / Contact-360** (Spec 03 person-workspace-send). This spec **provides the DAL
  reader** (`getContactSavedHomes`) and the **writer** (native-lead + timeline on save); Spec 03/04
  own where it renders on the broker side. The pattern is exactly today's `getContactListingAlerts`
  (`lib/data/crm/getContactListingAlerts.ts:189`), which this spec keeps unchanged.
- **§4.5 metric layer** → Spec 06 (Performance). Any consumer-derived count a broker sees (e.g. "3
  saved homes") resolves through a single reader; no hand-rolled counts on a dashboard.
- **Native-lead capture** (`sendEvent` → `ensureNativeLead`, `canonicallyTagLead`) → owned by the CRM
  ingest layer; this spec calls it exactly as `createSavedSearch` already does
  (`app/actions/saved-searches.ts:154-189`).

---

## 1. Conformance map (constraint / root cause → decision)

| Constraint / Root cause | How this spec discharges it |
|---|---|
| **C1** right size is small | 7 interest stores → 3; 4 auth UIs → 1 menu + 1 login page; 2 account shells → 1; delete the `/dashboard` namespace. |
| **C2** the job is a loop | Saved homes/searches become **broker-visible intent signal** feeding the response half (the seam RC7 severs). |
| **C3** phone is the primary surface | ONE responsive account tree; the account menu + save affordances work identically on phone (they are the visitor's primary device). |
| **C4** every number is compliance | No fabricated counts: kill `result_count: null` "0" states, the dead "Recently viewed" zero card, the `$0`-shaped placebos; a count renders only when it traces to a live writer. |
| **C5** messages carry money/legal | The kept `listing_alerts` cron stays suppression-fail-closed, quiet-hours-gated, RFC 8058 one-click. No new consumer send path bypasses it. |
| **RC1** no conversation entity | Not this domain's data model; the CRM-side signal is written as typed `crm_timeline` rows + a native lead, not a message. |
| **RC2** no optimistic/idempotent layer | Every save toggle renders optimistically and is **idempotent by construction** (unique keys; a duplicate save is a no-op, not a duplicate row). |
| **RC5** auth truth scattered | ONE post-auth routine (`onAuthenticated`) runs for OAuth, magic-link, recovery, password sign-in **and** password sign-up confirmation — no path skips claim/stamp/replay. |
| **RC6** placebo surfaces | Viewing-history wired to a real writer (or deleted); 5 placebo toggles deleted; the "public search" void-writer deleted; the dead `share_token` deleted. |
| **RC7** severed funnel | Account menu (the door), save→resume (the loop), store consolidation (one truth), intent→CRM (the seam). |

---

## 2. Keep / Rebuild / Delete (explicit, audit-cited)

### KEEP — the correct engine (never discard)
| Item | File | Evidence |
|---|---|---|
| **`listing_alerts` unified pipeline** | `lib/data/leads/listingAlerts.ts` (all exports) | The one healthy spine: keyed `(email, filters_hash)`, resurrection guard, unsubscribe token, `claimListingAlertsForUser` idempotent + verified-email-gated (`:357-386`). `consumer-account.md §0.7, §4`. |
| **Hourly alert send cron** | `app/actions/saved-search-alerts.ts:142-393`, `vercel.json:128` | Most-overdue-first, 200-send cap, per-row cadence, hard-stop compliance + suppression, `emailEnabled` honor, seen-set diff (`notified_listing_keys`), RFC 8058 one-click, `email_events` measurement. "Best-engineered consumer code in the domain." `consumer-account.md §4`. |
| **Guest capture** | `submitSearchAlertSignup` (`app/actions/search-alert-capture.ts:36-100`) | Honeypot, fail-closed per-IP rate limit, narrowing-filter guard, lead + task + GA4 mirror. `consumer-account.md §4`. |
| **Signed-in create** | `createSavedSearch` (`app/actions/saved-searches.ts:102-192`) | Normalizes + hashes filters, upserts `listing_alerts`, **already fires native CRM lead capture + canonical buyer tag** (`:154-189`) — the template for the saved-home seam (§7). `consumer-account.md §4`. |
| **Session-user alert helpers** | `getListingAlertsForUser` / `updateListingAlertForUser` / `setListingAlertActiveForUser` / `deleteListingAlertForUser` / `setListingAlertFrequencyForUser` (`listingAlerts.ts:394-484`) | Every write carries BOTH `.eq('id')` AND `.eq('user_id')`; the RLS-safe chokepoint. `consumer-account.md §2.3`. |
| **Broker mirror reader** | `getContactListingAlerts` (`lib/data/crm/getContactListingAlerts.ts:189`) | True shared source of truth for alerts; humanized + deep-linked. The **exact pattern** the saved-home reader (§7) copies. `consumer-account.md §4`. |
| **Guest-alert claim** | `claimGuestSearchesForUser` → `claimGuestSavedSearches`/`claimListingAlertsForUser` (`app/auth/callback/route.ts:77-86`) | Idempotent, opt-out-respecting, verified-email gated. Correct — the fix is making the **password paths** call it too (§8.3). |
| **Canonical-key resolver + removal planner** | `resolveCanonicalListingKey` (`lib/data`), `planSavedHomeRemoval`/`normalizeListingKey` (`lib/saved-home-toggle.ts`) | Pure, unit-tested decision logic; the write path already canonicalizes `saved_listings` (`saved-listings.ts:44`). Keep and extend to the merged store. |
| **`SavedSearchControls` UI** | `components/dashboard/SavedSearchControls.tsx:78-91` | Real optimistic dispatch with revert-on-failure + error note; AlertDialog delete. "The best in the domain" — the model the rest of the account UI adopts. `consumer-account.md §2.3`. |
| **`user_buying_preferences`** | `app/actions/buying-preferences.ts` | Works; clamped server-side; feeds payment estimates. Keep. `consumer-account.md §2.8`. |
| **Unsubscribe surfaces** | `/alerts/unsubscribe` page + `/api/alerts/unsubscribe` | POST-confirm (prefetch-safe), single token namespace. Keep. `consumer-account.md §4`. |
| **`/api/auth/me`** | `app/api/auth/me/route.ts` | `private, no-store` session probe; lets the header stay a **cacheable server component** while a client island reads session. The account menu (§4) mounts on this. |
| **`trackUserEvent`** | `app/actions/track-user-event.ts` | Live writer to `user_events` with a `'listing_view'` event type already defined; the target the viewing-history reader repoints to (§8.1). |

### REBUILD
| Item | From → To | Why (audit) |
|---|---|---|
| **Account menu** | orphaned `components/AuthDropdown.tsx` (0 importers, hand-rolled panel) → **`AccountMenu` client island** built from `@/components/ui/dropdown-menu`, mounted in `SiteHeader` + `MobileNav`, session via `/api/auth/me` | header always says "Sign in"; the only signed-in menu ever built is dead. `consumer-account.md §2 crit#2, §3.3, §3.4`. |
| **Save→resume** | 3 return conventions (`?next=` pathname-only, `?returnUrl=` ignored, `/account?signin=1&returnUrl=` unconsumed), none replays the save → **ONE `pending-save` cookie + `replayPendingSave()` in the shared post-auth routine** | "The single highest-intent moment on the site ends on an unrelated page with nothing saved." `consumer-account.md §2 crit#3, §3.2`. |
| **Saved-home store** | union of `saved_listings` (canonical key) + `likes` (raw key) merged at read time, 3 key strategies → **`saved_listings` only, canonically keyed**; `likes` rows backfilled then retired | remove can silently fail across stores; counter drift; two buttons for one intent. `consumer-account.md §2.2, §5.7`. |
| **Viewing history** | reads dead `user_activities` (no writer anywhere) → **reads `user_events WHERE event_type='listing_view'`**, wired by a real writer on the listing page | permanently empty for every user. `consumer-account.md §2.6, §5.1`. |
| **Notification prefs** | 8 controls, 5 placebo → **3 real controls** (`emailEnabled`, saved-search cadence fan-out, market-report subscription); the 5 placebo toggles + their promising empty-state copy removed | 5 of 8 controls have no sender. `consumer-account.md §2.7, §5.6`. |
| **Password auth paths** | `signInWithEmailPassword`/`signUpWithEmailPassword` do only FUB-successor tracking → **call the shared `onAuthenticated` routine** (claim + `rr_pid` stamp + replay), and the callback handles `type='signup'/'email'` confirmations | guest alerts never attach for password users; unhandled confirmation type falls to `/auth-error`. `consumer-account.md §3.5`. |
| **`/account` hub fetch** | ~13+ sequential/parallel round trips, `force-dynamic`, no cache, `getListingsByKeys` double-queries every tile → **identity core + cached DAL + streamed Suspense regions**, single keyspace (no double query) | §4.6; `consumer-account.md §2.1, §9`. |
| **Toggle error handling** | `toggleSavedListing` returns `saved:true` alongside a non-null error; tiles set optimistic state without checking `error` → **return the real post-state; client reverts on error** | phantom saved state. `consumer-account.md §5.11`. |
| **Search-results save parity** | list-view grid cards have no save affordance; map-view tiles do → **one save affordance on every result card**, view-mode agnostic | capability forks by view mode. `consumer-account.md §3.1, §5.15`. |
| **Collections** | read-modify-write race on `listing_keys`; dead `share_token`; 6–7-step fill flow → **DB-side array append (RPC), no share_token, "add to collection" from any tile** | `consumer-account.md §2.5, §5.9, §5.10`. |

### DELETE (this spec's cut list)
| Item | File / evidence | Why |
|---|---|---|
| `components/AuthDropdown.tsx` | 0 importers (`consumer-account.md §7`) | Superseded by `AccountMenu` (§4). |
| `components/listing/{ListingActions,LikeButton,SaveListingButton}.tsx` | 0 importers (`consumer-account.md §5, §7`) | Orphaned like/save UI; one save concept survives. |
| `likes` table **writers** (`toggleLikeListing`, `likeListing`, `unlikeListing`, geo/activity heart affordances) | `app/actions/likes.ts`, `ListingBarCard.tsx:106-113`, `activity/ActivityFeedCard.tsx:131` | Merge into `saved_listings` (§6.2); after backfill the store is retired. |
| `CardActionBar` `like` prop | `components/ui/CardActionBar.tsx:52-58,93-102` | Accepted, never rendered. |
| `community_likes` writer + `toggleCommunityLike` | `app/actions/community-engagement.ts:126`, tile heart affordances | Persists to a store shown nowhere; one "follow" concept (`saved_communities`) survives (§6.3). `consumer-account.md §2.4, §5.22`. |
| `saved_searches` **public-mirror** feature | `getPopularPublicSearches`, `trackPublicSearchClick`, `/api/public-search/click`, `setSavedSearchPublicState`, `refreshSavedSearchCache`, the `isPublic` checkbox in `SaveSearchButton` (`saved-searches.ts:130-146,378-417`) | UI writes into a void; no rendering consumer. `consumer-account.md §5.8, §7`. |
| `user_activities` read path | `app/actions/dashboard-history.ts` (read + delete) | Table has no writer; rebuilt onto `user_events` (§8.1). |
| `listing_collections.share_token` usage | `collections.ts:18-20,31,206-213` | Math.random-generated, no consuming route. `consumer-account.md §5.9`. |
| `profiles.buyer_preferences` field usage | dead schema (only `profile.ts` type references it) | No writer. `consumer-account.md §2.9, §7`. |
| 5 placebo notification toggles | `priceDropAlerts`, `statusChangeAlerts`, `openHouseReminders`, `marketDigestFrequency`, `blogUpdates` (`DashboardNotificationPrefs.tsx`) | No sender. `consumer-account.md §2.7, §5.6`. |
| `/dashboard/**` consumer namespace | `app/dashboard/{layout,page}.tsx` + 8 redirect stubs + `DashboardShell` | Dead shell doing live work around pure redirects (§9.4). `consumer-account.md §2.11`. |
| Empty-state copy promising unsent alerts | `account/page.tsx:151`, `saved-homes/page.tsx:68` | Promises price-drop/status alerts nothing sends. `consumer-account.md §5.6`. |

**Cross-domain (flag, don't own):** `/dashboard/marketing` + `/dashboard/marketing/inbox` are **admin** surfaces squatting in the consumer namespace (`dashboard/marketing/page.tsx:1-20`) — they move under `/admin` in the **Shell/IA spec**; this spec only removes the consumer `/dashboard` wrapper around them. The `resetPasswordForEmail` default-redirect fix (`auth.ts:181` → a non-redirect page) is a one-line change owned here but coordinated with the Foundation auth spec.

---

## 3. Data model

All migrations **additive and back-compatible**. `listing_alerts` (the alert spine) is **unchanged** —
its schema is correct (`DATABASE_SCHEMA_SNAPSHOT.md:2463`). `saved_listings` becomes the single
saved-home store.

### 3.1 `saved_listings` — the one saved-home store (no schema change; a backfill + an index)
`saved_listings` today: `id, user_id, listing_key, created_at, collection_name`
(`DATABASE_SCHEMA_SNAPSHOT.md:792`, rows ≈ 2). It is already canonically keyed on write
(`saved-listings.ts:44`). Two migrations:

```sql
-- 20260717xxxx_saved_listings_unique.sql  (idempotency by construction — RC2/§4.2)
create unique index if not exists saved_listings_user_key_uidx
  on public.saved_listings(user_id, listing_key);

-- 20260717xxxx_backfill_likes_into_saved_listings.sql  (merge the `likes` store)
insert into public.saved_listings (user_id, listing_key, created_at)
select l.user_id,
       coalesce(x.canonical_key, l.listing_key) as listing_key,  -- canonicalize raw like keys
       l.created_at
from public.likes l
left join lateral (
  select "ListingKey" as canonical_key
  from public.listings
  where "ListingKey" = l.listing_key or "ListNumber" = l.listing_key
  limit 1
) x on true
on conflict (user_id, listing_key) do nothing;   -- unique index makes this a safe no-op merge
```
- The unique index makes a duplicate save a **no-op** (`insert … on conflict do nothing`), so
  `saveListing` becomes idempotent — a double-tap can never create a second row (RC2).
- After the backfill ships and is verified, `likes` is a dormant table with no writers; it is dropped
  in a **later** migration once we confirm no read references remain (§13 acceptance).

### 3.2 `crm_timeline` — the buyer-signal rows (no schema change; a new `kind` value)
`crm_timeline` (`DATABASE_SCHEMA_SNAPSHOT.md:2105`) already carries `kind`, `payload`, `dedupe_key`.
The saved-home seam (§7) writes rows with `kind = 'buyer_signal'` and a `dedupe_key` of
`saved-home:{person_id}:{listing_key}` so a save/unsave/re-save of the same home by the same person
never stacks duplicate timeline entries. **No migration** — this is a data convention on the existing
immutable ledger, exactly how message/note/call kinds already coexist.

### 3.3 `user_events` — the viewing-history source (no schema change)
`user_events` (`DATABASE_SCHEMA_SNAPSHOT.md:4027`): `user_id, event_type, event_at, page_path,
listing_key`. `event_type` already supports `'listing_view'` (`track-user-event.ts` `UserEventType`).
Viewing history (§8.1) reads this table; the only new thing is a **writer** that fires
`'listing_view'` with `listing_key` on the listing page (today only `'page_view'` is written, via
`trackVisit`). Additive index:

```sql
-- 20260717xxxx_user_events_history_idx.sql
create index if not exists user_events_user_listingview_idx
  on public.user_events(user_id, event_at desc)
  where event_type = 'listing_view';
```

### 3.4 Retirements (no destructive migration in this spec)
`saved_searches` (public-mirror), `community_likes`, `user_activities` lose their **writers/readers**
in code this release. Their tables are dropped in a **later** dedicated cleanup migration after a
release confirms zero references — never in the same delivery as the code that stops using them
(back-compat rule). This spec's migrations are strictly additive.

---

## 4. Feature — the ONE session-aware account menu + sign-out

### 4.1 Purpose & the job it serves
The account area is *"a destination with no door"* (`consumer-account.md §3.4`). A signed-in visitor
standing on any page cannot reach their saved homes, saved searches, or preferences from the chrome —
the header renders a static "Sign in" on every viewport, and `/login` does not redirect an
already-signed-in user. This is the first seam RC7 severs, and it starves the loop: a returning buyer
can't get back to the thing that makes them a lead. **The job:** one glanceable, tappable door to the
account, present on phone and desktop, that also gives sign-out.

### 4.2 Keep / rebuild / delete
- **Delete** `AuthDropdown.tsx` (0 importers).
- **Rebuild** as `components/site/AccountMenu.tsx` — a client island using `DropdownMenu` from
  `@/components/ui/dropdown-menu` (design-system component, per CLAUDE.md component-mapping rule; the
  old file hand-rolled an absolute panel).
- **Keep** `/api/auth/me` as the session source and `signOut()` (`app/actions/auth.ts:169`) as the
  sign-out action.

### 4.3 Architecture (why a client island, not a server read in the header)
`SiteHeader` is a **cacheable server component** rendered on every page; reading the session in it
forces `Cache-Control: private, no-store` site-wide and kills CDN caching (documented at
`app/api/auth/me/route.ts:6-14`). So the menu is a **small client island** that fetches `/api/auth/me`
once on mount:
- **Signed out** → renders the existing "Sign in" CTA (unchanged link to `/login?next=<current>`),
  plus the "Get listing alerts" / "What's my home worth" CTAs stay as-is.
- **Signed in** → renders an avatar/initial trigger → `DropdownMenu` with: greeting, **My account**
  (`/account`), **Saved homes**, **Saved searches**, **Saved places**, **Buying preferences**,
  separator, **Sign out**.

The island renders a stable "Sign in" placeholder during the fetch (no layout shift), swapping to the
avatar on resolve. Same island is used in `MobileNav` (replacing the buried bottom "Sign in" button,
`MobileNav.tsx:165-170`) — **one component, both viewports** (RC3: no fork).

### 4.4 `/login` redirect for signed-in users
`app/login/page.tsx` gains a server-side session check: if `getSession()` is non-null, `redirect(next
?? '/account')`. A signed-in user who taps a stale "Sign in" never sees the form again
(`consumer-account.md §2 crit#2`).

### 4.5 User flows (phone-first)
**Signed-in, open account (2 taps):** tap avatar (1) → tap "Saved searches" (2) → lands on the manage
page. Today: **impossible from chrome** (URL must be typed).
**Sign out (2 taps):** tap avatar (1) → tap "Sign out" (2) → `signOut()` → hard-nav to `/` → menu
re-renders "Sign in".

### 4.6 States
- **Loading (session unknown):** "Sign in" placeholder, non-interactive avatar suppressed; no CLS.
- **Signed out:** "Sign in" CTA.
- **Signed in:** avatar (photo from `avatar_url`; falls back to first-initial chip).
- **`/api/auth/me` error/timeout:** treat as signed-out (fail-safe to the public CTA); never render a
  broken avatar.
- **Sign-out in flight:** menu item shows a pending "…"; disabled; a second tap is ignored.
- **Sign-out error:** the server action clears the Supabase cookie; on any error the client still
  hard-navigates to `/` (a stale client menu is worse than an extra redirect); the next `/api/auth/me`
  reflects truth.

### 4.7 Edge cases
- **Session expires mid-visit:** the menu was rendered "signed in" from a stale fetch; tapping a
  destination lands on `/account`, whose layout re-gates and bounces to `/login?next=/account/…` — the
  user re-authenticates and (with §5) lands back. No white screen.
- **OAuth user with no `full_name`:** greeting falls back to the email local-part; avatar to the
  initial of the email.
- **Two tabs, sign out in one:** the other tab's menu is stale until its next `/api/auth/me` (on
  navigation); any protected action re-gates server-side. Acceptable — no client push needed at this
  scale (C1).
- **Avatar URL 404 (deleted Google photo):** `next/image` error → fall back to the initial chip (the
  island catches `onError`).

### 4.8 Responsive
One island. Desktop: avatar + first-name inline in the navy bar. Phone: avatar-only trigger inside the
`MobileNav` sheet header; the dropdown becomes a full-width section of the sheet (not a floating panel
that can clip — the audit flagged clipping on the old hand-rolled panel, `consumer-account.md §8`).
Progressive enhancement on desktop = the inline greeting; the phone shows avatar-only.

### 4.9 Performance
- Header stays server-cached; the island adds **one** `/api/auth/me` fetch per full load (memoized by
  the browser for the session; not per-navigation because the island persists in the layout).
- No session read in the server render path → CDN caching of page HTML preserved.

### 4.10 Acceptance (writer→store→reader→outcome)
- [ ] Signed-in user on `/cities/bend` sees an avatar in the header (desktop) and in the mobile nav
      sheet; signed-out sees "Sign in". (session → `/api/auth/me` → island → chrome)
- [ ] Avatar menu → "Saved searches" lands on `/account/saved-searches` in ≤2 taps on a phone.
- [ ] Sign out returns to `/` and the menu re-renders "Sign in"; a protected route now bounces to
      `/login`.
- [ ] `/login` with an active session redirects to `/account` without rendering the form.
- [ ] Lighthouse: page HTML for a public route is still edge-cacheable (no `no-store` from the header).

---

## 5. Feature — the ONE save → sign-in → resume flow (pending-save replay)

### 5.1 Purpose & the job it serves
The highest-intent moment on the site is an anonymous visitor tapping "save." Today three different
return conventions all dead-end and **none replays the save** (`consumer-account.md §3.2`): the visitor
signs in and lands on an unrelated page with nothing saved. This is the seam that both confuses the
owner's users *and* silently drops leads. **The job:** whatever a visitor tried to save, after they
authenticate, it is saved, and they are back where they were, with confirmation.

### 5.2 The mechanism — one durable carrier
A single short-lived, signed, httpOnly cookie `rr_pending_save` carries the intent across the auth
round-trip (which may be an OAuth redirect off-site, a magic link, or an email-confirmation click hours
later). One replay routine consumes it in the shared post-auth path.

**Intent shape (JSON, ≤1 KB, 30-min TTL):**
```ts
type PendingSave =
  | { kind: 'listing';   listingKey: string }
  | { kind: 'search';    name: string; filters: SavedSearchFilters }
  | { kind: 'city';      slug: string }
  | { kind: 'community'; entityKey: string }
  | { kind: 'collection-add'; collectionId: string; listingKey: string }
```

### 5.3 One server action every save affordance calls
Replace the per-affordance anon/signed-in branching with **one** action:

```ts
// app/actions/save-intent.ts
'use server'
export async function saveOrStashIntent(intent: PendingSave):
  Promise<{ status: 'saved' } | { status: 'needs-auth'; loginUrl: string }>
```
- If `getSession()` is non-null → perform the save for the user (dispatch by `intent.kind` to the
  existing keeper: `saveListing`, `createSavedSearch`, `toggleSavedCity`(save), etc.), return
  `{status:'saved'}`.
- If null → set `rr_pending_save` (signed, httpOnly, `SameSite=Lax`, `maxAge=1800`, `path=/`), read
  the current page from the referrer/`x-pathname`, return `{status:'needs-auth', loginUrl:
  '/login?next=<currentPath>'}`.
- The client then either updates optimistic state (saved) or `router.push(loginUrl)`.

The cookie is set **server-side** so it is httpOnly and signed (tamper-proof: a forged cookie can only
ever save something for the forger's own account after they authenticate — no cross-account risk).

### 5.4 One replay routine in the shared post-auth path
`replayPendingSave(user)` lives inside `onAuthenticated(user)` (§8.3), so it runs for **every** auth
completion:
- Read + verify + clear `rr_pending_save`. If absent/expired → no-op.
- Dispatch by `kind` to the same keeper the signed-in branch uses, now with the authenticated user.
- Best-effort and idempotent: a failure is logged (Sentry) and never blocks the redirect; the unique
  index (§3.1) makes a re-run a no-op.
- Append `?saved=<kind>` to the post-auth redirect so the landing page can toast "Saved. Here's what
  you were looking at."

### 5.5 Auth path coverage (the reason it can't leak)
`replayPendingSave` runs in `onAuthenticated`, which is called by:
1. **OAuth** (`code`) — `app/auth/callback/route.ts:133`.
2. **Magic link / recovery** (`token_hash`, `type='magiclink'|'recovery'`) — `callback:162`.
3. **Email-confirmation** (`token_hash`, `type='signup'|'email'`) — **new branch** the callback must
   add (today it falls through to `/auth-error`, `consumer-account.md §3.5`).
4. **Password sign-in** — `signInWithEmailPassword` (`auth.ts:94`) after success.
5. **Password sign-up with an immediate session** — `signUpWithEmailPassword` (`auth.ts:126`) when
   `data.session` exists.

For sign-up **requiring confirmation** (no session yet), the cookie persists and replay fires on the
confirmation click (path 3). 30-min TTL is the constraint — see Open Questions if email confirmation
routinely exceeds it.

### 5.6 User flows
**Anonymous save a home (target: 4 taps, save preserved):**
1. Tap the heart on a listing/tile (1) → `saveOrStashIntent({kind:'listing',listingKey})` →
   `needs-auth` → redirect to `/login?next=/listing/<key>`.
2. Tap "Continue with Google" (2) → OAuth round-trip → callback runs `onAuthenticated` → replay saves
   the listing → redirect to `/listing/<key>?saved=listing`.
3. Land back on the exact listing, heart filled, toast "Saved to your homes." (Today: ~9 taps and the
   save is lost, `consumer-account.md §10`.)

**Anonymous save a search:** same shape; `intent.kind='search'` carries the `name` + `filters`; replay
calls `createSavedSearch`, which also fires the CRM lead capture (so the guest becomes a lead the
instant they authenticate).

### 5.7 States
- **Signed-in save:** optimistic fill instantly; `saveOrStashIntent` returns `saved`; on error the
  optimistic state reverts with an inline "Couldn't save — retry."
- **Anon save (stashing):** the affordance shows a brief pending state, then the browser navigates to
  `/login`. The cookie is set before navigation.
- **Post-auth replay success:** landing page reads `?saved=<kind>`, shows a toast, and the affordance
  reflects the saved state on first paint (the server render sees the row).
- **Post-auth replay no-op (cookie expired):** land on `next` with no toast; the affordance shows
  unsaved; a second tap now saves directly (user is signed in). No error shown (the cookie expiring is
  not an error the user needs).
- **Replay partial failure (e.g. `createSavedSearch` CRM capture blip):** the alert row is saved
  (primary); the CRM capture is best-effort inside `createSavedSearch` already (`saved-searches.ts:187`
  swallows). Toast still says "Saved."

### 5.8 Edge cases (exhaustive)
- **Cookie forged/tampered:** signature check fails → treated as absent → no-op. A forger can only ever
  cause a save onto **their own** just-authenticated account.
- **User cancels OAuth / closes the tab:** cookie sits unused for ≤30 min, then expires. No save, no
  orphan.
- **User signs in as a *different* account than the one that started the save:** the save lands on the
  account they authenticated as — correct (the cookie carries no identity, only intent).
- **`next` points off-domain or to an admin route:** `safeRedirectPath` (already used everywhere,
  `auth.ts:5`) clamps it; replay still runs, redirect is sanitized.
- **Two saves stashed before auth (visitor taps two hearts):** the cookie holds the **last** intent
  only (single-value). The first is lost. Acceptable for v1 (Open Question: multi-intent queue). The
  visitor can re-save the first once signed in — now a 1-tap direct save.
- **Listing goes off-market between stash and replay:** `saveListing` still inserts the row (we save by
  key, not by active status); the saved-homes page renders it with a "no longer available" state (the
  tile fetch returns nothing → show a tombstone card with remove). Never a crash.
- **Email-confirmation click after 30-min TTL:** replay no-ops; guest-alert claim (§8.3) still attaches
  any email-keyed searches, so a stashed **search** effectively survives via the alert row; a stashed
  **home** is lost (Open Question).
- **Duplicate submit (double-tap the same heart while signed in):** unique index → second insert is a
  no-op; the action returns the same `saved:true`; optimistic state already reflects it.
- **Anon on the search-results grid (list view):** the rebuilt save affordance (§2 REBUILD) means the
  intent can be stashed from any card, not just map tiles.

### 5.9 Error handling & compliance
- The cookie is httpOnly + signed → no XSS read, no tamper. No PII in it beyond a listing key /
  filter set the visitor themselves chose.
- Replay never sends anything (no TCPA surface); it only writes save rows + (for searches) fires the
  existing suppression-safe native-lead path.
- Auth guard: every keeper resolves the user from `supabase.auth.getUser()` server-side; the
  client-passed intent is data, never an identity claim (§4.4 consumer equivalent).

### 5.10 Performance
- One cookie read + one dispatch on the auth path (already the hot path); no added round trips on
  normal navigation.
- The signed-in save is a single server action returning the changed entity; **no `router.refresh()`**
  full-page re-render (RC2).

### 5.11 Acceptance (writer→store→reader→outcome)
- [ ] Anon taps heart on `/listing/X` → Google sign-in → lands on `/listing/X?saved=listing` with the
      row present in `saved_listings` and the heart filled on first paint. (intent cookie → replay →
      `saved_listings` → listing page reader → filled heart)
- [ ] Anon "Save this search" → email/password **sign-up requiring confirmation** → clicks the
      confirmation email → the search exists in `listing_alerts` **and** a `Saved Property Search` lead
      exists in `crm_people`.
- [ ] Anon save from the **list-view** search grid (not just map) stashes and replays.
- [ ] Tampered `rr_pending_save` cookie → no save, no error.
- [ ] Signed-in double-tap → exactly one `saved_listings` row.

---

## 6. Feature — store consolidation (7 → 3, canonically keyed)

### 6.1 Purpose & the job it serves
"Seven+ parallel persistence systems for 'I'm interested in X'" with asymmetric keys and asymmetric
counters produce silent remove failures, phantom saved states, and captured signal shown to no one
(`consumer-account.md §1, §6`). **The job:** one obvious "saved" concept per thing, keyed one way,
readable by the consumer *and* the broker.

### 6.2 Homes — `saved_listings` only (merge `likes`)
- **The heart and the bookmark are one intent** in the owner's users' mental model; two buttons on one
  home is the confusion. Collapse to **one save affordance** writing `saved_listings`, canonically
  keyed (already true on write, `saved-listings.ts:44`).
- Backfill `likes` → `saved_listings` (§3.1), then retire all `likes` writers (delete `app/actions/
  likes.ts` writers + the geo/activity heart affordances).
- `removeSavedHome` simplifies to a single `unsaveListing(canonicalKey)` — the dual-store planner
  (`planSavedHomeRemoval`) is kept only through the migration window, then reduced to the single store
  (the pure helper stays unit-tested; its "both" branch becomes moot).
- **Counter integrity:** `likeListing` never incremented the public counter and `unlikeListing`
  decremented even on zero-row deletes (`consumer-account.md §5.7`). After the merge there is one
  counter path: `incrementListingSaveCount` on insert, `decrementListingSaveCount` on delete, both
  keyed to the canonical key, both no-op-safe against the unique index. Delete the like-counter drift.

### 6.3 Places — `saved_cities` + `saved_communities` only (retire `community_likes`)
- One "follow" concept per place. The community-tile heart (which wrote `community_likes`, shown
  nowhere) is repointed to `toggleSavedCommunity` (writes `saved_communities`, the visible store) or
  removed; `community_likes` writer is deleted.
- City names on `/account/saved-cities` stop being title-cased from the slug blind
  (`consumer-account.md §2.4`); the page validates against the cities index so a dead slug renders a
  tombstone with remove, not a fake city name.

### 6.4 Searches — `listing_alerts` only (retire the `saved_searches` public mirror)
- `listing_alerts` is already the one live store. Delete the `saved_searches` public-mirror write +
  its dead readers + the `isPublic` checkbox (§2 DELETE). One store, one cadence source of truth.

### 6.5 Collections — kept as a grouping layer, defects fixed
Collections are **groupings over saved homes**, not a parallel interest store, so they stay — but:
- **Race fix:** replace read-modify-write of `listing_keys` with a DB-side array append/remove
  (`array_append`/`array_remove` via an RPC or `update … set listing_keys = array_append(…)`), so two
  concurrent adds can't lose one (`consumer-account.md §5.10`).
- **Dead `share_token` removed** (no route consumes it; §2 DELETE).
- **Fill flow:** add "Add to collection" to the saved-home tile menu so a home joins a collection
  without the 6–7-step detour (`consumer-account.md §2.5`).

### 6.6 States (per store, the common shape)
- **Empty:** honest empty state — no promise of alerts nothing sends (§8.2 copy fix).
- **Optimistic add/remove:** instant reflect; revert-on-error with an inline note (the
  `SavedSearchControls` pattern, applied everywhere).
- **Duplicate add:** unique index (homes) / existing-row check (places) → no-op.
- **Remove of a row that vanished (concurrent tab already removed it):** zero-row delete → treated as
  success; the item is gone either way.

### 6.7 Edge cases
- **A home saved under an MLS `ListNumber` from a paid-ad landing:** `resolveCanonicalListingKey`
  resolves it to the RETS `ListingKey` on write, so it dedupes against the same home saved from a
  pretty URL (`saved-listings.ts:44`). The double-query hack in `getListingsByKeys` is removed because
  the store is now single-keyspace.
- **`likes` backfill collides with an existing `saved_listings` row:** `on conflict do nothing`
  (§3.1) — the earlier `created_at` is kept; no dupes.
- **A raw like key that no longer resolves to any listing:** backfilled as-is (the `coalesce` keeps the
  raw key); it renders as a tombstone on the saved-homes page.
- **Community heart tapped by an anon user:** goes through `saveOrStashIntent({kind:'community'})` (§5)
  — no more persist-into-a-void.

### 6.8 Responsive / Performance
- One keyspace kills the double tile query (`getListingsByKeys` runs one query, `consumer-account.md
  §9`). Hub round-trips drop from ~13 to the streamed set in §9.
- Toggles return the changed entity; no full-page refresh.

### 6.9 Acceptance
- [ ] A home hearted via the old `likes` path (backfilled) appears exactly once on `/account/saved-
      homes` and removes in one tap with no reappearance. (backfill → `saved_listings` → saved-homes
      reader → remove → gone)
- [ ] Saving the same home from a `/homes-for-sale/...` URL and from `/listing/<ListNumber>` yields one
      row.
- [ ] A community "follow" is visible on `/account/saved-communities` (no signal lost to
      `community_likes`).
- [ ] Two concurrent "add to collection" of different homes both persist.

---

## 7. Feature — the buyer-signal → CRM seam (§4.8, the key seam)

### 7.1 Purpose & the job it serves
"The strongest buyer signal collected — saved homes — never reaches the broker CRM at all"
(`consumer-account.md §0, §4`). Saved **searches** already flow to the CRM (via `createSavedSearch`'s
native-lead capture, `saved-searches.ts:154-189`, and are read back by `getContactListingAlerts`).
Saved **homes / places** do not. This starves the response half of the loop (C2) of the highest-intent
data. **The job:** when a signed-in visitor saves a home, the broker can see it on the person — and a
cold visitor who starts saving becomes a lead worth a call.

### 7.2 The writer — mirror `createSavedSearch`
Extend `saveListing` (the one saved-home keeper) so, after the row is persisted, it fires the **same
native-lead pattern** the saved-search path already uses (`app/actions/saved-searches.ts:154-189`),
best-effort and non-blocking:
1. `sendEvent({ type: 'Property Saved', person:{emails:[{value: session.user.email}]}, sourceUrl:
   '/listing/<key>', message: 'Saved <address>' })` → `ensureNativeLead` creates/merges the CRM person
   by email.
2. On `result.ok && result.personId` → `canonicallyTagLead({ fubPersonId: result.personId, audience:
   'buyer', source: 'idx-registration', tier: 'warm', originContext:{ source:'saved-home', … } })` —
   the tagger's own compliance guard skips realtors / opt-outs.
3. Write a `crm_timeline` row: `kind='buyer_signal'`, `title='Saved a home'`, `body='<address>'`,
   `payload={ listingKey, listPrice, url }`, `dedupe_key='saved-home:<personId>:<listingKey>'` so
   save→unsave→re-save never stacks.

All three are wrapped in a single `try/catch` that logs and never blocks or fails the save (identical
posture to `saved-searches.ts:187`).

### 7.3 The reader — `getContactSavedHomes(crmPersonId)`
A new DAL reader in `lib/data/crm/` that mirrors `getContactListingAlerts` (`getContactListingAlerts.
ts:189`) exactly:
- Resolve identity via `resolvePersonIdentity(crmPersonId)` → `{ authUserId, emails, fubLegacyId }`.
- Read `saved_listings` by `user_id ∈ {authUserId}` (saved homes are auth-user-keyed, so the join key
  is the auth uuid the person resolves to; a person with no auth account has no saved homes — correct).
- Batch-hydrate the listing tiles (address, price, photo, status) via the existing `getListingTiles`.
- Return `{ listingKey, address, listPrice, photoUrl, status, savedAt, url }[]`, newest first.

This reader is **provided by this spec** and **rendered by Spec 03** (Person Workspace / Contact-360)
alongside the existing listing-alerts panel — one "buyer intent" section: saved searches + saved homes
+ (optionally) recent views, the full picture the broker needs to respond well.

### 7.4 Lead-creation threshold (avoid cold-single-save spam)
A single anonymous-then-signed-in save creating a brand-new "warm buyer" lead the broker must work
could flood the pipeline with cold contacts (C1: small shop). Default behavior:
- **Attach the signal always** (timeline row + tag) — cheap, non-notifying.
- **Escalate to broker attention** (task / alert) only when the person crosses a threshold: e.g. **≥3
  saved homes** OR **1 saved search + ≥1 saved home** within a rolling window. Below threshold, the
  signal sits on the person for context, no interruption.
- The threshold value is an **Open Question** for Matt (§14).

### 7.5 States
- **Signed-in save, person already in CRM:** timeline row + tag applied; visible on the person next
  render.
- **Signed-in save, person not yet in CRM:** `ensureNativeLead` creates the person; the save is
  attributed from `saved_listings` on the very next `getContactSavedHomes` even before the
  native-lead round trip finishes (the reader keys on `user_id`, independent of the CRM create).
- **CRM capture fails (network):** the save row still persists; the timeline/tag retries on the next
  save (dedupe_key keeps it clean); the reader still shows the home (it reads `saved_listings`, not the
  timeline).
- **Unsave:** the `saved_listings` row is deleted; the timeline `buyer_signal` row is **immutable
  ledger** (kept — it's history that the person *was* interested); the reader (keyed on live
  `saved_listings`) simply stops showing the home.

### 7.6 Edge cases
- **A licensed realtor account saves homes:** `canonicallyTagLead`'s compliance guard skips them — no
  buyer tag, no lead escalation (matches the saved-search path).
- **An opted-out person saves a home:** same guard skips tagging; the timeline row is still written
  (internal context, not a send).
- **The same home saved by two people:** each gets its own `saved_listings` row + its own timeline row;
  no cross-person collision (dedupe_key includes `person_id`).
- **A guest (no session) "saves" via the funnel:** they authenticate first (§5), so by the time
  `saveListing` runs they have an email; the seam fires on replay.
- **Person merge (two CRM people merged later):** `saved_listings` keys on the auth uuid; identity
  resolution (`resolvePersonIdentity`) follows the merged person, so saved homes surface on the
  survivor. No data model change needed (RC1 merge is the CRM spec's concern).

### 7.7 Error handling & compliance
- The seam **never sends** to the consumer; it writes internal signal + fires the existing
  suppression-safe native-lead path. No TCPA surface.
- `getContactSavedHomes` is a broker-only reader; it is called from the person workspace which is
  behind the CRM auth guard (Spec 03). This spec's reader does not add its own guard (it's a DAL read,
  gated by its caller, matching `getContactListingAlerts`).

### 7.8 Acceptance
- [ ] A signed-in visitor saves 21042 Robin Ln → the broker opens that person in the workspace and sees
      "Saved a home · 21042 Robin Ln" in the buyer-intent section. (`saveListing` → `saved_listings` +
      `crm_timeline` → `getContactSavedHomes` → workspace)
- [ ] The same visitor saves a search → both the search (existing panel) and the home (new panel) show
      on the person.
- [ ] Crossing the saved-home threshold creates exactly one broker task/alert, not one per save.
- [ ] A realtor account saving homes creates no buyer tag and no escalation.
- [ ] Unsaving a home removes it from the broker's saved-homes list but the timeline history remains.

---

## 8. Feature — placebo removal / wiring

### 8.1 Viewing history — wire to a real writer (or delete)
**Default: wire it.** Repoint `getRecentListingViews` (`app/actions/dashboard-history.ts:12-27`) from
the dead `user_activities` to `user_events WHERE event_type='listing_view' AND user_id=? ORDER BY
event_at DESC` (§3.3). Add the **writer**: the listing-detail page fires `trackUserEvent({
eventType:'listing_view', listingKey })` on view (today only `'page_view'` is written via `trackVisit`,
`track-visit.ts:24`). `RemoveViewedButton` deletes the matching `user_events` rows.
- This makes a placebo real with a 1-line writer and a reader repoint — honoring §8 "no placebo
  ships." Recent views also become a (low-weight) signal available to the CRM seam (§7).
- **Alternative (Open Question):** if Matt would rather not build the writer, **delete** `/account/
  history`, the hub "Recently viewed" section, and the stat card entirely (`consumer-account.md §5.1`).
  The spec's default is wire; the fallback is delete. Either way, **no dead read renders as an empty
  "feature."**

### 8.2 Notification toggles — 3 real, 5 deleted
Keep the three controls with real senders: `emailEnabled` (honored by the cron,
`saved-search-alerts.ts:204`), saved-search cadence fan-out (`setListingAlertFrequencyForUser`), and
the market-report subscription (`getMyReportSubscriptionAction`/save). **Delete** `priceDropAlerts`,
`statusChangeAlerts`, `openHouseReminders`, `marketDigestFrequency`, `blogUpdates` (no sender) and the
empty-state copy that promises them (`account/page.tsx:151`, `saved-homes/page.tsx:68`).
- **Also fix** the auto-save-per-toggle overlapping-write race (`DashboardNotificationPrefs.tsx:215`):
  with only 3 controls, each save writes only its own key (not the whole prefs object), and each shows
  its own pending + error state.
- **Cadence overlap:** the global fan-out control carries an explicit "This changes every saved
  search" confirmation (it already overwrites per-search choices, `DashboardNotificationPrefs.tsx:277`)
  — kept, but the copy stops apologizing and states it plainly.
- **Optional additive feature (Open Question, not default):** a **real** saved-home price-drop alert
  reusing the existing hourly alert cron + `getListingKeysWithPriceChangeSince` + seen-set diff. If
  Matt greenlights, `priceDropAlerts` becomes real (per-saved-home watch) rather than deleted. Until
  then it is deleted — a toggle that does nothing is worse than its absence.

### 8.3 Password auth parity — one `onAuthenticated` routine
Extract the post-auth identity work into **one** routine both OAuth and password paths call, closing
`consumer-account.md §3.5` (defect #4) and wiring replay (§5):

```ts
// app/actions/auth-postlogin.ts (or lib/auth/postLogin.ts)
export async function onAuthenticated(user: User, ctx: { res?: NextResponse; rrVid?: string; source: string }) {
  await stampPersonIdFromEmail(...)        // rr_pid + identity graph  (OAuth-only today)
  await claimGuestSearchesForUser(user)    // guest listing_alerts claim (OAuth-only today)
  await replayPendingSave(user)            // §5 — the intended save
  // trackSignedInUser already fires in each caller; keep or fold in
}
```
Callers:
- `app/auth/callback/route.ts` — OAuth (`code`), magic-link/recovery (`token_hash`), **and a new
  `type='signup'/'email'` branch** (verify the confirmation OTP, then `onAuthenticated`). Passes the
  `NextResponse` so `rr_pid` can be set as a response cookie.
- `signInWithEmailPassword` / `signUpWithEmailPassword` (`app/actions/auth.ts`) — after success. In a
  server action, `cookies()` sets `rr_pid` (no `NextResponse` needed).

Result: a guest who set up email alerts and later registers with a password **sees their saved searches
immediately** and any pending save replays — parity with OAuth.

### 8.4 `resetPasswordForEmail` default redirect
Change the default post-reset redirect from `/dashboard/settings` (a redirect stub, `auth.ts:181`) to
`/account/profile` (a real page), since `/dashboard/**` is deleted (§9.4).

### 8.5 Acceptance
- [ ] A signed-in user who viewed 5 listings sees them on `/account/history` and the hub "Recently
      viewed" (writer → `user_events` → reader → page), OR the feature is absent (no empty placebo).
- [ ] The notifications page shows exactly 3 controls, each with its own pending/saved/error state; no
      toggle without a sender.
- [ ] A guest sets an email alert → registers with **password** → `/account/saved-searches` shows the
      search on first load, and `rr_pid` is stamped.
- [ ] Password sign-up requiring confirmation → confirmation click lands the user signed-in with claim
      + replay run (not `/auth-error`).

---

## 9. Account pages + route map

### 9.1 `/account` hub — cached + streamed rebuild
Rebuild the ~13-round-trip `force-dynamic` hub (`consumer-account.md §2.1, §9`) into an
identity-core + streamed shell:
- Render the chrome + greeting instantly; wrap each data region (**Saved homes**, **Saved searches**,
  **Saved places**, **Recently viewed**, **Agent card**) in `<Suspense>` with a skeleton.
- Each region reads through **one** DAL function (cached where it's aggregate); the single keyspace
  removes the `getListingsByKeys` double query.
- The "Recently viewed" card renders a real count (§8.1) or the section is absent (§8.1 alternative) —
  never a fabricated "0".
- Saved-search rows link to the **results** page (deep link via `buildSearchUrl`) when the subtitle
  says "Tap to view results," and to the **manage** page from an explicit "Manage" affordance — the
  copy stops lying (`consumer-account.md §2.1`).

### 9.2 Sub-pages — loading states + error surfacing
Every account sub-page gets a `loading.tsx` (six lack one today, `consumer-account.md §2.10`). Every
Remove button reads and surfaces the action's `{error}` (today several `await` and ignore it,
`consumer-account.md §5, §2.2`) — inline "Couldn't remove — retry," optimistic revert.

### 9.3 Responsive `AccountNav`
The 10-item horizontal-scroll pill bar (`AccountNav.tsx`) with no overflow cue on phone
(`consumer-account.md §2.1, §8`) → a responsive nav that shows a scroll affordance (edge fade + a
"more" indicator) OR collapses to a `Select`/sheet on the narrowest widths. One tree, adapts by width;
desktop keeps the full pill row (progressive enhancement).

### 9.4 Route map — `/account` KEEP, `/dashboard` DELETE
| Route | Disposition | Note |
|---|---|---|
| `/account` (+ hub) | **KEEP** — the one consumer home | Rebuilt per §9.1. |
| `/account/saved-homes` | **KEEP** | Single store (§6.2). |
| `/account/saved-searches` | **KEEP** | The best UI in the domain; guest-claim hole fixed (§8.3). |
| `/account/saved-cities`, `/account/saved-communities` | **KEEP** (consider merging to one "Saved places" tab) | `community_likes` retired (§6.3). Merge = Open Question. |
| `/account/collections` (+ `[id]`) | **KEEP** | Race + share_token + fill flow fixed (§6.5). |
| `/account/history` | **KEEP if wired (§8.1) / DELETE if not** | No empty placebo. |
| `/account/notifications` | **KEEP** | 3 real controls (§8.2). |
| `/account/buying-preferences`, `/account/profile` | **KEEP** | Work today. |
| `/dashboard` + 8 feature stubs + `layout.tsx` + `DashboardShell` | **DELETE** | Redirect stubs wrapped by a live shell doing wasted fetches (`consumer-account.md §2.11`). Replace the stubs with Next.js `redirect()` config (or 301s) to the `/account` equivalents so old bookmarks/emails still resolve, with **no** layout/shell work. |
| `/dashboard/marketing`, `/dashboard/marketing/inbox` | **MOVE** (cross-domain) | Admin surfaces → `/admin` (Shell/IA spec); this spec only unwraps the consumer `/dashboard` layout. |

### 9.5 Acceptance
- [ ] `/account` first paint shows chrome + greeting before any data region resolves; each region
      streams in independently; no region blocks another.
- [ ] Every `/account/*` tab shows a skeleton on slow load (no blank content well).
- [ ] Every Remove surfaces an error inline on failure and reverts optimistically.
- [ ] `/dashboard/saved` 301s (or `redirect()`s) to `/account/saved-homes` with **no** `DashboardShell`
      render and **no** `getProfile()` fetch.

---

## 10. Feature — the alert pipeline (KEEP, minor hardening)

Kept intact (§2 KEEP). Minor, non-blocking improvements the audit flagged (`consumer-account.md §4`):
- **N+1 in the send loop** (per-row `profiles`/person/search reads, up to 600 rows sequential,
  `saved-search-alerts.ts:158-229`): batch the `profiles` fetch for the run's rows in one query keyed
  by email. Fits `maxDuration 300` today; this keeps it linear-safe as subscribers grow.
- **"Instant" cadence label** is hourly (`vercel.json:128` + 55-min floor): rename the label to
  "Hourly" so the copy is honest (C4 truthfulness), or leave "Instant" and document — **Open
  Question** (a real product-naming call). Default: rename to "Within the hour."
- **>15-match under-report** (only the top-15 cached page is diffed, `:229`): document as a known bound;
  the "+N more" affordance covers it. No change required.

No data-model or compliance change — the cron's suppression / quiet-hours / A2P / one-click posture is
correct and untouched.

---

## 11. Cross-cutting state matrix (every consumer mutation)

Every save/remove/toggle in this domain implements this matrix (§4.2 primitive):

| State | Behavior |
|---|---|
| **empty** | Honest empty state; no promise of unsent alerts. |
| **loading (read)** | Streamed Suspense skeleton per region (§9.1). |
| **populated** | Server-rendered from the single store; first paint reflects truth. |
| **pending/optimistic** | Instant local reflect via `useOptimistic`; input/affordance disabled during the transition. |
| **success** | Server returns the changed entity; client patches local state; **no `router.refresh()`**. |
| **partial** | Primary write succeeds, best-effort side-effect (CRM capture) fails → user sees success; side-effect retries idempotently. |
| **error** | Optimistic state reverts; inline "Couldn't save/remove — retry"; the row is never left in a phantom state. |
| **offline** | The action rejects; optimistic reverts; "You're offline — try again." No silent swallow. |
| **permission-denied (not signed in)** | Save affordances route through `saveOrStashIntent` → `/login` (never a silent no-op). Manage actions on `/account/*` are already behind the layout auth gate. |
| **over-limit / duplicate** | Unique index makes a duplicate a no-op returning the existing state; no error shown for a re-save. |

---

## 12. Consolidated edge-case register (domain-specific)

1. **Group-vs-single is not in scope** (that's RC1/messaging) — but the CRM buyer-signal timeline rows
   this spec writes conform to the immutable-ledger convention (`kind`, `dedupe_key`) so they coexist
   with message/note kinds cleanly.
2. **Listing key mismatch (ListNumber vs ListingKey):** every write canonicalizes via
   `resolveCanonicalListingKey`; the store is single-keyspace, so the double-query hack is deleted.
3. **A saved home that goes off-market:** saved by key regardless of status; renders as a "no longer
   available" tombstone with remove; never a crash or a broken tile.
4. **A merge-token/filter with no value in a humanized search:** `humanizeSearchCriteria`
   (`getContactListingAlerts.ts:92`) already returns "All homes" for an empty filter set — reused as-is.
5. **MLS sync overwriting a saved-home's displayed price:** the saved row stores only the key; price is
   re-hydrated live on render, so it's always current (no stale copy to overwrite).
6. **Expired session mid-save:** `saveOrStashIntent` sees no session → stashes + routes to `/login`;
   the visitor re-auths and the save replays (§5).
7. **Concurrent edits (two tabs remove the same saved home):** second delete is a zero-row no-op →
   success; the home is gone; no error.
8. **Duplicate submit (double-tap):** unique index → one row; idempotent (RC2).
9. **30–60s build timeout:** not in this domain (CMA/BPO builds are Spec 03). Consumer saves are
   sub-second single writes.
10. **A metric with no writer:** forbidden — the "Recently viewed" count either has the §8.1 writer or
    the section is absent; no `$0`-shaped fabrication (C4).
11. **Guest with an email that later collides with an OAuth account of the same email:**
    `claimListingAlertsForUser` is verified-email gated and only stamps rows with `user_id IS NULL`
    (`listingAlerts.ts:379`) — never re-assigns another account's claimed rows.
12. **Anon saves two different homes before auth:** single-value cookie keeps the last; the first is
    re-saveable in one tap post-auth (Open Question: multi-intent queue).
13. **Tampered pending-save cookie:** signed → rejected → no-op; can only ever save onto the forger's
    own account.
14. **A person with no auth account (guest-only lead) in the CRM:** `getContactSavedHomes` returns
    empty (saved homes are auth-user-keyed) — correct; their saved *searches* still show via the
    email-keyed `getContactListingAlerts`.
15. **Realtor / opted-out account saving:** buyer tag + escalation skipped by the compliance guard;
    timeline context still recorded.

---

## 13. Acceptance criteria (roll-up — writer → store → reader → outcome)

The domain is "done" when every round trip is proven end to end (§8 of the architecture):
- [ ] **Account door:** signed-in session → `/api/auth/me` → `AccountMenu` island → avatar + working
      menu on phone and desktop; sign-out returns to `/` signed out.
- [ ] **Save→resume:** anon save (home **and** search) → any auth path (OAuth, magic link, password
      sign-in, password sign-up-with-confirmation) → the intended save exists in its store and the user
      lands where they were, with a toast.
- [ ] **One home store:** a `likes`-only home (post-backfill) shows once on `/account/saved-homes` and
      removes in one tap without reappearing; saving via ListNumber and ListingKey yields one row.
- [ ] **Buyer-signal seam:** a signed-in save → the broker sees the home on the person via
      `getContactSavedHomes`; crossing the threshold creates one escalation.
- [ ] **Placebos gone:** notifications page has 3 real controls; viewing history is real (or absent);
      password users get guest-alert claim + `rr_pid`; `resetPasswordForEmail` lands on a real page.
- [ ] **Routes:** `/account/*` kept + responsive + streamed; `/dashboard/*` gone with redirects, no
      shell, no wasted fetch.
- [ ] **Alert spine untouched:** the hourly cron still sends with suppression/quiet-hours/one-click
      intact; the broker mirror (`getContactListingAlerts`) still reads the same table.
- [ ] **Data-model migrations are additive:** `saved_listings` unique index + `likes` backfill +
      `user_events` index only; no table dropped in this delivery (drops are a later cleanup once
      references are zero).

**Success-flow tap budget (the litmus for this domain):** anonymous save-a-home → **4 taps** (heart →
provider → [auth] → land saved), down from ~9 with the save lost. Signed-in save → **1 tap**, instant
optimistic, no full-page refresh.

---

## 14. Open questions for Matt

1. **Buyer-signal escalation threshold (§7.4).** What makes a saving visitor worth a broker's
   attention — ≥3 saved homes? 1 saved search + 1 saved home? Any first save? Default proposed: attach
   always, escalate at ≥3 homes or (1 search + 1 home) in a rolling window. Your call on the number.
2. **Viewing history — wire or delete (§8.1).** Default is **wire** it to `user_events` (real signal,
   small writer). Alternative is **delete** the feature. Which?
3. **Saved-home price-drop alerts (§8.2).** Build a **real** per-saved-home price-drop/status alert
   (reusing the hourly cron + seen-set diff), or leave those toggles deleted? Real alerts are more
   work but close the loop the empty-state copy used to promise.
4. **"Instant" cadence label (§10).** Rename to "Within the hour"/"Hourly" (honest), or keep "Instant"
   as marketing shorthand? Default: rename.
5. **Merge "Saved cities" + "Saved communities" into one "Saved places" tab (§9.4)?** Same tiny
   dataset, currently two tabs + a hub section (three surfaces). Default: keep two tabs; happy to
   merge on your word.
6. **Multi-intent stash (§5.8 / §12.12).** v1 keeps only the **last** pre-auth save intent. Worth a
   small queue so a visitor who taps two hearts before signing in gets both? Default: single intent,
   ship it, revisit if it matters.
7. **`/dashboard/*` redirects — 301 vs in-app `redirect()`.** Old emails/bookmarks point at
   `/dashboard/settings` etc. Permanent 301 (SEO-clean, cached by browsers) vs Next `redirect()` (soft).
   Default: 301 for the stubs.
