# Tracking & Analytics — Code Audit and How to Verify

This doc reflects what is **in the code** and how to **test** each piece. It does not change any code.

---

## 1. Google Analytics 4 (GA4)

| Aspect | Status | Details |
|--------|--------|--------|
| **Env** | ✅ Used | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` read in `components/GoogleAnalytics.tsx` (build-time). |
| **Loaded in app** | ✅ Yes | Root layout includes `<GoogleAnalytics />`; component loads `gtag.js` and runs `gtag('config', id)`. |
| **Page views** | ✅ Automatic | GA4 default behavior: page views and enhanced measurement (scroll, outbound click, etc.) work without extra code. |
| **Custom events** | ❌ Not implemented | No `dataLayer.push(...)` or `gtag('event', ...)` for listing view, search, save, contact, etc. Those would be needed for Priority 7 “GA4 full custom event implementation.” |
| **Cookie consent** | ✅ Gated | Scripts load only when user has accepted cookies (`hasTrackingConsent()` or after `cookie-consent` event with `detail === 'all'`). |

**How to verify**

- **Env:** In `.env.local` set `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-...`. Restart dev server after changing.
- **In browser:** Accept cookies (or set `ryan_realty_cookie_consent=all`), then open DevTools → **Network** → filter by `gtag` or `google`. You should see a request to `googletagmanager.com/gtag/js?id=G-...`. If you declined cookies, GA4 script does not load.
- **GA4 UI:** In [analytics.google.com](https://analytics.google.com) → Reports → Realtime, open your site in another tab; you should see 1 user.

---

## 2. Google Tag Manager (GTM)

| Aspect | Status | Details |
|--------|--------|--------|
| **Env** | ✅ Used | `NEXT_PUBLIC_GTM_CONTAINER_ID` in `GoogleAnalytics.tsx`. |
| **Loaded in app** | ✅ Yes | Same component injects the GTM snippet and noscript iframe when env is set. |
| **Data layer (custom)** | ❌ Not used | No app code pushes custom events to `window.dataLayer` (e.g. `listing_view`, `search`, `save`). GTM can still use built-in variables and GA4 config tag if you add them in GTM UI. |
| **Cookie consent** | ✅ Gated | Same as GA4; loads only after consent. |

**How to verify**

- **Env:** `NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-...` in `.env.local`.
- **In browser:** Accept cookies, then Network tab → filter `gtm.js`; you should see a request to `googletagmanager.com/gtm.js?id=GTM-...`.
- **GTM UI:** In [tagmanager.google.com](https://tagmanager.google.com) → your container → **Preview** → enter your site URL; confirm container loads and tags fire as configured.

---

## 3. Google AdSense

| Aspect | Status | Details |
|--------|--------|--------|
| **Env** | ✅ Supported | `NEXT_PUBLIC_ADSENSE_CLIENT_ID` in `GoogleAnalytics.tsx`; if set, AdSense script is loaded. |
| **Loaded in app** | Only if set | No AdSense ID in env by default, so script does not load. |
| **Cookie consent** | ✅ Gated | If you add the ID, script loads only after consent. |

**How to verify**

- **Env:** Add `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...` to `.env.local` and restart.
- **In browser:** Network tab → filter `adsbygoogle` or `googlesyndication`; you should see the script request when the ID is set.

---

## 4. Google OAuth (server-side API access)

| Aspect | Status | Details |
|--------|--------|--------|
| **Env** | ✅ Documented | `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in `.env.example` and (per your setup) in `.env.local`. |
| **Used in code** | ❌ No | No `googleapis` or `google-auth` usage anywhere. These vars are for future server-side calls (e.g. GA4 Data API, AdSense API). |

**How to verify**

- **Env:** Values present in `.env.local` (do not commit). Not needed for current tracking; only for future API integrations.

---

## 5. Follow Up Boss (FUB)

| Aspect | Status | Details |
|--------|--------|--------|
| **Auth** | ✅ Used | `lib/followupboss.ts` uses `FOLLOWUPBOSS_API_KEY` (server-side). |
| **Registration (sign-in)** | ✅ Yes | `trackSignedInUser()` called from `app/auth/callback/route.ts` and auth actions after Google sign-in. |
| **Viewed Page** | ✅ Yes | `trackPageView()` in `lib/followupboss.ts`; called from `app/search/[...slug]/page.tsx` for city/subdivision pages with `user` or `fubPersonId` from cookie. |
| **Viewed Property (listing page)** | ✅ Yes | `trackListingView()` called from `app/listing/[listingKey]/page.tsx` when `session?.user?.email` exists. |
| **Viewed Property (tile click)** | ⚠️ Available, not wired | `trackListingTileClick()` exists in `lib/followupboss.ts` but is not called from `ListingCard` or elsewhere. Listing page view is sent; card clicks are not. |
| **FUB identity bridge** | ✅ Yes | `FubIdentityBridge` in layout; reads `_fuid` (or custom param) from URL, calls `identifyFubFromEmailClick`, sets `fub_cid` cookie, strips param. Search page uses `getFubPersonIdFromCookie()` for anonymous “Viewed Page.” |

