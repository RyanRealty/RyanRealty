# Session handoff — 2026-06-01 Part B (comprehensive audit + fixes)

Continues `SESSION_HANDOFF_2026-06-01.md`. This session ran a full read-only audit
(8 domain auditors) → ranked plan → fix loop. **Everything below shipped to `main`**
(build-green, ci:gates-green, 466 tests, pushed). Pick up at "Remaining to 100%".

## ⭐ NEXT SESSION — START HERE (Matt authorized all of this 2026-06-01: "yes do it all", "go until you are done")

**PROGRESS 2026-06-02 (5 items shipped to main this session):** ✅ item 0 Resend test (sent — but NO verified domain, real outbound to leads is broken; Matt-side DNS fix needed) · ✅ item 1 bbox index (live, EXPLAIN-verified) · ✅ item 2 FUB webhook assignment (core; cron reconciliation still open) · ✅ item 3 local branch cleanup (18 deleted; 11 remote branches need explicit OK) · ✅ item 4 dead-route cleanup (nav-slug claim was false). **REMAINING:** item 2 cron reconciliation, item 5 design-system migration (the big one), + the Matt-side items at the bottom.

Execute in this order. Each is already authorized — no need to re-ask. Build + `npm run ci:gates` + push to main after each landable unit.

0. **Resend test FIRST (Matt 2026-06-01: "resend should work, send a test").** Find the send path (`lib/` resend util / the seller-LP or CMA email route), confirm `RESEND_FROM` is set in Vercel env, send ONE test email to `matt@ryan-realty.com`, report the actual delivery result (id + inbox/spam). If it bounces on an unverified sender, that's the answer to surface — don't paper over it.

1. **bbox perf index — ✅ DONE 2026-06-02.** Applied to prod (`listing_tile_mv_active_latlng`, partial B-tree over active lat/lng, ~320 kB, `indisvalid=true`). EXPLAIN confirms `Index Scan` on viewport queries (was a 589K-row seq scan). Migration file committed at `supabase/migrations/20260602001900_listing_tile_mv_active_latlng.sql`. Note: MCP `apply_migration` returned "timed out" both attempts but the build actually committed server-side — verify via `pg_indexes` before retrying any prod DDL, the gateway response timeout is shorter than a build. Remaining DB-perf levers (getCommunityBySlug lazy stats, search_listings_advanced RPC rewrite, sitemap-via-MV) still open — see §1 of "Remaining to 100%".

