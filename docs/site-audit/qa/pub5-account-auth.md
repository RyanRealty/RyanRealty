# PUB-5 — Account / Dashboard / Auth Audit

**Cluster:** Account, Dashboard, Auth flows, Private pages
**Date:** 2026-06-26
**Auditor:** Claude Code (read-only; no mutations made)
**Pages covered:** `/login`, `/signup`, `/forgot-password`, `/auth-error`, `/account` + all sub-routes, `/dashboard` + all sub-routes, `/alerts/unsubscribe`, `/newsletter/unsubscribe`, `/sign/[token]`, `/cma-drafts/[id]`

---

## Scores (1–5 per dimension)

| Dimension | Score | Verdict |
|---|---|---|
| A Functional | 3 / 5 | Core CRUD is real; auth redirects have several defects |
| B Statistics §0 | 4 / 5 | Counts are live; one stale-cache caveat |
| C SEO | 2 / 5 | CRITICAL — `/account/*` pages have no in-page noindex |
| D Indexability | 2 / 5 | CRITICAL — same gap; robots.txt is the only guard |
| E CRM tracking | 4 / 5 | Sign-in stitching real; no per-page FUB event |

---

## A — Functional

### PASS

- **Auth server actions real:** `signInWithEmailPassword`, `signUpWithEmailPassword`, `resetPasswordForEmail` all wire to Supabase auth with PKCE (`app/actions/auth.ts`). OAuth path via `getSignInUrl` → `signInWithOAuthBrowser` also correct.
- **All CRUD handlers real (no stubs):**
  - Saved listings: `toggleSavedListing` → `saved_listings` table
  - Saved searches: `createSavedSearch` / `updateSavedSearch` / `getSavedSearches` → `saved_searches` table
  - Collections: `createCollection` / `deleteCollection` / `addListingToCollection` / `removeListingFromCollection` → `collections` table
  - Profile: `updateProfile` → `profiles` table
  - Buying preferences: `saveBuyingPreferences` → `buying_preferences` table
  - Notification prefs: `updateProfile({ notificationPreferences })` — persists
- **`/dashboard/*` → `/account/*` redirect consolidation:** clean; Matt's 2026-06-14 "Option A" decision implemented correctly across all dashboard sub-routes.
- **`/alerts/unsubscribe` + `/newsletter/unsubscribe`:** both guard the mutation behind a form POST (not a GET), so email-client prefetch cannot auto-trigger unsubscribe. Correct.
- **`/sign/[token]`:** `getSigningSession(token)` is real (`app/actions/tc-sign.ts`), token-gated, `revalidate=0`. Handles all states (ready / waiting / completed / invalid).
- **`/cma-drafts/[id]`:** HMAC-verified delivery token (`lib/cma-delivery-tokens.ts:65`). Real service-role read from `cma_deliveries`.

### DEFECTS

**[A-1] HIGH — `app/auth-error/page.tsx:22` — wrong fallback redirect**

Non-admin auth errors redirect to `/?next=<encoded>` instead of `/login?next=<encoded>`. A user who hits an OAuth error from any non-admin protected page (e.g. `/account/saved-homes`) lands at the homepage when they click "Try again," losing their destination.

```
// current
href={`/?next=${encodeURIComponent(next)}`}
// should be
href={`/login?next=${encodeURIComponent(next)}`}
```

---

**[A-2] HIGH — `app/account/layout.tsx:9` — hardcoded wrong `?next=` on unauthenticated layout redirect**

The layout redirects all unauthenticated visitors to `/?next=/account/buying-preferences` regardless of which account sub-page they were trying to reach. Someone deep-linking to `/account/saved-homes` without being signed in will land on `/account/buying-preferences` after login.