**How to verify**

- **Registration:** Sign in with Google → in FUB, confirm the person is created/updated and “Registration” (or equivalent) appears.
- **Viewed Page:** While signed in (or with `_fuid` in URL and cookie set), open a city or subdivision search page → FUB should show “Viewed Page.”
- **Viewed Property:** While signed in, open a listing detail page → FUB should show “Viewed Property.” (Anonymous users do not currently send “Viewed Property” from the listing page; only signed-in users do.)
- **Email-click ID:** Visit with `?_fuid=123` (replace with real FUB person ID) → cookie `fub_cid` should be set and param removed from URL; subsequent “Viewed Page” from search should attach to that person.

---

## 6. Cookie consent

| Aspect | Status | Details |
|--------|--------|--------|
| **Banner** | ✅ Yes | `CookieConsentBanner` in layout; stores `ryan_realty_cookie_consent` = `all` or `essential`; dispatches `cookie-consent` event. |
| **Visit tracking** | ✅ Gated | `VisitTracker` sends visits to Supabase (and optional webhook) only when `hasTrackingConsent()` is true; listens for `cookie-consent` to send visit after accept. |
| **GA4 / GTM / AdSense** | ❌ Not gated | Scripts load on first paint; they do not wait for consent. |

**How to verify**

- **Banner:** Clear cookie `ryan_realty_cookie_consent` and reload → banner appears; Accept sets cookie and hides banner.
- **Visit tracking:** Accept cookies → change page or trigger event → check `visits` table or webhook. Decline → no new visit records (after decline).

---

## 7. Meta Pixel

| Aspect | Status | Details |
|--------|--------|--------|
| **In code** | ❌ No | No Meta Pixel script, no `NEXT_PUBLIC_META_PIXEL_ID`, no `fbq()` calls. |

**How to verify**

- Not applicable until Pixel is added (e.g. in GTM or in a dedicated component reading env).

---

## 8. Data layer (for GTM / GA4 custom events)

| Aspect | Status | Details |
|--------|--------|--------|
| **Initialization** | ✅ Yes | GA4 config creates `window.dataLayer` and `gtag`; GTM uses the same `dataLayer`. |
| **Custom pushes** | ❌ No | No `dataLayer.push({ event: 'listing_view', ... })` or similar for listing view, search, save, contact, sign-up, etc. |

**How to verify**

- In console: `window.dataLayer` should exist after load. Pushing a test object and having a GTM tag fire on it would confirm GTM is listening (once you add the tag).

---

## 9. Summary table

| Element | In code? | Loaded / used? | Cookie gated? | How to test |
|---------|----------|----------------|---------------|--------------|
| GA4 | ✅ | ✅ | ✅ | Accept cookies → Network: `gtag/js`; GA4 Realtime |
| GTM | ✅ | ✅ | ✅ | Accept cookies → Network: `gtm.js`; GTM Preview |
| AdSense | ✅ | Only if env set | ✅ | Set env, accept cookies → Network: `adsbygoogle` |
| Google OAuth | Env only | ❌ | N/A | For future APIs |
| FUB Registration | ✅ | ✅ | N/A | Sign in → FUB person/event |
| FUB Viewed Page | ✅ | ✅ | N/A | Search page (signed in or fub_cid) |
| FUB Viewed Property (page) | ✅ | ✅ (signed-in only) | N/A | Open listing while signed in |
| FUB Viewed Property (tile) | ✅ | ❌ not wired | N/A | Would need call from ListingCard |
| FUB identity bridge | ✅ | ✅ | N/A | URL `?_fuid=...` → cookie + param removed |
| Cookie banner | ✅ | ✅ | — | Clear cookie → banner; Accept/Decline |
| Visit tracking | ✅ | ✅ | ✅ | Accept → visits; Decline → no visits |
| Meta Pixel | ❌ | ❌ | — | Not implemented |
| Custom data layer events | ❌ | ❌ | — | Not implemented |

---

## 10. Recommended next steps (optional)

1. **Cookie consent:** ✅ Done. GA4, GTM, and AdSense load only after the user accepts cookies.
2. **GA4 custom events (Priority 7):** Add `dataLayer.push(...)` or `gtag('event', ...)` for key actions (listing view, search, save, contact, sign-up) and configure GA4/GTM to use them.
3. **FUB tile click:** Call `trackListingTileClick()` from the listing card component when a user clicks through to a listing (with `userEmail` or FUB person from cookie if available).
4. **Listing view for anonymous:** Optionally send “Viewed Property” from the listing page for anonymous users when `getFubPersonIdFromCookie()` returns a value (same pattern as search page).
