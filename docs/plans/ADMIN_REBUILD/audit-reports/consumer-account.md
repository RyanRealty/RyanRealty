# Consumer-Side Account Audit — Ground Truth

Domain: the logged-in visitor experience (saving searches, saving homes, account hub) plus the anonymous → signed-in funnel, alert delivery, and the broker's mirror of it.
Auditor lens: senior engineer / architect / design lead. Every claim carries file + line evidence. All paths relative to `/Users/matthewryan/RyanRealty`.

---

## 0. Executive summary

The account area itself (`/account/**`) is the most coherent consumer surface in the repo — server components + small client islands, design-system components, real optimistic states on saved-searches. **The catastrophic problems are at the seams around it:**

1. **A signed-in user has no way to reach their account from the site chrome.** The live header always renders a "Sign in" link and nothing else (`components/site/SiteHeader.tsx:96-98`); the component that carried the signed-in avatar menu (`components/AuthDropdown.tsx`) has **zero importers**. `/login` doesn't redirect signed-in users. The account hub is reachable only by typing the URL.
2. **Viewing history is a read of a table nothing writes.** `/account/history`, the hub's "Recently viewed" section, and the "Recently viewed" stat card all read `user_activities` — a repo-wide grep finds **no insert anywhere** (app code, api routes, migrations, edge functions). Permanently empty for every user.
3. **The save → sign-in → resume funnel is broken in every variant.** Three different return-URL conventions (`?next=`, `?returnUrl=`, `/account?signin=1&returnUrl=`), none of which complete the loop; the item the visitor tried to save is never saved after auth.
4. **Two parallel "I care about this home" systems (`saved_listings` + `likes`)** with asymmetric canonical-key handling, asymmetric counters, and a like feature whose primary UI entry points are orphaned dead code.
5. **Password-based sign-in/sign-up skips identity stitching** (guest-alert claim + `rr_pid` cookie) that OAuth gets — a guest who set up alerts by email and later registers with a password sees an empty saved-searches page while still receiving the emails.
6. Half the notification-preferences page is **placebo controls** (price-drop / status-change / open-house / market-digest / blog toggles have no sender), and the empty states *promise* alerts ("get price-drop and status alerts") that no code sends.
7. The **saved-search alert pipeline itself (unified `listing_alerts` + hourly cron + Resend email) is real, careful, and working** — the best code in the domain — and the broker CRM reads the same table (true single source of truth for alerts).

---

## 1. Data-store inventory (what "saving" actually writes)

| Store (table) | Written by | Read by (consumer) | Read by (broker) | Notes |
|---|---|---|---|---|
| `listing_alerts` (unified 2026-07-07) | `upsertListingAlert` via `createSavedSearch` (signed-in) + `submitSearchAlertSignup` (guest) + broker/system (`createListingAlertForLead`) | `/account/saved-searches` via `getListingAlertsForUser` | `getContactListingAlerts` → ContactListingAlertsPanel (`lib/data/crm/getContactListingAlerts.ts:189-202`) | **The one healthy pipeline.** Keyed (email, filters_hash), unsubscribe token, seen-set diff. |
| `saved_searches` (legacy) | Only the "public mirror" insert (`app/actions/saved-searches.ts:130-146`) + legacy self-updates | `getPopularPublicSearches` — **zero page consumers** | export only | Zombie table kept for a feature that renders nowhere (§6.3). |
| `saved_listings` | `saveListing`/`toggleSavedListing` (`app/actions/saved-listings.ts:40-77`) | hub, `/account/saved-homes`, collections "addable" list | **nothing** — no admin reader of saved_listings/likes exists (grep §7.9) | Canonical-key resolved on write (`saved-listings.ts:44`). |
| `likes` | `toggleLikeListing` — live writers are only geo-page/activity cards (§5.4) | union-merged into hub + saved-homes | **nothing** | Raw key stored, NOT canonicalized (`app/actions/likes.ts:35-38`). |
| `saved_cities` | `toggleSavedCity` (`components/CityTile.tsx`) | hub "Places", `/account/saved-cities` | nothing | |
| `saved_communities` | `toggleSavedCommunity` (`components/CommunityTile.tsx:95`, `community/CommunityCard.tsx:79`) | hub "Places", `/account/saved-communities` | nothing | |
| `community_likes` | `toggleCommunityLike` (CommunityTile, CommunityBarCard, CommunityCard) | **nowhere in /account** — only `getDashboardLikesData().communities`, whose community list no page renders | nothing | Captured signal shown to no one. |
| `listing_collections` | `createCollection`/`addToCollection`/… (`app/actions/collections.ts`) | `/account/collections` + `[id]` | nothing | `share_token` generated, **no share route exists** (§7.8). |
| `user_buying_preferences` | `setBuyingPreferences` (`app/actions/buying-preferences.ts:48-71`) | payment estimates on tiles + "Homes for You" | nothing | Works. |
| `profiles` (`notification_preferences`, `buyer_preferences`) | `updateProfile` (`app/actions/profile.ts:63-89`) | notifications page, hub greeting | alert cron honors ONLY `emailEnabled` (`app/actions/saved-search-alerts.ts:204-215`) | `buyer_preferences` written by nothing (grep: only profile.ts references it). |
| `user_activities` | **NOTHING** | `/account/history`, hub "Recently viewed" (`app/actions/dashboard-history.ts:12-27`) | lead-scoring doc comment only | **Orphaned read. Feature permanently empty.** |
| `user_events` | `trackUserEvent` (`app/actions/track-user-event.ts`) | export-my-data sample only | — | The events that COULD power history land here instead. |