2. **FUB webhook assignment — ✅ DONE 2026-06-02.** `app/api/meta/lead-webhook/route.ts` now calls `assignPersonToUser(personId, FUB_USER_MATT=1)` right after `createFubContact` and records a `marketing_assignments` row (audience from `parsed.audience`, broker `matt`, source `meta-lead-form`, tier from `parsed.intent`), mirroring the seller-LP `recordSellerAssignment` pattern. FB-form leads were landing unassigned/invisible — they now route to Matt (a Meta webhook is cookieless so attribution can't resolve; Matt is the correct default per directive; manual FUB reassignment still works). Type-checks + ci:gates green. **Runtime verification pending:** confirmed by reading the proven path, but the assignment only exercises on a real inbound FB lead — watch the next live lead in FUB. **STILL OPEN — cron reconciliation:** `vercel.json` schedules only `sync-delta` (15m) + `seller-lead-attribution` (daily 13:00 UTC). `seller-workflow-pause`, `daily-broker-digest`, `saved-search-alerts` route files exist but are NOT scheduled. Re-adding needs care (avoid double-fire) + a decision per the FUB docs — left for a focused pass.

3. **Force-delete the 18 stray local branches** (Matt: "force-delete the stray branches"). Repo has one checkout, main only. Delete all except `main`:
   `buyers-guide/setup-7dfc559a`, `claude/amazing-greider-45ace5`, `claude/bold-jennings-153e4b`, `claude/cool-germain-0668b1`, `claude/eager-heyrovsky-a93f19`, `claude/happy-hoover-36b3f5`, `claude/interesting-benz-a49da3`, `claude/keen-rubin-1a3116`, `claude/musing-liskov-6cca7b`, `claude/optimistic-lovelace-088fe3`, `claude/relaxed-almeida-3805f7`, `claude/vigilant-clarke-d64f50`, `listing-alerts/setup-8db9b9aa`, `optimizer-swarm`, `site-city-page/bend-ae5db590`, `site-community/tetherow-e7d4850f`, `site-listing-page/scaffold-cd99fed6`, `site-subdivision/tetherow-heath-3bf6b7d7`.
   (`git branch -D <name>` each. They carry unmerged commits — reflog-recoverable ~90d. This is why it needs the explicit OK, now given.)

4. **Safe cleanup — ✅ DONE 2026-06-02.** Deleted the 301-shadowed dead route surfaces: whole `app/listings/` (incl `[listingKey]/` + `template/`, 301→/homes-for-sale) and whole `app/agents/` (incl `[slug]/`, 301→/team); for `app/home-valuation/` (301→/sell/valuation) deleted page/error/loading ONLY and KEPT `ValuationForm.tsx` + `actions.ts` (imported by the live `app/sell/valuation/page.tsx` — verified). Confirmed zero external source importers, no parity/seo-route-contract deps, ci:gates green, route inventory regenerated (80 public routes). **Nav-slug claim was FALSE:** `scripts/index-routes.mjs` correctly derives slugs from `lib/cities.ts` (`'Lapine'`→`lapine`, `'Sun River'`→`sun-river`); the BuyerLPForm `la-pine`/`sunriver` strings are FUB lead-form area-interest values, NOT URLs — left untouched (changing them risks breaking FUB smart-list matching). No nav 404 existed.

5. **Design-system migration.** ✅ **Search cards DONE 2026-06-02:** `components/search/SearchResults.tsx` now renders the canonical `components/site/ListingCard` (was a bespoke inline card) — consistent site-wide look + now shows sqft. Verified the field flows: `ListingTileRow` gained `TotalLivingAreaSqFt?` (already populated at runtime by getListings/getViewportListings mappers + the search_listings_advanced RPC), hover-sync preserved via a `data-listing-key` wrapper div, tsc + ci:gates green. (`/listings` card migration is moot — route deleted in item 4.) **Tetherow LP — DECISION 2026-06-02: LEAVE AS-IS.** Matt confirmed the live LP is visually dialed (screenshotted desktop+mobile, hero/stats/photo all good). It was only ever flagged for SOURCE-CODE token compliance (raw hex + arbitrary brackets + Playfair/Inter fonts), NOT looks. The design-token gate only scans the file when edited, so there is NO active breakage and no user-facing reason to touch it. A full token-ladder rebuild (1709 lines, ~100+ arbitrary-bracket violations across px-/text-/py-/leading-/gap-) would risk degrading a working LP for zero user benefit — do NOT do it unless the page is being redesigned anyway. Only genuine (minor) brand note: Playfair/Inter vs Amboqia/Geist fonts; looks fine, optional. Reference color map if a rebuild ever happens: Exact map (8 distinct hex + 2 fonts):
   - `bg-[#f0ece3]` ×6 (warm panels: lines 583,627,650,1034,1159,1449) → `bg-muted` (confirm shade matches; else a cream token)
   - `#2d7a2d` ×2 (933 text, 1048 bg) + `#6fcf7a` ×1 (1215 checkmark) = success green → `text-success` / `bg-success text-success-foreground`
   - `#b25822` ×1 (935 text) = caution → `text-warning`
   - `#b8860b` ×2 (1050,1579 bg, GOLD-retired) + `#8b4513` ×1 (1581 bg) = stepper states → navy `bg-primary text-primary-foreground` (pick two distinct DS shades for the 2 step states)
   - `#102742` ×2 (1392,1394) + `#faf8f4` ×1 (1393) = correct brand navy/cream, inside the `<style jsx>` `--rr-*` var defs — likely allowlisted; if gate flags, reference DS tokens
   - fonts (1398-99): `--rr-font-display:'Playfair Display'`→`var(--font-amboqia)`; `--rr-font-sans:'Inter'`→`var(--font-geist-sans)`
   Note `text-[color:var(--rr-cream)]` etc. are token refs, fine. After edits run `npm run ci:design-tokens` until clean, then show Matt a screenshot before push.

Working-tree note: many untracked `scripts/_*.mjs` + docs/ + supabase/migrations/20260528010000_anon_read_market_tables.sql are uncommitted — these are prior FUB/Skyslope/CMA work, NOT this session's. Leave them unless Matt says otherwise.

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