```ts
// current (line 9)
redirect(`/?next=/account/buying-preferences`)
// should be
redirect(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`)
// (requires the layout to receive the request object — common Next.js middleware pattern)
```

---

**[A-3] MEDIUM — Most `/account/*` sub-pages use `redirect('/')` instead of `redirect('/login?next=<path>')`**

The layout guard fires first so these rarely run, but when they do the user loses their destination. Affected files:

| File | Line | Current |
|---|---|---|
| `app/account/saved-homes/page.tsx` | 25 | `redirect('/')` |
| `app/account/saved-cities/page.tsx` | 22 | `redirect('/')` |
| `app/account/saved-communities/page.tsx` | 17 | `redirect('/')` |
| `app/account/buying-preferences/page.tsx` | 14 | `redirect('/')` |
| `app/account/profile/page.tsx` | 15 | `redirect('/')` |

Correct pattern (used in `collections/[id]/page.tsx`):
```ts
redirect(`/login?next=/account/saved-homes`)
```

---

**[A-4] MEDIUM — `/dashboard/marketing` and `/dashboard/marketing/inbox` redirect unauthenticated users to `/auth-error` instead of `/login`**

An error page is not the right destination for an unauthenticated visitor. Should be `/login?next=/dashboard/marketing`.

Files: `app/dashboard/marketing/page.tsx`, `app/dashboard/marketing/inbox/page.tsx`

---

**[A-5] MEDIUM — `app/actions/auth.ts:164` — password reset default redirect is a double hop**

`resetPasswordForEmail` defaults to redirecting to `/dashboard/settings`, which 302s to `/account/profile`. The intermediate hop is unnecessary.

```ts
// current
safeRedirectPath(options?.next, '/dashboard/settings')
// should be
safeRedirectPath(options?.next, '/account/profile')
```

---

**[A-6] MEDIUM — `/account/notifications` "Unsubscribe from all" link is a dead end**

`app/account/notifications/page.tsx:49` links to `/alerts/unsubscribe` with no token. The unsubscribe page requires a token to identify the subscriber; without one it renders the "missing unsubscribe code" error state. In an authenticated context the server has enough identity to generate a token and include it in the URL.

---

**[A-7] LOW — `app/cma-drafts/[id]/page.tsx:201` — `dangerouslySetInnerHTML` on broker-generated HTML**

`email_body_html` is rendered without sanitization. The page is HMAC-gated (broker-only), so risk is low, but if `email_body_html` ever contains user-influenced content this becomes an XSS vector. Consider DOMPurify sanitization.

---

## B — Statistics §0

**PASS overall.** All four dashboard counters (`savedHomes`, `savedSearches`, `places`, `recentViews`) in `app/account/page.tsx` are derived from live server-action fetches in the same render. No hard-coded or cached-only counts.

**[B-1] LOW — `result_count` on saved searches is a pre-warmed cache column, not a live count**

`app/account/saved-searches/page.tsx` displays "X matches" from `saved_searches.result_count`, which is refreshed by a background job keyed to `cache_refreshed_at`. This is an architectural choice, not a fabricated stat, but the count can be stale between cache refresh cycles. Not a §0 violation, but worth noting in UI copy ("last checked" timestamp would add clarity).

---

## C/D — SEO / Indexability

### CRITICAL GAP: `/account/*` pages have no in-page noindex

Every `/account/*` page exports a `metadata` object with a `title` and `description` **but no `robots` field**. There is also no layout-level `export const metadata` that would apply a blanket noindex to the whole subtree.

The `robots.txt` (`app/robots.ts`) correctly disallows `/account/` for all crawlers, which is the primary and currently sole defense. However:

- If Googlebot ever caches a rendered response of an account page (rare but possible via stale cache or misconfigured CDN), there is no in-page `<meta name="robots" content="noindex">` to prevent indexing.
- Regulatory risk: if a search engine indexes `/account/saved-homes` for a logged-in session, private user data could appear in snippets.
- Best practice is defense-in-depth: `robots.txt` disallow + layout-level noindex metadata.

**Affected pages (all missing `robots: noindex`):**

| File |
|---|
| `app/account/page.tsx` |
| `app/account/saved-homes/page.tsx` |
| `app/account/saved-searches/page.tsx` |
| `app/account/profile/page.tsx` |
| `app/account/notifications/page.tsx` |
| `app/account/history/page.tsx` |
| `app/account/collections/page.tsx` |
| `app/account/collections/[id]/page.tsx` |
| `app/account/buying-preferences/page.tsx` |
| `app/account/saved-cities/page.tsx` |
| `app/account/saved-communities/page.tsx` |

**Fix:** Add to `app/account/layout.tsx`:

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

This blankets all sub-routes without touching each page file.

---

**[C/D-2] HIGH — `/dashboard/marketing` and `/dashboard/marketing/inbox` have zero metadata export**

No `title`, no `description`, no `robots`. The `robots.txt` disallow on `/dashboard/` provides protection, but these admin-level pages have no in-page fallback.

**Fix:** Add to `app/dashboard/marketing/layout.tsx` (or inline in each page):

```ts
export const metadata: Metadata = {
  title: 'Marketing — Ryan Realty Admin',
  robots: { index: false, follow: false },
}
```

---

### PASS — Auth pages

All four auth pages correctly export noindex metadata:

| Page | Location | robots value |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx:16` | `noindex, follow` |
| `/signup` | `app/(auth)/signup/page.tsx:16` | `noindex, follow` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx:8` | `noindex, follow` |
| `/auth-error` | `app/(auth)/auth-error/page.tsx:10` | `noindex, follow` |

---

### PASS — Utility pages

| Page | robots |
|---|---|
| `/alerts/unsubscribe` | `{ index: false, follow: false }` |
| `/newsletter/unsubscribe` | `{ index: false, follow: false }` |
| `/sign/[token]` | `{ index: false, follow: false }` |
| `/cma-drafts/[id]` | `{ index: false, follow: false }` |

---

### PASS — Sitemap

`app/sitemap.ts` contains no `/account/*`, `/dashboard/*`, `/login`, `/signup`, `/forgot-password`, `/sign/*`, `/cma-drafts/*`, `/alerts/*`, or `/newsletter/*` URLs.

---

### PASS — robots.txt

`app/robots.ts` disallows: `/admin/`, `/dashboard/`, `/account/`, `/api/`, `/auth/`, `/mockup-preview/` for all crawlers.

---

## E — CRM Tracking

### PASS — Sign-in stitching

`signInWithEmailPassword` (`app/actions/auth.ts:107`) and `signUpWithEmailPassword` (`:143`) both call `trackSignedInUser` → Follow Up Boss create-or-merge by email. Fire-and-forget (`catch(() => {})`), so a FUB failure never blocks auth. Correct pattern.

### PASS — Page view tracking (authenticated)

`VisitTrackerWithSession` in `app/layout.tsx:144` fires on every page including `/account/*`. It calls `/api/auth/me` client-side after hydration and passes `userId` + `userEmail` to `VisitTracker`, which writes to `visitor_sessions` / `visitor_events`. Authenticated account page views are tied to the user's identity in the visitor session table.

### INFO — No per-page FUB event on `/account/*` visits

Account sub-page visits do not fire a FUB `trackPageView`. This is intentional by architecture (FUB receives sign-in/sign-up events; page-level activity lives in `visitor_sessions`). The visitor session table IS stitched to the user identity, so the data exists — it just does not flow to FUB automatically. Not a defect, but worth noting if future FUB automation needs to trigger on "user viewed saved homes."

---

## `/account` vs `/dashboard` — Duplication verdict

**Not a duplication problem — correctly consolidated.** Every `/dashboard/*` route is a redirect shim to `/account/*`. The only live dashboard surfaces are `/dashboard/marketing` and `/dashboard/marketing/inbox` (admin-only; no `/account/` equivalent). The consolidation is clean. Dead links: none found — all redirect targets resolve.

---

## Defect Summary

| ID | Severity | Area | File | Description |
|---|---|---|---|---|
| A-1 | HIGH | Auth redirect | `app/auth-error/page.tsx:22` | Non-admin "Try again" → `/` not `/login` |
| A-2 | HIGH | Auth redirect | `app/account/layout.tsx:9` | Hardcoded wrong `?next=` on layout redirect |
| C/D-1 | HIGH | Noindex | `app/account/layout.tsx` (missing) | All `/account/*` pages have no in-page noindex |
| C/D-2 | HIGH | Noindex | `app/dashboard/marketing/page.tsx` | Zero metadata on admin marketing pages |
| A-3 | MEDIUM | Auth redirect | Multiple `/account/*/page.tsx` | `redirect('/')` loses destination; 5 files |
| A-4 | MEDIUM | Auth redirect | `app/dashboard/marketing/page.tsx` | Unauthed → `/auth-error` not `/login` |
| A-5 | MEDIUM | Auth UX | `app/actions/auth.ts:164` | Password reset default = double-hop |
| A-6 | MEDIUM | Dead link | `app/account/notifications/page.tsx:49` | "Unsubscribe all" link goes to token-less error state |
| B-1 | LOW | Stats | `app/account/saved-searches/page.tsx` | `result_count` is pre-warmed cache; can be stale |
| A-7 | LOW | Security | `app/cma-drafts/[id]/page.tsx:201` | `dangerouslySetInnerHTML` on broker HTML without sanitization |