**Seven+ parallel persistence systems for "I'm interested in X."** A rebuild needs one.

---

## 2. Page-by-page

### 2.1 `/account` — the hub (`app/account/page.tsx`)

**Purpose.** Post-2026-06-14 "one home" for the consumer: glance stats, unified homes, saved searches, recent views, places, agent card, settings.

**Data path.** Layout (`app/account/layout.tsx:13-21`) gates auth: `getSession()` → redirect `/login?next=<x-pathname>`. Note middleware sets `x-pathname` to **pathname only** (`middleware.ts:316-319`), so any query (`?signin=1&returnUrl=…`) is silently dropped from the return path.
Page fetches **8 actions in one `Promise.all`** (`page.tsx:66-76`): profile, dashboard-likes (which itself fans out to 5 more reads incl. `getCitiesForIndex` + `getCommunitiesForIndex`, `app/actions/dashboard-likes.ts:41-47`), saved keys, saved searches, city slugs, community keys, recent views, buying prefs — **then two more sequential round trips** `getListingsByKeys(savedKeys)` (`page.tsx:80`) and `getListingsByKeys(viewedKeys)` (`page.tsx:88-90`). Each `getListingsByKeys` runs **two** tile queries (by ListingKey and by ListNumber) to compensate for the mixed-key stores (`app/actions/listings.ts:2504-2523`). Total: ~13+ DB round trips per hub render, `force-dynamic` (`page.tsx:34`), zero caching.

**Defects.**
- "Recently viewed" section + stat card always empty — reads dead `user_activities` (§7.1).
- "Saved searches" rows always render "Tap to view results", never a match count — `getSavedSearches` hard-codes `result_count: null` (`app/actions/saved-searches.ts:93-95`).
- Stat card "Places followed" mixes cities+communities but links only to `/account/saved-cities` (`page.tsx:112`); community rows in "Places you follow" link out but their Manage action also goes to saved-cities only (`page.tsx:249`).
- Saved-search rows link to `/account/saved-searches` (the manage page), not to the search results — subtitle says "Tap to view results" but tapping opens the management list (`page.tsx:189-201`). Copy lies.
- The unified homes list dedupes `likes` (raw keys) against `saved_listings` (canonical keys) by whatever key the tile row surfaces (`page.tsx:81-86`) — works only because `getListingsByKeys` double-queries both keyspaces.
- Hub renders `WelcomeBanner` on every account page until cookie-dismissed (`layout.tsx:25`, `components/WelcomeBanner.tsx`).

**Mobile.** Same component tree; 2-col stat grid, single-col tiles. `AccountNav` is a 10-item horizontally scrolling pill bar (`components/account/AccountNav.tsx:7-18`) — on a phone most destinations are off-screen; no overflow affordance.

**Verdict: partial** — clean visual shell, but one of four stat cards is permanently zero, search rows show no counts, and it costs 13+ queries.

### 2.2 `/account/saved-homes` (`app/account/saved-homes/page.tsx`)

**Purpose.** Union of `saved_listings` + `likes`, with remove.

**Data path.** `getSavedListingKeys` + `getDashboardLikesData` + `getBuyingPreferences` → `getListingsByKeys` (again 2× tile queries). `getDashboardLikesData` pulls city/community indexes this page never uses (`dashboard-likes.ts:41-68`) — pure waste here.

**Mutations.** `RemoveSavedButton` → `removeSavedHome` clears **both** stores (`app/actions/saved-listings.ts:90-100`) then `router.refresh()`. Pending label "Removing…", no error surface (an error is returned and ignored — `RemoveSavedButton.tsx:18` awaits but never reads the result).

**Defects.**
- **Remove can silently fail for likes.** `removeSavedHome` → `unsaveListing` resolves the canonical key (`saved-listings.ts:58`), but `unlikeListing` deletes by the raw passed key (`likes.ts:47-51`). The page key is `ListNumber ?? ListingKey` (`saved-homes/page.tsx:38,77`); a like stored under the other form isn't deleted → home reappears after refresh with no message.
- `unlikeListing` decrements the public like counter even when it deleted zero rows, and `likeListing` **never increments** it (`likes.ts:31-55` vs `engagement.ts:52`) → engagement counters drift.
- Empty state promises "price-drop and status alerts" for hearted homes (`page.tsx:66-69`) — **no sender for saved-home price/status alerts exists anywhere** (grep §7.6).
- ListingTile save toggle on this page has no pending state and trusts `result.saved` even when `error` is set (`components/ListingTile.tsx:288-295`; `toggleSavedListing` returns `saved: true` alongside a non-null error, `saved-listings.ts:69-77`) → phantom saved state.

**Verdict: partial.**

### 2.3 `/account/saved-searches` (`app/account/saved-searches/page.tsx` + `SavedSearchControls.tsx` + `EditSearchDialog.tsx`)

