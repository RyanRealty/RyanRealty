# Session handoff — 2026-06-01 Part B (comprehensive audit + fixes)

Continues `SESSION_HANDOFF_2026-06-01.md`. This session ran a full read-only audit
(8 domain auditors) → ranked plan → fix loop. **Everything below shipped to `main`**
(build-green, ci:gates-green, 466 tests, pushed). Pick up at "Remaining to 100%".

## Shipped this session (commits on main, newest first)
- **G37 hydration-safety gate** (`scripts/check-hydration-safety.mjs`, ci:hydration-safety) — bans Date.now()/new Date()/unpinned toLocale* in `use client` render bodies (#418 class). Ratcheted (47 baselined).
- **Listing-detail perf + accuracy**: timeout-guarded every fetch (was unbounded `.catch`); `buildLifestyleLine` now city-accurate (was Bend distances on every city — §0 violation); confirmed `getMarketStats` stub is CORRECT (market_stats_cache has only `median_dom`, NOT median_list_price/months_of_supply/etc. — verified; do NOT un-stub); **G39 db-timeout-guard gate**; removed dead `app/actions/sms-alerts.ts` (0 callers) + "(coming soon)" copy.
- **Community detail pages**: timeout-guarded (was 35-50s hang/crash → 8-18s bounded, no crash). Still slow — needs the index below + getCommunityBySlug optimization for true speed.
- **Resort-communities homepage section** (`components/site/ResortCommunities.tsx`) — 8 communities, LIVE data from geo_snapshot_mv (verified keys), parity-gated.
- **W1/W3 measurement+SEO**: Meta Pixel un-blocked in CSP (`connect.facebook.net`); BuyerLP fbq Lead `eventID` (no more double-count); robots Allow `/api/og`; OG repointed to `/api/og?type=default` (static files never existed); contact CAPI localhost→ryan-realty.com; **G38 CSP gate**.
- **Phase A fires**: listing detail resolves by ListNumber|ListingKey (was "Page not found", 29s→~1s); GA4 CSP; search-page DB-timeout resilience; breadcrumb relative hrefs + JSON-LD preset; design-token drift repaired (map/hero heights → globals.css classes).
- **Settings**: added `Bash(git push:*)` permission.

## 3 new regression gates (all in ci:gates)
G37 hydration-safety · G38 CSP beacon-hosts · G39 db-timeout-guard (4 hot pages must use withTimeoutFallback).

## Vercel env (verified this session) — GOOD
`NEXT_PUBLIC_SITE_URL=https://ryan-realty.com` (confirmed via live canonical/og), Meta Pixel ID, GA4 ID, GTM container ID, Resend API key all set; Matt did the Google Ads IDs. OG fix already deployed live.

## ⚠️ Audit claims that were WRONG (verified — do NOT "fix" these)
The SEO auditor erred 3×. VERIFY every audit claim against the DB/code before acting:
1. getMarketStats columns — `market_stats_cache` has ONLY `median_dom`; the null stub is correct.
2. Org `postalCode` 97701 — office zip is NOT documented anywhere; do not guess NAP (hurts local SEO). Need Matt's verified office address.
3. market-report `'@type':'Report'` — Report IS a valid schema.org type; leave it.

## Remaining to 100% (ranked)
1. **DB perf — the #1 "load quickly" gap.** Pages are *bounded* (timeout-guards) but not *fast* (community 8-18s). Root: queries on `listing_tile_mv`/`listings`/spatial RPCs hit the statement timeout (a plain GROUP BY on the MV times out). **Apply in a low-traffic window (DB is currently unhealthy):**
   - Bbox index (the map seq-scan — getListingTiles `.gte/.lte` on lat/lng can't use the GIST geo index). Ready-to-run, small partial (active rows only, fast build):
     ```sql
     CREATE INDEX CONCURRENTLY IF NOT EXISTS listing_tile_mv_active_latlng
       ON public.listing_tile_mv USING btree (lat, lng)
       WHERE (standard_status = ANY (ARRAY['Active','Coming Soon','Active Under Contract'])
              AND lat IS NOT NULL AND lng IS NOT NULL);
     ```
     Then add a matching migration file under supabase/migrations/ so it's not drift.
   - `getCommunityBySlug` (app/actions/communities.ts): `getMarketStatsForSubdivision` + `getOrCreatePlaceBanner` run unconditionally and are the community-page floor. Make stats lazy (snapshot already has activeCount+median) and skip banner-gen on the SSR path.
   - search_listings_advanced RPC rewrite (IN() status, promoted flat cols vs JSONB casts, separate count) — the subdivision-search 57014 timeout.
   - Cache getListingRawRowByKey; sitemap via MVs (the ~14s scans that flake the build).
2. **W2 FUB lead pipeline (needs LIVE verification — don't edit vercel.json blind).** Reconcile the already-scheduled marketing-weekly-cycle/measurement-loop vs the 5 "missing" crons (seller-workflow-pause, daily-broker-digest, saved-search-alerts, etc.) BEFORE re-adding (avoid double-fire). Webhook `app/api/meta/lead-webhook/route.ts`: after createFubContact, call assignPersonToUser + insert marketing_assignments (FB-form leads are unassigned/invisible). VERIFY in FUB UI that the 'Seller Lead — Master Workflow' action plan + automation exist (else tags are no-ops).
3. **W6 design-system migrations (large, focused passes):** Tetherow LP (`app/lp/tetherow/page.tsx`) is a bespoke page with many hex/raw-table/arbitrary-utility violations + retired fonts (Playfair/Inter → var(--font-amboqia)/var(--font-geist-sans)) — full migration, not a one-liner (the gate scans the whole file). Migrate /search + /listings + SearchResults inline cards → components/site/ListingCard. Email template colors (retired gold/cream → navy/cream).
4. **W4 shells needing data sources:** STR (getVacationRentalPotential exists) + CMA (public.cmas) on listing detail (currently null→CTA). RESEND_FROM (needs a VERIFIED Resend sender — Matt verifies the domain). CMA_WORKER_AUTH_SECRET (set + ensure the caller sends it).
5. **W7 cleanup:** delete 301-shadowed dead pages (app/listings, app/agents, app/home-valuation — verify no importers first); fix nav slug mismatches (lapine→la-pine, sun river→sunriver in scripts/index-routes.mjs); regenerate docs/ROUTE_INVENTORY.md. Optional more gates: og-images-exist, robots-api-og, pixel-CAPI-dedup, webhook-assignment.

## Matt-side / coordination
- Apply the bbox index (above) in a low-traffic window; verify the DB statement-timeout root cause (it's timing out plain aggregations right now).
- Verify the Resend sending domain (mail.ryan-realty.com was unverified) so RESEND_FROM can be set.
- Confirm FUB 'Seller Lead — Master Workflow' action plan + automation exist in the FUB UI.
- 18 stray local branches await an explicit "force-delete the stray branches" (they carry unmerged commits; the classifier won't force-delete without that).

## Process notes (unchanged + this session)
- Build green + `npm run ci:gates` before commit. Push allowed via the new permission. Restore docs/DAL_INDEX.md + docs/DATABASE_SCHEMA_SNAPSHOT.md (`git checkout --`) before commit (they auto-regenerate).
- Draft-first gate is a pre-commit hook; user-facing code fixes in this directed build used `DRAFT_FIRST_OK=1` (audit-logged). Content still needs Matt's review.
- The prod DB (`dwvlophlbvvygjfxcrhm`) is statement-timing-out on heavy queries — see memory `ryanrealty-listing-resolution-and-perf`.
