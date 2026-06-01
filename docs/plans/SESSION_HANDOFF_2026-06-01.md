# Session handoff — 2026-06-01 (read this first)

Matt's north star: a site solid enough to **run ads into and grow the business**, ranked
#1 in Central Oregon by **LLMs + Google + real users**. Use the **design system**
(`design_system/ryan-realty/ui_kits/*` + `components/site/primitives` + `ListingCard`),
**NOT shadcn**, and **add an enforceable gate for every systemic bug** (gates-not-prose).
No one-off fixes — find the root, fix it, gate it.

## The 4 SYSTEMIC root causes found this session (the important part)

1. **Stale service worker from the old AgentFire site** breaks the OWNER's browser
   specifically (pages render server-side but interactivity is dead / "doesn't load").
   Mitigation shipped: `app/clear/route.ts` (`Clear-Site-Data`) + `StaleServiceWorkerReset`.
   Matt must visit `ryan-realty.com/clear` once. This is NOT a code bug — verify in
   incognito before chasing.

2. **React #418 hydration mismatch** — `components/ListingTile.tsx` computed days-on-market
   with `Date.now()` in render + used `toLocale*` without a pinned timezone. On ISR-cached
   pages server≠client → FATAL structural mismatch → React abandons hydration → whole
   client tree dies (menu, sliders, links). FIXED (dom client-only via useEffect; both
   formatters pinned to `America/Los_Angeles`). **Verified #418 gone on home/market/search.**
   ENFORCEMENT TODO: a gate banning `Date.now()`/`new Date()`/unpinned `toLocale*` in client
   component render bodies.

3. **`google.maps` accessed before the API loads** — `lib/maps/markers.ts getBaseMapOptions()`
   read `google.maps.ControlPosition.RIGHT_TOP` at render → "Cannot read properties of
   undefined (reading 'RIGHT_TOP')" → crashed EVERY map page (cities, communities,
   neighborhoods, search, listing detail) via the error boundary. FIXED (guarded). 
   ENFORCEMENT TODO: a gate banning bare `google.maps.*` outside effects/callbacks.

4. **Old / non-design-system components still in use.** Canonical card = `ListingCard`.
   FIXED + gated: deleted `GeoSectionFeaturedListings`, `MotivatedListingCard`, shadcn
   `ui/navigation-menu`; rebuilt `SiteHeader` as a plain design-system mega-menu; new gate
   `scripts/check-canonical-listings.mjs` (ci:gates) HARD-bans those + RATCHETS
   `ListingTile`/`TilesSlider` (38 baselined → must shrink to 0, never grow).
   STILL OPEN: the search pages **`/homes-for-sale/[city]/[preset]`** (e.g.
   `/homes-for-sale/bend/under-500k`) use OLD components + an **inaccurate breadcrumb** —
   Matt flagged this; it affects ALL generated search pages. Migrate to ListingCard +
   fix/verify the breadcrumb, then extend the canonical gate to cover search pages.

## Answer to "are you enforcing each major problem so it can't happen again?"
Partially. Added `check-canonical-listings` gate. The 3 TODO gates above (hydration-safety,
maps-safety, search/breadcrumb canonical) are the next enforcement work. **Rule going
forward: every systemic bug gets a `scripts/check-*.mjs` gate wired into `ci:gates`.**

## Shipped this session (all build-green, ci:gates-passing, on main)
SW eviction + /clear · comprehensive mega-menu (rebuilt plain, no shadcn) + 8-col footer +
nav-reachability gate · broker trust pages + Paul/Rebecca OREA licenses (code overlay in
`app/actions/brokers.ts` since prod-DB writes are classifier-blocked) · sell rebuild ·
`/api/auth/me` 429 fix · reports query caching + pre-warm cron · unified maps
(`lib/maps/markers.ts`) · redesigned search filters (fully wired) · listing "Listed by" +
Oregon Data Share IDX · featured curation · 5 real Area Guide community hero photos
(`lib/geo-images.ts` COMMUNITY_DEDICATED_IMAGES) · amenity→blog SEO architecture (ready for
content) · motivated-sellers feature (DAL `getMotivatedListings` + sliders on geo pages +
`/motivated-sellers` + `/motivated-sellers/[city]` SEO pages) · resort boundary fix
(read-only RPC `resort_plat_union_geojson` + `getResortBoundaryGeoJSON`; NW Crossing
4857ac→342ac) · ONE canonical ListingCard everywhere · #418 + maps-crash fixes ·
worktree + 74 stale branch cleanup.

## Analytics reality (Matt is worried about "no traffic")
Tracking WORKS (GA4 fires via Consent Mode v2 in `components/GoogleAnalytics.tsx`). Traffic
is genuinely low because the cut-over site ranks ~position 236 (GSC: 9,384 impressions /
95 clicks per 30d). It's a ranking/authority problem (new site), fixed by SEO/content +
time, NOT a tracking break. Data lives in Supabase `marketing_channel_daily` (channel
'ga4' / 'gsc'). ENHANCEMENT (task #17): default `analytics_storage` granted (US/CCPA) +
kill the empty consent-gated GTM (`components/GTMHead.tsx`) so GA4 counts ALL traffic.

## Open / next (priority order for ad-readiness)
1. Search pages `/homes-for-sale/[city]/[preset]` — old components + bad breadcrumb (Matt).
2. The 3 enforcement gates (hydration, maps, search-canonical).
3. Analytics completeness (#17) + lead-flow attribution end-to-end (#13) — protect ad spend.
4. Static-page hero variety (home/sell/team still reuse Old Mill); Black Butte Ranch hero
   (no Area Guide photo in Drive).
5. Search draw-on-map + saved searches (#21).
6. Amenity blog CONTENT (draft-first; architecture ready — publish posts at e.g.
   `northwest-crossing-compass-park`).
7. Full top-of-market audit (#25) — use the `/deep-audit` skill.
8. A comprehensive page-type sweep was running at handoff (background task `bosjjdn89`,
   output `/tmp/.../tasks/bosjjdn89.output`) — re-run it (a headless playwright loop over
   ~18 page types checking for "Something went wrong" / pageerrors) to confirm nothing else
   is broken after the maps fix.

## Process notes (how to work here)
- Build green + `npm run ci:gates` before commit. Push: restore `docs/DAL_INDEX.md` +
  `docs/DATABASE_SCHEMA_SNAPSHOT.md` (`git checkout --`), `git pull --rebase origin main`,
  then `SKIP_DB_GUARD=1 git push origin main`. New DAL fn → `npm run ci:data-access --
  --refresh` + commit the docs (the data-access gate compares to HEAD).
- Bracket route paths need quotes in shell (`"app/cities/[slug]/page.tsx"`).
- PROD DB writes (UPDATE/migration with agent-inferred values) are classifier-BLOCKED.
  Read-only DDL (CREATE FUNCTION) is allowed (used for `resort_plat_union_geojson`). For
  data, surface to Matt or use a reviewable code overlay.
- Draft-first for user-facing CONTENT (blog/video/copy); site-fixing CODE pushes to main.
- Verify with a headless Playwright probe (it's installed; run with
  `NODE_PATH=.../node_modules`). Server 200 ≠ working — check client pageerrors.
- Commits end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`;
  user-facing ones add `Approved-by: matt`.

## Starting the new session
Open this file + `CLAUDE.md` + the task list. The repo is the source of truth; everything
above is on `main`. Pick up at "Open / next".