**Purpose.** Manage listing alerts: pause/resume, cadence, rename, edit filters, delete.

**Data path.** `getSavedSearches` → `getListingAlertsForUser(session.user.id)` (`lib/data/leads/listingAlerts.ts:395-409`) — service client scoped by `user_id`. Every mutation is a server action carrying `(id, session user_id)` down to a DAL write that filters on both (`listingAlerts.ts:424-467`). Auth chokepoint is solid.

**UI quality — the best in the domain.** True optimistic dispatch with revert-on-failure and an error note (`SavedSearchControls.tsx:78-91`), AlertDialog delete confirm (`:274-298`), Switch for pause with reflected state text, Select for cadence disabled while paused. Edit dialog preserves unexposed filter keys on save (`EditSearchDialog.tsx:116-128`).

**Defects.**
- Rows created as a **guest** (email-only) or claimed only via OAuth do not appear for password-registered users (§7.5) — the single most confusing outcome for a real consumer ("I get the emails but my account says no saved searches").
- Match counts never shown (`result_count` hard-coded null, §2.1).
- `EditSearchDialog.handleSave` runs `updateSavedSearch` then a second `setSavedSearchCadence` call sequentially (`EditSearchDialog.tsx:130-147`) — two round trips, and a cadence failure leaves saved-but-stale state with the dialog open showing an error about a *different* field than the user thinks they edited.
- `updateSavedSearch` awaits `prewarmSearchCache(filters, 24)` inline (`app/actions/saved-searches.ts:215`) — the user's Save button blocks on warming a 24-listing search cache.
- Cadence label "Instant" is actually "within the hour": cron `0 * * * *` (`vercel.json:128`) + 55-minute floor (`app/actions/saved-search-alerts.ts:79`).
- Delete has no optimistic removal — row stays until `router.refresh()` completes.
- No entry point to CREATE a search here; "Start a search" links to browse, correct, but the create path on /search has its own defects (§5.1).

**Verdict: works** (for user_id-linked rows), with the guest-claim hole above.

### 2.4 `/account/saved-cities` and `/account/saved-communities`

Straightforward list + Remove (`RemoveSavedCityButton.tsx`, `RemoveSavedCommunityButton.tsx`, both `useTransition` + refresh, errors ignored). Data from `saved_cities` / `saved_communities` scoped by user (`app/actions/saved-cities.ts:5-15`, `saved-communities.ts:6-16`).

**Defects.**
- City names are derived by title-casing the slug (`saved-cities/page.tsx:15-20`) — no validation the city page still exists.
- **Community likes are invisible**: a visitor who taps the heart (`toggleCommunityLike`) on `CommunityTile` sees that community NOWHERE in /account — this page reads only `saved_communities` (`saved-communities/page.tsx:22`), and the one reader of `community_likes` (`getDashboardLikesData().communities`) has no rendering page. Two affordances on the same tile, one of which persists into a void.
- Duplication: hub already shows "Places you follow" chips; these two pages + the hub are three surfaces for the same tiny dataset, split across two nav tabs.

**Verdict: works** (for the save path), **broken** (for the like path).

### 2.5 `/account/collections` + `/account/collections/[id]`

**Purpose.** Named lists of saved homes.

**Data path.** `getUserCollections` (`app/actions/collections.ts:180-204`) → preview photos via one `getListingTiles` batch (`collections/page.tsx:27-31`, good). Detail page: collection tiles + "addable" saved homes, two more tile batches (`[id]/page.tsx:30-45`).

**Mutations.** Create (inline expanding form, validation + pending + error — `CreateCollectionForm.tsx`), add/remove listing (`CollectionListingButton`, pending "…", no error surface), delete (two-step inline confirm, `CollectionDeleteButton`).

**Defects.**
- **Read-modify-write race on `listing_keys`**: add/remove fetches the array then updates it (`collections.ts:70-93`, `:112-126`); two concurrent adds lose one. No DB-side array append.
- **`share_token` is a dead limb.** Generated with `Math.random` (`collections.ts:206-213`), selected on every read, doc-commented "anyone with the share URL can view" (`collections.ts:18-20`) — **no route consumes it** (repo grep: only actions/collections.ts). There is no share button, no share URL, no public viewer.
- Collections can only be filled from the detail page's "Add from your saved homes" rail — there is **no "add to collection" affordance on any listing page, tile, or search result**. Job flow: save home (listing page) → /account → Collections → create → open collection → scroll to rail → Add. 6-7 steps per home.
- Add rail hides itself when every saved home is already added — no affordance to go save more from here.
- Error code leak: `createCollection` returns raw `error.message` from Postgres to the UI (`collections.ts:51`).
- Keys stored raw from tile (`card.listingKey`) — consistent within collections, but a third keyspace variant relative to saved/likes.

**Verdict: partial** — CRUD works single-user single-tab; the "shareable" premise is unimplemented and the fill flow is punishing.

### 2.6 `/account/history` (`app/account/history/page.tsx`)

**Purpose.** Last 100 viewed listings, "From your browsing" picks, per-row remove.

**Data path.** `getRecentListingViews` reads `user_activities` where `activity_type='view_listing'` (`app/actions/dashboard-history.ts:12-27`).

**Defect — fatal.** **Nothing writes `user_activities`.** Verified: repo-wide grep for `from('user_activities')` finds only `dashboard-history.ts` (read + delete); no API route, no lib writer, no migration trigger or function inserts into it (checked `supabase/migrations/20260309100006_006_user_engagement.sql` — table + comment only; `supabase/functions` — no match). Listing views actually land in: GA4 (`trackEvent`), `listing_views` (trending, `app/actions/listing-views.ts:9-20`), `listings.view_count` (`app/api/listings/[listingKey]/track/route.ts`), and `user_events` (`app/actions/track-user-event.ts`) — four view-tracking systems, none of which feeds the page labeled "Viewing history."
Consequence: `/account/history` and the hub's "Recently viewed" are permanently empty for every account created after whatever legacy writer was removed. `RemoveViewedButton` deletes rows that can't exist.

**Verdict: broken (dead feature wearing a working UI).**

### 2.7 `/account/notifications` (`app/account/notifications/page.tsx` + `components/dashboard/DashboardNotificationPrefs.tsx`)

**Purpose.** Global email kill switch, saved-search cadence fan-out, assorted alert toggles, market-report subscription.

**What actually works.**
- `emailEnabled` — honored by the alert cron (`app/actions/saved-search-alerts.ts:204-215`).
- "Saved search matches" cadence — fans out to every `listing_alerts` row via `setListingAlertFrequencyForUser` (`listingAlerts.ts:470-484`) and mirrors to profile. Real.
- Market report prefs — loads via `getMyReportSubscriptionAction` on mount (skeleton, error state), saves explicitly. Real subsystem.

**What is placebo.** `priceDropAlerts`, `statusChangeAlerts`, `openHouseReminders`, `marketDigestFrequency`, `blogUpdates` are written to `profiles.notification_preferences` and **read by no sender** — grep across app/lib finds consumers only in `profile.ts` (type), `saved-search-alerts.ts` (`emailEnabled` only), and the prefs component itself. Five of eight controls do nothing.

**Other defects.**
- Auto-save per toggle: each flip re-writes the whole prefs object (`DashboardNotificationPrefs.tsx:215-228`); rapid toggles issue overlapping writes with no versioning — last-response-wins can drop an earlier change. Errors show nothing at all (only success sets "Saved").
- Conceptual overlap the copy itself has to apologize for: global kill switch vs per-search pause vs per-email one-click token (`notifications/page.tsx:46-56`). A paused-globally user still sees each search "On" on the saved-searches page (the cron skips them silently; `is_active` untouched).
- Cadence overlap: per-search Select on /account/saved-searches vs global fan-out here — flipping the global control silently overwrites every per-search choice ("This applies to every search you have saved", `DashboardNotificationPrefs.tsx:277`).

**Verdict: partial (three real controls, five placebo).**

### 2.8 `/account/buying-preferences` (+ `BuyingPreferencesForm.tsx`)

Works. Single-card form, clamped server-side (`buying-preferences.ts:52-57`), explicit save with saved/error message. Feeds payment estimates on tiles and "Homes for You". Minor: silent value coercion (server clamps without telling the user), `router.refresh()` on a page that doesn't display derived output. **Verdict: works.**

### 2.9 `/account/profile` (+ `ProfileForm.tsx`)

Works. Display name + phone; email shown read-only with correct provider explanation. Saved/error feedback inline. Minor: no phone format validation (raw string to DB, `profile.ts:79`); `profiles.buyer_preferences` field exists in the action types but no UI writes it — dead schema surface. **Verdict: works.**

### 2.10 `/account/error.tsx`, `loading.tsx`

Present and reasonable (retry button; skeleton). Sub-pages `history`, `collections`, `notifications` carry their own `loading.tsx`; `saved-homes`, `saved-searches`, `saved-cities`, `saved-communities`, `profile`, `buying-preferences` do **not** — nav between tabs shows the layout with a blank content well on slow loads for the majority of tabs.

### 2.11 `/dashboard/**` — the duplicate shell

`/dashboard` (page) and all seven feature sub-pages are now pure redirects into /account (`app/dashboard/page.tsx:10-12`, `saved/page.tsx`, `searches`, `likes`, `settings`, `collections`, `history`, `notifications`). **But:**
- `app/dashboard/layout.tsx:6-32` still runs auth + `getProfile()` + renders `DashboardShell` (a second, different account chrome, `components/dashboard/DashboardShell.tsx`, 133 lines) around children that immediately redirect — wasted fetch + dead shell on every hit.
- `/dashboard/marketing` + `/dashboard/marketing/inbox` are **admin** surfaces (service-role reads, admin-gated — `dashboard/marketing/page.tsx:1-20`) living inside the consumer dashboard namespace. Route-tree confusion for both audiences.
- `resetPasswordForEmail` still defaults its post-reset redirect to `/dashboard/settings` (`app/actions/auth.ts:181`) — lands on a redirect page.

**Verdict: dead namespace kept alive by a layout that still does work, plus two admin pages squatting in it.**

---

## 3. The anonymous → signed-in funnel

### 3.1 Entry points to "Save" and what each actually does

| Surface | Component | Signed-in | Anonymous |
|---|---|---|---|
| Search filter bars (list + map + sheet) | `SaveSearchButton` (`components/SaveSearchButton.tsx`, rendered at `app/search/[...slug]/page.tsx:910`, `SearchFilterBar.tsx:611`, `search/SearchFilters.tsx:579`) | Name popover → `createSavedSearch` → `listing_alerts` | Email popover → `submitSearchAlertSignup` (guest alert + CRM lead) |
| Guest alert strip on /search | `SearchAlertCapture` (`components/search/SearchAlertCapture.tsx:95-149`) | hidden | email capture, honeypot, rate-limited (`app/actions/search-alert-capture.ts`) |
| Listing detail CTA row | `PriceCtaStrip` (`components/site/listing-detail/PriceCtaStrip.tsx:125-140`, wired `app/listing/[listingKey]/page.tsx:203-209,405`) | server-action toggle | redirect `/account?signin=1&returnUrl=…` (broken, §3.2) |
| Result tiles (map/split view, sliders) | `ListingTile` bookmark via `CardActionBar` (`ListingTile.tsx:545-552`) | toggle, optimistic, no error check | `goToLogin` → `/login?returnUrl=…` (param ignored, §3.2) |
| Geo-page bar cards | `ListingBarCard.tsx:100-113` (save + like) | toggle | goToLogin |
| Activity feeds | `activity/ActivityFeedCard.tsx:131`, `geo-page/ActivityFeedCard.tsx:117` (like) | toggle | varies |
| Search list-view grid cards | `components/site/ListingCard.tsx` | **no save affordance at all** ("No like/favorite on tiles — liking is detail-page only", `ListingCard.tsx:9-11`) | none |

So: on the default search results grid a signed-in user **cannot save a home at all** — they must open each listing. The map/split view CAN save from tiles. Desktop and mobile list views differ from map view in capability, not just layout.

### 3.2 The broken return loop (three conventions, zero completions)

1. `PriceCtaStrip.handleSave` → `/account?signin=1&returnUrl=<listing>` (`PriceCtaStrip.tsx:130-134`). Nothing consumes `signin` or `returnUrl` (repo grep). `/account` layout bounces to `/login?next=<x-pathname>` where middleware's `x-pathname` is **pathname only** (`middleware.ts:316-319`) → next = `/account`. After sign-in the user lands on the account hub. The listing is not saved; the listing page is lost.
2. `ListingTile.goToLogin` → `/login?returnUrl=…` (`ListingTile.tsx:214-219`), but the login page reads only `next` (`app/login/page.tsx:19-23`) → post-login destination `/account`. Same dead end.
3. `SignInPrompt` modal passes `next` correctly from the URL (`SignInPrompt.tsx:124-129`), and `/auth/callback` honors the `auth_next` cookie — this path returns you to the page, but **still doesn't perform the save you clicked**.
No variant re-executes the intended save after auth. The single highest-intent moment on the site (visitor tries to save) ends on an unrelated page with nothing saved.

### 3.3 Auth surfaces (four of them, one dead)

- `/login` page (`LoginForm.tsx`): Google + Facebook + email/password. No signed-in redirect — a signed-in user who clicks the header's permanent "Sign in" sees the form again.
- `/signup` (`SignupForm.tsx`): handles `needsConfirmation` correctly.
- `SignInPrompt` auto-modal (mounted globally, `app/layout.tsx:138`): Google + Facebook only; sensible suppression rules (`SignInPrompt.tsx:100-122`).
- `AuthModal` (`components/auth/AuthModal.tsx`, used by `ListingValuation` + `NotFoundClient`): **ignores `needsConfirmation`** — email signup that requires confirmation closes the modal with zero feedback (`AuthModal.tsx:64-89`; the exact P1 the comment in `auth.ts:158-165` says was fixed — fixed only in SignupForm).
- `AuthDropdown` (`components/AuthDropdown.tsx`, 283 lines incl. the entire signed-in account menu): **zero importers. Dead.** Its death is why the header has no account state (§3.4).

### 3.4 Site chrome has no signed-in state

`components/site/SiteHeader.tsx:83-119` renders a static "Sign in" CTA (desktop `:96-98`) and `MobileNav` bottom "Sign in" button (`MobileNav.tsx:165-170`). No session read, no avatar, no "My account", no saved-homes shortcut, on any viewport. The infra to do it cheaply exists (`/api/auth/me`, used by `SignInPromptWithSession`) but the header never uses it. **The account area is a destination with no door.**

### 3.5 OAuth callback vs password paths — identity stitching asymmetry

`/auth/callback` (OAuth + magic-link + recovery) does four things after session exchange (`app/auth/callback/route.ts:133-158,167-184`): CRM person tracking, avatar capture, `rr_pid` cookie stamping (`:30-65`), and **guest alert claim** `claimGuestSearchesForUser` → stamps `user_id` on active `listing_alerts` rows matching the verified email (`lib/data/leads/listingAlerts.ts:357-386`, idempotent, opt-out-respecting — well-built).
`signInWithEmailPassword` / `signUpWithEmailPassword` (`app/actions/auth.ts:94-167`) do **none of that** (only FUB-successor tracking). Consequences:
- Guest alerts never attach for password users → `/account/saved-searches` empty while emails continue (`getSavedSearches` filters `user_id`, `saved-searches.ts:78-99`). The user's only recourse is the per-email token link.
- `rr_pid` attribution cookie never stamped for password users.
- Additional risk: the callback handles only `code` and `token_hash` of type `magiclink|recovery` (`route.ts:162`); an email-confirmation link of type `signup` that lands here falls through to `/auth-error?message=Could not sign in` (`route.ts:188`). Not runtime-verified, but no code path handles it.

---

## 4. Alert delivery (the working spine)

**Create.** Signed-in: `createSavedSearch` normalizes filters, hashes, prewarms cache, upserts `listing_alerts` keyed (email, filters_hash) with resurrection guard (never re-activates an explicit opt-out — `listingAlerts.ts:92-105,129-146`), then native CRM lead capture + canonical buyer tagging (`saved-searches.ts:154-189`). Guest: `submitSearchAlertSignup` — honeypot, fail-closed per-IP rate limit, email validation, narrowing-filter guard so nobody subscribes to "every home" (`search-alert-capture.ts:36-100`), lead + task + GA4 mirror.

**Send.** Cron hourly (`vercel.json:128`, schedule `0 * * * *`) → `runListingAlerts` (`app/actions/saved-search-alerts.ts:142-393`): most-overdue-first queue, 200-send cap, per-row cadence gate, hard-stop compliance + suppression checks, `emailEnabled` honor, empty-filter guard, **seen-set diff** (`notified_listing_keys`) so price-drops-into-range alert but nothing re-blasts, broker-identity sender + reply-to, RFC 8058 one-click unsubscribe headers, `email_events` measurement row, loud logging when the notified stamp fails after a send. This is the best-engineered consumer code in the domain.

**Weaknesses.**
- N+1 inside the loop: per-row `profiles` fetch (`:204-215`) + `resolvePersonForTracking` + `getCachedSearchListings` — up to 600 rows/run sequential. Fits `maxDuration 300` today; scales linearly with subscriber growth.
- Only the top-15 cached page is diffed (`:229`) — a search matching >15 new homes in an hour under-reports (mitigated by "+N more" only when fresh > 12).
- "Instant" = hourly (§2.3).

**Unsubscribe.** `/alerts/unsubscribe` page POST-confirms (prefetch-safe) → token deactivation (`app/alerts/unsubscribe/page.tsx:21-29`); `/api/alerts/unsubscribe` handles the one-click POST. Single token namespace post-unification. Solid.

**Broker mirror.** Same table: Contact-360 panel reads `getContactListingAlerts` → `getListingAlertsForLead` matching user_id / crm_person_id / fub id / any email (`getContactListingAlerts.ts:189-202`, `listingAlerts.ts:212-241`). **True shared source of truth for alerts.** In contrast, **saved homes / likes / collections / cities / communities are invisible to the broker** — no admin reader exists (grep `saved_listings|likes` in `components/admin`, `app/admin`, `lib/data/crm`: zero) — the strongest buyer signal the site collects never reaches the CRM UI.

---

## 5. Defect register (consolidated, evidence-first)

| # | Sev | Defect | Evidence |
|---|---|---|---|
| 1 | critical | Viewing history reads `user_activities`; nothing writes it — history + hub Recently-viewed permanently empty | `app/actions/dashboard-history.ts:17-24,35-42`; repo grep `from('user_activities')` → only that file; migrations `20260309100006` create-only |
| 2 | critical | No signed-in account entry in site chrome; header always "Sign in"; AuthDropdown (account menu) orphaned; /login doesn't redirect signed-in users | `components/site/SiteHeader.tsx:96-98`; `components/site/MobileNav.tsx:165-170`; grep AuthDropdown → 0 importers; `app/login/page.tsx` (no session check) |
| 3 | critical | Save-intent funnel: 3 return-URL conventions, none completes; intended save never happens post-auth | `PriceCtaStrip.tsx:130-134`; `ListingTile.tsx:214-219` vs `app/login/page.tsx:19-23`; `middleware.ts:316-319`; grep `signin=1`/`returnUrl` consumers → none |
| 4 | high | Password sign-in/up skips guest-alert claim + rr_pid stamp (OAuth only) → empty saved-searches for password users who subscribed as guests | `app/auth/callback/route.ts:154-157,180-183` vs `app/actions/auth.ts:94-167` |
| 5 | high | Like system incoherent: canonical like UI (ListingActions/LikeButton/SaveListingButton) orphaned; detail page has no Like; CardActionBar drops the like prop by design; only geo/activity cards write likes — yet likes still feed the saved-homes union | grep imports → 0 for all three; `ui/CardActionBar.tsx:17-19`; `PriceCtaStrip.tsx` (no like); `ListingBarCard.tsx:106-113` |
| 6 | high | 5 of 8 notification toggles have no sender (price-drop, status-change, open-house, market-digest, blog); empty states promise price-drop/status alerts on saved homes | grep flags → only `profile.ts`, `saved-search-alerts.ts` (emailEnabled), prefs component; promises at `account/page.tsx:151`, `saved-homes/page.tsx:68` |
| 7 | high | Saved-home remove can silently fail across stores (canonical key vs raw key asymmetry); like counter decrements without increments | `saved-listings.ts:44,58` vs `likes.ts:35-38,47-53`; `engagement.ts:52` never called from likeListing |
| 8 | high | "Public search / Popular searches" is a UI checkbox writing into a void — no page renders `getPopularPublicSearches` | `SaveSearchButton.tsx:172-181`; `saved-searches.ts:130-146,378-417`; grep consumers → only `/api/public-search/click` (itself unreachable) |
| 9 | medium | Collections `share_token` dead (no route), Math.random-generated; "shareable" doc claim false | `collections.ts:18-20,31,206-213`; grep share_token → actions file only |
| 10 | medium | Collections listing_keys read-modify-write race | `collections.ts:70-93,112-126` |
| 11 | medium | `toggleSavedListing` reports `saved:true` with a non-null error; tiles set optimistic state without checking error | `saved-listings.ts:69-77`; `ListingTile.tsx:288-295` |
| 12 | medium | Search page saved/liked hydration under 600 ms timeout → signed-in users can render as not-saved on slow DB with no indication | `app/search/[...slug]/page.tsx:525-533` |
| 13 | medium | Guest save on preset paths mis-captures preset slug as `subdivision` (e.g. `/homes-for-sale/bend/under-750k` → subdivision="under-750k") in `SaveSearchButton.buildFilters`; the sibling `SearchAlertCapture` solved this with server-passed defaults | `SaveSearchButton.tsx:45-51` vs `SearchAlertCapture.tsx:100-146` |
| 14 | medium | AuthModal ignores `needsConfirmation` → silent close on confirm-required signup | `AuthModal.tsx:64-89` vs `auth.ts:158-165` |
| 15 | medium | Search-results grid (list view) has no save affordance at all; map view tiles do — capability forks by view mode | `components/site/ListingCard.tsx:9-11`; `ListingTile.tsx:545-552` |
| 16 | medium | `result_count` hard-coded null → no match counts anywhere in account | `saved-searches.ts:93-95` |
| 17 | medium | /dashboard layout still auths + fetches profile + renders a second shell around pure-redirect children; admin marketing pages live in the consumer namespace | `dashboard/layout.tsx:6-32`; `dashboard/marketing/page.tsx:1-20` |
| 18 | low | Alert-cron per-row profile/person/search queries (N+1, up to 600 rows) | `saved-search-alerts.ts:158-229` |
| 19 | low | "Instant" cadence is hourly | `vercel.json:128`; `saved-search-alerts.ts:79` |
| 20 | low | `profiles.buyer_preferences` written by nothing; `resetPasswordForEmail` defaults to a redirect page (`/dashboard/settings`) | `profile.ts:15-24` grep; `auth.ts:181` |
| 21 | low | Six of ten account tabs lack loading.tsx; remove buttons ignore action errors | `app/account/*` tree; `RemoveSavedButton.tsx:18` etc. |
| 22 | low | Community "like" persists to `community_likes` shown nowhere in account | `community-engagement.ts:126`; `saved-communities/page.tsx:22` |

---

## 6. Duplication map

- **Two "homes I care about" stores** (`saved_listings` + `likes`) merged at read time in 3 places with 3 slightly different key strategies (`account/page.tsx:80-86`, `saved-homes/page.tsx:36-41`, `dashboard-likes.ts:49-50`).
- **Two saved-search tables** (`listing_alerts` live + `saved_searches` zombie/public-mirror).
- **Two community-affinity stores** (`saved_communities` + `community_likes`) with two buttons on one tile.
- **Four view-tracking systems** (GA4 events, `listing_views`, `listings.view_count`, `user_events`) plus the dead `user_activities` the UI reads.
- **Four auth UIs** (login page, SignInPrompt modal, AuthModal, dead AuthDropdown) with three provider sets and two return-param conventions.
- **Two account shells** (`/account` layout+AccountNav vs `/dashboard` layout+DashboardShell) — the latter wrapping only redirects.
- **Two guest save-search capture paths** (`SaveSearchButton` guest branch vs `SearchAlertCapture`) with divergent path-parsing correctness.
- **Two cadence controls** (per-search vs global fan-out) that overwrite each other.

## 7. Dead / orphaned inventory

- `components/AuthDropdown.tsx` (283 lines, incl. the only signed-in account menu ever built) — 0 importers.
- `components/listing/ListingActions.tsx`, `components/listing/LikeButton.tsx`, `components/listing/SaveListingButton.tsx` — 0 importers (stale doc references in `CardActionBar.tsx:17` and `SaveListingButton` comments).
- `user_activities` read path (`dashboard-history.ts`) — table has no writer.
- `saved_searches` public feature: `getPopularPublicSearches`, `trackPublicSearchClick`, `/api/public-search/click`, `setSavedSearchPublicState`, `refreshSavedSearchCache`, the `isPublic` checkbox — no rendering consumer.
- `listing_collections.share_token` — no consuming route.
- `profiles.buyer_preferences` — no writer.
- `/dashboard/*` consumer namespace — 8 redirect stubs + a live layout + shell.
- CardActionBar `like` prop — accepted, never rendered (`ui/CardActionBar.tsx:52-58,93-102`).
- `/api/cron/neighborhood-default-subscriptions` — manual-trigger only by directive (not dead, but unscheduled; `route.ts:4-16`).

## 8. Mobile vs desktop divergence

- Header: mobile buries "Sign in" at the bottom of the nav sheet (`MobileNav.tsx:155-171`); desktop shows it inline; **neither** shows account state when signed in.
- Listing detail: the dead `ListingActions` had a mobile fixed bottom bar vs desktop sticky top bar fork; the live `PriceCtaStrip` renders one layout (full-width primary + 3-col grid on mobile, `PriceCtaStrip.tsx:238-243`) — parity OK.
- Search: list view (no card save) vs map/split view (tile save) — on mobile, where map view is the more common browse mode, save exists; on desktop list view it doesn't. Capability, not styling, forks.
- AccountNav: 10 pills in an overflow-x scroll on mobile with no scroll cue (`AccountNav.tsx:29-31`).
- SaveSearchButton popover: hand-rolled absolute `w-72` panel (not a Dialog/Sheet) anchored to the button (`SaveSearchButton.tsx:150-156`) — on narrow viewports it can clip; the guest email field autofocuses inside it triggering keyboard jump.

## 9. Performance notes

- `/account` hub: ~13+ sequential/parallel DB round trips, force-dynamic, no cache (§2.1). Every tab repeats `getSession` (request-memoized via `cache()`, `auth.ts:50-63` — good) plus its own reads.
- `getListingsByKeys` doubles every tile fetch (ListingKey + ListNumber keyspaces) to paper over inconsistent key storage (`listings.ts:2504-2523`).
- `getDashboardLikesData` fetches full city + community indexes to hydrate names even when the caller uses only listings (`dashboard-likes.ts:52-68`).
- `toggleSavedListing` = 3 sequential server round trips per tap (isSaved → canonical resolve → insert/delete + counter) with no client optimism except in tiles (which don't check errors).
- Alert cron N+1 (§4).
- Search page's 600 ms `withTimeout` on saved/liked keys trades correctness for TTFB silently (§5.12).

## 10. Job click-costs (as built)

- **Save a home from search (desktop list view):** open listing (1) → Save (2) → [if anonymous: login page (3), sign in (4), land on /account (5), re-find the listing via search again (6-8), Save again (9)]. Signed-in: 2 clicks. Anonymous: ~9, with the save re-do.
- **Save a search:** Save this search (1) → name it (2) → Save (3). Feedback "Saved." in a popover; no link to manage it.
- **Change one search's alert frequency:** /account (URL-typed, since no chrome entry) → Saved searches tab (2) → cadence Select (3-4). Fine once you're there; getting there is the problem.
- **Stop all email:** /account/notifications → one Switch. Works (cron honors it), but the per-search switches still read "On".
- **Group homes into a collection:** save each home from its detail page (2 clicks/home) → Collections tab → New collection (name, create: 3) → open it → "Add" per home (1/home). No batch add, no add-from-listing.
- **See why "0 recently viewed":** impossible — the feature is dead (§2.6).

---

## Appendix: files read (primary evidence set)

`app/account/*` (all 24 files), `app/dashboard/*` (layout + 9 pages), `app/actions/{saved-searches,saved-listings,likes,saved-cities,saved-communities,collections,dashboard-likes,dashboard-history,buying-preferences,profile,auth,search-alert-capture,saved-search-alerts,track-user-event,listing-views,export-my-data}.ts`, `lib/data/leads/listingAlerts.ts`, `lib/data/savedSearches.ts`, `lib/data/crm/getContactListingAlerts.ts`, `app/api/cron/saved-search-alerts/route.ts`, `app/api/cron/neighborhood-default-subscriptions/route.ts`, `app/api/listings/[listingKey]/track/route.ts`, `app/api/auth/me/route.ts`, `app/auth/callback/route.ts`, `app/login/page.tsx`, `app/alerts/unsubscribe/page.tsx`, `components/{SaveSearchButton,AuthDropdown,SignInPrompt,WelcomeBanner,ExportMyDataButton,ListingTile}.tsx`, `components/search/SearchAlertCapture.tsx`, `components/listing/{SaveListingButton,LikeButton,ListingActions}.tsx`, `components/site/{SiteHeader,MobileNav,ListingCard}.tsx`, `components/site/listing-detail/PriceCtaStrip.tsx`, `components/ui/CardActionBar.tsx`, `components/dashboard/{DashboardNotificationPrefs,CreateCollectionForm,CollectionDeleteButton,CollectionListingButton,RemoveViewedButton}.tsx`, `components/auth/{LoginForm,AuthModal}.tsx`, `components/account/AccountNav.tsx`, `components/geo-page/ListingBarCard.tsx`, `app/search/[...slug]/page.tsx` (targeted), `app/listing/[listingKey]/page.tsx` (targeted), `middleware.ts` (targeted), `vercel.json`, `supabase/migrations/20260309100006_006_user_engagement.sql`, `docs/DATABASE_SCHEMA_SNAPSHOT.md` (targeted).
