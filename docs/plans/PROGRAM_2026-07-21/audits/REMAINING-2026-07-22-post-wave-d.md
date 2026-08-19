# What remains from RR-PLATFORM-DECISIONS-2026-07-21

Audited 2026-07-22 against main at 96f76ca1 (post Wave D) by 13 verification agents, file-level evidence per claim.

**83 decisions: 32 done · 32 partial · 14 not started · 1 superseded · 4 pending an operating step.**


## W1

### W1.1 — PARTIAL
**Promote West Side Meta audience refresh to a daily cron; verify META_AUDIENCE_PUSH_ENABLED in prod (mechanism: vercel.json + cron-registered gate + heartbeat)**

*Evidence:* Cron exists and is registered: /Users/matthewryan/RyanRealty/app/api/cron/meta-westside-audience/route.ts (Wave C 19fb540f), shared impl /Users/matthewryan/RyanRealty/lib/meta-westside-audience.ts with 35 tests in lib/meta-westside-audience.test.ts (dry-run proven to make zero Meta calls); vercel.json line 212 entry, schedule '0 14 * * 1'; CLI scripts/meta-refresh-westside-audience.mjs refactored to thin caller; ledger rows to meta_audience_log via lib/data/crm/writeAudienceLedger; ci:cron-registered gate wired in package.json (scripts/check-cron-registered.mjs) inside ci:gates.

*Remaining:* (a) Cadence is WEEKLY (Mondays 14:00 UTC), not the decided daily — deviation is stated in the Wave C commit but recorded nowhere in docs/plans/PROGRAM_2026-07-21/04-DECISIONS-RECORDED.md. (b) The promised heartbeat coverage is absent: lib/pipeline-heartbeat.ts evaluators cover only sync-delta, search MV, FSBO, expired, saved-search, market-stats — no audience-push staleness check, and app/api/cron/loop-health-check/route.ts never probes meta_audience_log. (c) META_AUDIENCE_PUSH_ENABLED being on in prod is unverifiable from code (route forces DRY-RUN when unset via lib/meta-env.ts isMetaAudiencePushEnabled) — the operating verification is still owed.

### W1.2 — DONE
**West Side cohort report: weekly digest + admin view scoped to parcel-linked people (mechanism: DAL + cron; row-count contract test)**

*Evidence:* DAL: /Users/matthewryan/RyanRealty/lib/data/crm/getWestsideCohortActivity.ts (parcel-linked crm_person_id cohort, paged reads) with contract tests in getWestsideCohortActivity.test.ts (signal counting, session dedupe, weighted score, drops non-parcel-linked activity, rollup zeros). Admin view: app/admin/(protected)/crm/reporting/westside/page.tsx (day-window selector). Weekly digest: app/api/cron/westside-cohort-digest/route.ts, registered in vercel.json line 216 ('0 15 * * 1'), internal-recipient-only (MATT_ALERT_EMAIL), renderer lib/westside-digest-email.ts with 12 tests incl. pluralization, overflow cap, voice check (no em-dash/semicolon). Shipped Wave C 19fb540f. Nit (not part of the decision): the /admin/crm/reporting hub card grid does not list the westside page — it is reached via the digest email link and direct URL.

### W1.3 — PARTIAL
**Wire search and scroll-depth events into the first-party event store (mechanism: event-taxonomy contract test, component fires ↔ ALLOWED_EVENT_TYPES accepts)**

*Evidence:* ALLOWED_EVENT_TYPES in app/api/visitors/track/route.ts:176 accepts 'search' and 'scroll_depth'. search fires first-party at 4 sites in components/search/SearchFilters.tsx (301, 312, 322, 398) via fireFirstPartyEvent from components/VisitTracker.tsx. scroll_depth dual-sinks first-party from components/site/kb/KbSectionTracker.client.tsx:68 (KB pages: homepage, cities, communities — incl. the fix for the bare-pathname bug that silently dropped every event) and components/LandingPageTracker.tsx:85 (LP pages). Consumer exists: lib/data/crm/getContactBehaviorSummary.ts reads the taxonomy.

*Remaining:* The promised event-taxonomy contract test does not exist — no *.test.* file references ALLOWED_EVENT_TYPES or FirstPartyEventType (verified by repo-wide grep); the only guard is a comment in VisitTracker.tsx ('Must stay a subset of ALLOWED_EVENT_TYPES'), and scripts/check-tracking-policy.mjs (G48) does not cover the taxonomy. Also scroll_depth on listing-detail pages (components/listing/ListingTracker.tsx:56) and the experience engagement hook (components/site/experience/useEngagementTracking.ts:56) still go to GA4 only, so per-person drop-off remains invisible on those surfaces.

### W1.4 — PARTIAL
**SMS click tracking everywhere — extend short-link instrumentation beyond prospecting (mechanism: governed-send chokepoint W5)**

*Evidence:* Short-link rail: lib/data/crm/shortLinks.ts (crm_short_links table, instrumentSmsLinks link rewrite, bot-UA screen) + app/r/[code]/route.ts logging sms_click to crm_timeline. instrumentSmsLinks is wired into the governed chokepoint lib/comms/sendGovernedSms.ts (Wave B 1d6ca0f3) — covers all composer/manual person-keyed sends via app/actions/crm.ts — plus app/actions/prospecting.ts, expired-outreach.ts, fsbo-dashboard.ts, send-doc.ts. Gate G56 ci:governed-send exists in ci:gates (scripts/check-governed-send.mjs, shrink-only baseline scripts/governed-send-baseline.json).

*Remaining:* 'Everywhere' is not true yet: the sequence engine sends person-keyed SMS uninstrumented — app/api/cron/crm-sequence-engine/route.ts:413-414 calls sendSms/sendSmsViaMessagingService directly with the raw merged body (no instrumentSmsLinks in the file; 4 direct provider call sites baselined in governed-send-baseline.json). Route sequence sends through sendGovernedSms or call instrumentSmsLinks there. Raw no-contact group-reply numbers in app/actions/crm.ts:950 also send untracked (unavoidable: no person to key to).

### W1.5 — PARTIAL
**Delete legacy visits/trackVisit duplicate path and FUB-era email_campaigns; fold stale FACEBOOK_SELLER_GROWTH_PIPELINE.md into canon**

*Evidence:* Write path deleted: Wave A 5d5286a7 removed app/actions/track-visit.ts (-50 lines) and the VisitTracker call (components/VisitTracker.tsx:286 comment 'legacy visits-table write (trackVisit) was deleted 2026-07-21'). Everything else undone: (1) `visits` table READS remain — app/admin/(protected)/reports/traffic-sources/page.tsx:163, app/admin/(protected)/reports/lead-flow/page.tsx:204, app/actions/partnership-revenue.ts:74, app/actions/dashboard.ts:60-62 — those dashboards now count from a table that stopped receiving writes on 2026-07-21. (2) email_campaigns is NOT deleted: actively inserted by app/actions/admin-email.ts:32 and read by lib/data/crm/getBatchEmailsReport.ts + getEmailReporting.ts + app/admin/(protected)/email/campaigns/page.tsx (possibly deliberate native reuse, but no supersession recorded in 04-DECISIONS-RECORDED.md). (3) docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md untouched since 2026-05-12 (last commit 983c67cc), still documents the dead FUB system (FUB webhooks, fub-outreach-execution cron, `visits` fan-out at doc line 115), and both CLAUDE.md:909-910 and AGENTS.md:82 still route agents to it as the canonical front door.

*Remaining:* Delete or repoint the four `visits` readers (they silently flatline post-2026-07-21); decide + record whether email_campaigns is retired or officially adopted as the native batch-email store; rewrite/fold FACEBOOK_SELLER_GROWTH_PIPELINE.md into canon and fix the CLAUDE.md/AGENTS.md routing entries.

### W1.6 — DONE
**Drop-off findings stay a per-mission report — no automated page-change loop (NO LOOP directive)**

*Evidence:* Honored by deletion, not just abstention: Wave A 5d5286a7 removed the optimization-loop (route + admin + actions + e2e) per its commit message; no optimization-loop files remain (find across app/ returns nothing). Surviving crons are reports only — app/api/cron/marketing-optimization-report emails a digest, app/api/cron/loop-health-check alerts on pipeline staleness; neither mutates pages. No automated page-change machinery exists in app/api/cron/.


## W2

### W2.1 — PARTIAL
**Subdivision light-up: >=10 lifetime-sales threshold, sales history, per-subdivision stats, noindex below threshold, ci:sitemap-resolvable**

*Evidence:* Threshold constant SUBDIVISION_INDEX_MIN_LIFETIME_SALES=10 in lib/data/subdivisions/subdivision-index.ts:36, test-pinned at lib/data/subdivisions/subdivision-index.test.ts:31. Sitemap derives from boundaries+threshold: app/sitemap.ts:409-417 via lib/data/subdivisions/getIndexableSubdivisions.ts (boundaries geo_type='subdivision' intersected with get_subdivision_status_counts closed counts). Sales-history section: app/subdivisions/[slug]/SubdivisionSalesHistory.tsx + lib/data/subdivisions/getSubdivisionSalesHistory.ts backed by migration supabase/migrations/20260722043000_subdivision_sales_history_rpc.sql (commit 96f76ca1 states applied + browser-verified /subdivisions/bend-park). Below-threshold noindex: app/subdivisions/[slug]/page.tsx:130-136 (noindex: !indexable). All landed in Wave D 96f76ca1.

*Remaining:* Two promised pieces absent: (1) the per-subdivision market_stats_cache backfill — the page reads getMarketStats({geoType:'subdivision'}) (page.tsx:360-368) but nothing writes subdivision rows (app/api/cron/refresh-market-stats* cover cities+region only; SubdivisionSalesHistory.tsx:11 admits 'null for most plats until the cache backfill lands'); (2) the ci:sitemap-resolvable gate — absent from package.json ci:gates, scripts/ (only _gsc-sitemap-fix.mjs / seo-gsc-sitemap-submit.mjs exist), and docs/MECHANICAL_GATES.md (zero 'sitemap' mentions).

### W2.2 — PARTIAL
**Sitemap drift fix: communities from registry, stop emitting 404-ing /cities/{city}/{subdivision} URLs, + gate**

*Evidence:* Commit 37e83538 (2026-07-21, 'fix sitemap drift'). app/sitemap.ts:32 RESORT_COMMUNITY_SLUGS = getAllResortCommunities().map(c => c.slug) — hardcoded 14-slug list deleted, drift impossible by construction (registry data/resort-communities.json). /cities/{city}/{sub} deliberately not emitted (app/sitemap.ts:340-343 comment); neighborhood URLs emitted from the neighborhoods table the resolver actually uses (app/sitemap.ts:419-432).

*Remaining:* The promised '+ gate' does not exist: no gate or contract test pins registry-to-sitemap community parity or the non-emission of the 404-ing family. lib/sitemap.contract.test.ts asserts only legacy-path exclusion (/listings, /agents, /home-valuation); ci:sitemap-resolvable (the verdict-table gate) was never built. The fix itself is by-construction and working — only the regression guard is missing.

### W2.3 — DONE
**Subdivision browse pages persist in the sitemap after the last active listing closes**

*Evidence:* app/sitemap.ts:34-40 SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS=3 counting active+pending+closed ('a subdivision with real sold history KEEPS its URL after the last active listing closes'); lines 329-399 source pairs from get_subdivision_status_counts across ALL statuses on the CENTRAL_OREGON_CITY_SLUGS allowlist, independent of live inventory (service client fixes the anon 3s timeout that silently emptied the section). Wave D 96f76ca1 commit records browse pairs 3,522 -> 5,337. No additional mechanism was promised for this item.

### W2.4 — PARTIAL
**MPC parity: subdivision pages gain sales history, stats, schools, parent cross-links; events/HOA/rules only where curated**

*Evidence:* Sales history: rendered via SubdivisionSalesHistory in app/subdivisions/[slug]/page.tsx:466-470 (Wave D 96f76ca1). Stats: wired (getMarketStats geoType='subdivision', page.tsx:360-368) and the component renders a stats strip when a row exists (SubdivisionSalesHistory.tsx:54-64). Parent cross-links: KbBreadcrumb links Home > Communities > parent resort, but only when a resort-registry alias matches (page.tsx:398-406).

*Remaining:* Stats leg is starved: market_stats_cache has no geo_type='subdivision' rows and no writer computes them (no cron/script calls compute_and_cache_period_stats for subdivisions). Schools: no schools section or school cross-link anywhere on the subdivision page. Parent cross-links for plain GIS plats (the majority of 3,213 — no registry alias) go only to the /communities hub, no parent-city link. Events/HOA/rules curated-content population (26 of 27 files) remains the stated ongoing content job — unchanged.

### W2.5 — DONE
**llms.txt enumerates the full geo index (cities, communities, indexable subdivisions) from the same query as the sitemap, with parity test**

*Evidence:* app/llms.txt/route.ts:70-95 + 123-131 emits Cities (SITE_CITY_SLUGS), Communities (getAllResortCommunities), Neighborhoods (getAllNeighborhoodsWithCity), and Subdivisions via getIndexableSubdivisions() + subdivisionLlmsLines() — the identical shared list/module app/sitemap.ts consumes (subdivisionSitemapUrls). Parity mechanism exists: lib/data/subdivisions/subdivision-index.test.ts:113-159 'sitemap <-> llms.txt parity' asserts both surfaces emit exactly the same URL set from the same list. Cities/communities/neighborhoods share the same source imports as the sitemap by construction. Landed Wave D 96f76ca1 (route diff +13 lines on top of the Wave A dynamic llms.txt).

### W2.6 — NOT STARTED
**Historical depth: earliest-CloseDate query + monthly market_stats_cache backfill to it (feeds W8.5 ten-year reports)**

*Evidence:* No earliest-CloseDate artifact and no backfill code anywhere: grep across scripts/, app/api/cron/, lib/ finds nothing. The only monthly machinery is app/api/cron/refresh-market-stats-monthly-recompute/route.ts, which recomputes ONLY the last 6 calendar months for cities+region (lines 14-57) — not a historical backfill. Wave C's supabase/migrations/20260722020100_market_history_weekly.sql + app/api/cron/market-history-snapshot/ (19fb540f) is a going-forward WEEKLY snapshot (W8.2), explicitly unable to backfill because market_pulse_live overwrites itself.

*Remaining:* Everything: run the one prod query establishing earliest reliable CloseDate per geo, then build and run the monthly compute_and_cache_period_stats backfill loop to that depth (cities + region at minimum; subdivisions if W2.1's stats leg is to light up). W8.5's ten-year archive pages depend on this.

### W2.7 — PARTIAL
**Park / school-district / trail GIS polygons as new boundaries geo_types (county + ODE, authoritative only)**

*Evidence:* All existing coverage PREDATES the decisions document; no Wave A-D commit touched it. boundaries geo_type CHECK allows ['city','neighborhood','subdivision','park','school']: park polygons via supabase/migrations/20260603130000_park_boundaries.sql (OPRD/OSM, 2026-06-03), school ATTENDANCE-AREA polygons via 20260704120000_boundaries_allow_school_type.sql + scripts/seo-import-school-boundaries.mjs (Deschutes County GIS layer 19, covers Bend-La Pine/Redmond/Sisters). Trails: authoritative USFS/BPRD/BLM linework lives in the separate public.trail_lines table (scripts/seo-import-trail-lines.mjs, MultiLineString) — not a boundaries geo_type.

*Remaining:* No 'trail' geo_type in boundaries (trail geometry is linework in trail_lines — decide whether that satisfies the intent or corridors/polygons are wanted); no ODE school-DISTRICT polygons anywhere in boundaries (the only ODE GeoJSON consumer is the video producer scripts/build_school_district_overlay.py, which caches to data/school-districts/ for renders). If attendance areas + trail_lines are accepted as the substance, the residue is the ODE district layer plus recording that call.


## W3

### W3.1 — PARTIAL
**Inventory threshold rule — combo joins sitemap at >=1 active listing with depth content; zero-inventory combos render but noindex; gate asserts no zero-count indexable URL**

*Evidence:* Implemented at 3-segment matrix scope only: /Users/matthewryan/RyanRealty/lib/data/listings/getSearchMatrixInventory.ts reads listing_search_mv (line 79); /Users/matthewryan/RyanRealty/lib/seo/search-matrix.ts enforces SEARCH_MATRIX_MIN_ACTIVE=1 + hasDepthContent for emission and shouldNoIndexMatrixCombo (noindex only on verified zero, fail-open); wired to render via getMatrixComboNoIndex in /Users/matthewryan/RyanRealty/app/search/[...slug]/page.tsx generateMetadata (lines 199-213, gated to slug.length >= 3); contract tests /Users/matthewryan/RyanRealty/lib/seo/search-matrix.test.ts ('emits a combo only when count >= minActive AND depth content exists', 'records verified zeros in countByPath but never emits them') run via npm run test in .github/workflows/ci.yml line 46. All landed in Wave D 96f76ca1.

*Remaining:* The pre-existing 2-segment /homes-for-sale/{city}/{preset} set (~840 URLs — the 'with-pool-in-Culver class' this decision explicitly targets) is untouched: app/sitemap.ts lines 302-314 still emit EVERY indexable preset for every Central Oregon city with no inventory count check, and 2-segment zero-inventory combos are never noindexed (matrixNoIndex applies only at slug.length >= 3). No CI gate asserts 'no zero-count indexable URL' over the emitted sitemap (check-seo-routes.mjs has no count logic; the only mechanism is the matrix-scope vitest contract). Extend the count-driven emission + zero-count noindex to the 2-segment city×preset scope and add the promised sitemap-level gate.

### W3.2 — PARTIAL
**Emit the 3-segment matrix for the curated geo set; extend depth content to subdivision level**

*Evidence:* Emission done (Wave D 96f76ca1): /Users/matthewryan/RyanRealty/lib/seo/getSearchMatrixEntries.ts assembles curated geos — boundary neighborhoods (getMatrixNeighborhoods over public.neighborhoods), all 19 resort-registry communities (data/resort-communities.json), and subdivisions passing SUBDIVISION_INDEX_MIN_LIFETIME_SALES (>=10 lifetime closed sales via get_subdivision_status_counts RPC) — with resolveSlug precedence neighborhood > resort > subdivision; wired into the sitemap at /Users/matthewryan/RyanRealty/app/sitemap.ts line 438 (getSearchMatrixSitemapEntries). Fixture tests cover bucketing, aliases, precedence (lib/seo/search-matrix.test.ts).

*Remaining:* 'Extend depth content to subdivision level' is not done on the rendered pages: existing subdivision descriptions/blurbs are used only as the EMISSION criterion (hasDepthContent in getSearchMatrixEntries.ts). The visible preset depth layer — editorial intro, preset-scoped FAQ + FAQPage JSON-LD, cross-links — still renders only on 2-segment city pages: isPresetDepthPage in /Users/matthewryan/RyanRealty/app/search/[...slug]/page.tsx (lines 739-745) requires `!subdivision`, so every 3-segment {city}/{area}/{preset} page renders a bare grid with no depth content (subdivisionBlurb reaches only JSON-LD/share text).

### W3.3 — DONE
**Add missing property-type presets (multi-family, manufactured); sold pages pending ORMLS display-rule check**

*Evidence:* multi-family preset (params.propertyType 'Multi-Family' → MLS code C via /Users/matthewryan/RyanRealty/lib/property-type.ts line 38) and manufactured preset (propertySubType 'Manufactured') at /Users/matthewryan/RyanRealty/lib/search-presets.ts lines 113/118; backend substring ilike fix in /Users/matthewryan/RyanRealty/lib/data/listings/searchListingsAll.ts line 440 (Wave D diff shows exact-match previously zeroed manufactured/condos); FAQ depth copy in /Users/matthewryan/RyanRealty/lib/site/preset-faq.ts; matcher tests pin both (lib/seo/search-matrix.test.ts lines 154-168); both non-sort-only so sitemapped via getIndexablePresetSlugs. The sold/recently-sold half was resolved in the prohibitive direction the same day the doc was written: G54 ODS gate (commit f99397d3, 2026-07-21; scripts/check-ods-compliance.mjs lines 89-93, wired as ci:ods-compliance in ci:gates) mechanically forbids any 'sold' preset slug and pins statusFilter query-variant noindex — sold data is VOW-only, never a public indexable surface. Nothing buildable remains.

### W3.4 — PARTIAL
**Replace hand-curated popular-searches snapshot with auto-derived link layer + crawlable /site-index page; derived on a schedule; freshness gate**

*Evidence:* Feature fully shipped (Wave D 96f76ca1): pure derivation at /Users/matthewryan/RyanRealty/lib/data/seo/derive-search-links.ts + DAL /Users/matthewryan/RyanRealty/lib/data/seo/getSiteIndexLinks.ts (6h unstable_cache via makeResilientCached, noStore on the null-generatedAt fallback); crawlable /Users/matthewryan/RyanRealty/app/site-index/page.tsx (revalidate 3600, KB shell, in sitemap at app/sitemap.ts line 78); footer wiring via lib/site-nav.ts line 235 LEGAL_LINKS rendered by components/site/SiteFooter.tsx line 138 and components/site/kb/KbFooter.client.tsx line 149; mega-menu popular searches now live-derived (lib/data/nav/getMegaMenuData.ts lines 258-263, static lib/popular-searches.ts kept only as resilience fallback); search-page related-searches strip live-derived (app/search/[...slug]/page.tsx lines 715-722). Contract tests lib/data/seo/derive-search-links.test.ts (297 lines) run in CI (.github/workflows/ci.yml npm run test).

*Remaining:* The promised 'freshness gate' does not exist. Refresh is purely cache-TTL-driven (6h unstable_cache + 1h ISR) — a reasonable 'schedule', but no mechanical check asserts the derivation is fresh or non-stale: no script in scripts/ references site-index or getSiteIndexLinks (verified by grep), and check-content-freshness.mjs (G-FRESH) covers only data/co-events.ts dates. Add a freshness assertion (e.g. smoke/gate on generatedAt age) or record the TTL model as the accepted mechanism.

### W3.5 — PARTIAL
**Sort-only presets noindexed; pre-render top-N combos via generateStaticParams**

*Evidence:* Sort-only half done: isSortOnlyPreset (landed Wave A 5d5286a7) drives robots noindex in /Users/matthewryan/RyanRealty/app/search/[...slug]/page.tsx line 211, sitemap exclusion via getIndexablePresetSlugs (/Users/matthewryan/RyanRealty/lib/search-presets.ts lines 168-169), and exclusion from both the matrix (search-matrix.ts presetMatrixMatcher returns null) and the derived link layer (derive-search-links.ts). The ci:static-params gate exists (scripts/check-static-params.mjs, in ci:gates) but is a ratchet against a baseline.

*Remaining:* No generateStaticParams on the search route: /Users/matthewryan/RyanRealty/app/search/[...slug]/page.tsx exports none (grep confirms; ISR revalidate=60 only) and the route sits in the scripts/static-params-baseline.json violators list (19 tracked, baseline dated 2026-07-19) — i.e. the gate explicitly grandfathers the gap. Top-N city×preset combos are not pre-rendered at build; implement generateStaticParams for the top combos and remove the route from the baseline.


## W4

### W4.1 — PARTIAL
**One search component: merge orphaned SmartSearch into filter bar + site header, global header search, blog/guides/static pages in suggestion scope, delete the three orphans; mechanisms: tsvector switch, perf contract test, reachable-exports gate**

*Evidence:* Merge complete: /Users/matthewryan/RyanRealty/components/search/SearchSuggest.tsx is the one engine (90ms debounce, client cache, cached GET route — absorbs SmartSearch per its own header comment); consumed by the portal filter bar (components/search/SearchFilters.tsx lines 8-12, 243, 471-475) and the global site nav (components/site/kb/KbNav.client.tsx lines 9-13, 117, 244-246, 278-302, 'W4.1 global search' comments). All three orphans deleted: HeroSearchOverlay.tsx + SearchSplitView.tsx in Wave A 5d5286a7, SmartSearch.tsx (409 lines) in Wave D 96f76ca1; merge-lock tests pin it (components/search/__tests__/search-suggest-contract.test.ts lines 93-108: SearchFilters renders shared panel, KbNav renders shared panel, SmartSearch stays deleted). Scope extension: lib/data/search/searchSiteContentTitles.ts (published blog_posts + guides titles), lib/search/site-pages.ts (28-entry static-page registry), both wired in getSearchSuggestions (app/actions/listings.ts lines 381-388, 521-527, 'pages' category). Mechanism 1 (tsvector): lib/data/listings/searchSuggestTiles.ts uses textSearch('search_vector', prefix tsquery) against listing_tile_mv_src via the GIN index, ILIKE five-column scan retired; plus a numeric fast path ('3480' class) on text_pattern_ops btree indexes (supabase/migrations/20260722223000_suggest_tiles_numeric_fast_path.sql). Mechanism 2 (perf contract): app/api/search/suggestions/route.test.ts line 100 'warm round-trip stays under the 150ms budget' (handler-level, DAL mocked). Mechanism 3 (orphan gate): scripts/check-reachable-exports.mjs wired as ci:reachable-exports inside ci:gates (package.json lines 78, 178). Degraded contract also present: route sends no-store on degraded results (app/api/search/suggestions/route.ts lines 25-39).

*Remaining:* 'Global header search on every page' is not literally universal: pages that fall back to the layout's SiteHeader chrome instead of KbNav — /dashboard/*, /account, /login, /signup, /forgot-password, /feed, and the legal pages (privacy, terms, cookies, dmca, accessibility, fair-housing, data-deletion) — have no search entry anywhere in their header (grep of components/site/SiteHeader.tsx, MegaMenu.tsx, MobileNav.tsx, HeaderAccount.tsx finds no SearchSuggest or search input). Every KbNav-chrome page (the entire editorial, portal, search, blog, and guides surface, ~70 routes) does carry it. Also note the 150ms perf test bounds handler compute with a mocked DAL, not live warm round-trip — acceptable as a CI contract but weaker than the decision's wording.

### W4.2 — DONE
**Map: pan drops the invisible city pin (pure bbox after user move, visible scope chip until then), canvas-level loading state, mobile result count; mechanism: extended map-search contract tests**

*Evidence:* components/search/geo-scope.ts (stripGeoScope / geoScopeLabel / GEO_SCOPE_KEYS, header cites the W4.2 audit finding). components/search/MapSearchView.tsx: viewport fetch strips the geo pin once dropped (line 376, effectiveFilters = scopeDroppedRef.current ? stripGeoScope(base) : base), visible scope chip with clear-on-tap rendered until first user move (lines 634-651, 'Showing <scope> only' + X), canvas-level fetch state (lines 654-671: full-canvas overlay + aria-live 'Updating results…' pill), mobile map result count from the SAME totalCount that renders the pins (lines 673-681, lg:hidden pill). Mechanism: components/search/__tests__/map-search-contracts.test.ts describe 'geo scope drops on user map move (W4.2, 2026-07-22)' (lines 85-146) asserts pan drop, polygon drop, fire-time scope read, chip render, SSR re-establish, beyond-viewport lockstep, canvas loading state, and mobile count; plus components/search/__tests__/geo-scope.test.ts (strip/label unit contracts). All in Wave D commit 96f76ca1.

### W4.3 — DONE
**Kill the dark semantic-search stack (endpoint, embeddings table, OpenAI dependency) — one NL system**

*Evidence:* Endpoint + action deleted in Wave A 5d5286a7 (git log --diff-filter=D: app/api/search/semantic/route.ts, app/actions/semantic-search.ts). Orphan DAL writer upsertListingEmbedding deleted in Wave D 96f76ca1 (tombstone comment at lib/data/listings/getListingDetailBundles.ts lines 269-272). DB objects dropped by supabase/migrations/20260722213000_drop_semantic_search.sql (drop function match_listings_semantic, drop table listing_embeddings; pgvector extension intentionally left installed with rationale in the file). Repo-wide grep finds zero live references to listing_embeddings / match_listings_semantic / upsertListingEmbedding outside the drop migration and the tombstone comment. No 'openai' package in package.json. Remaining OPENAI_API_KEY usages are unrelated features, not the semantic stack: lib/photo-classification.ts (OpenAI Vision photo tagging), lib/ai-referrers.ts (referrer hostname list for AI-engine attribution), scripts/verify-env.ts (env-key health check). Commit 96f76ca1 states the migration was applied to hosted Supabase; DB state itself is unverifiable from this read-only audit, but ci:migration-drift is in the ci:gates chain (package.json line 178).


## W5

### W5.1 — PARTIAL
**Ship spec-03: person-workspace rebuild + single sendDeliverable action + governed-send chokepoint (SendPanel converges the three dialogs); mechanism: chokepoint CI gate**

*Evidence:* Chokepoint LANDED (Wave B 1d6ca0f3): /Users/matthewryan/RyanRealty/lib/comms/{guards.ts,sendGovernedSms.ts,sendGovernedEmail.ts,types.ts,governed.test.ts} — hard-stop -> suppression(fail-closed) -> quiet-hours -> idempotency -> rail; core composer actions migrated (app/actions/crm.ts:565 sendGovernedEmail, :932 sendGovernedSms). Gate G56 exists and is wired: scripts/check-governed-send.mjs, package.json:80 ci:governed-send, present in the ci:gates chain (package.json:178). SendPanel v1 (ContactSendCenter, 5 tabs) pre-dates the decision (doc's own 'Have' line). NOT landed: sendDeliverable — zero hits in code (grep across app/ lib/ components/); it exists only in docs/plans/ADMIN_REBUILD/specs/03-person-workspace-send.md. Person-workspace rebuild not started: app/admin/(protected)/crm/[id]/page.tsx is 742 lines, still export const dynamic='force-dynamic' (line 83), the forked mobile-detail.tsx still exists in the same dir, and the file-size ratchet went the WRONG way — scripts/file-size-budget-baseline.json:17 shows 743, raised from 707 -> 735 in Wave B (git show 1d6ca0f3) -> 743 in Wave D. docs/plans/ADMIN_REBUILD/PROGRESS.md:303-359 explicitly hands off 'the spec-03 full pass: sendDeliverable unified action + build_state columns + polling chips + inline preview/approve + mobile-tree send domain' (chip task_c4fbba7e open). Mechanism nuance: the decision said ANY unrouted send action fails CI; G56 is a shrink-only ratchet grandfathering 61 direct-send sites across 47 files (scripts/governed-send-baseline.json) — only NEW direct sends fail.

*Remaining:* The whole spec-03 core: build the sendDeliverable unified server action + deliverable idempotency store, rebuild the person-detail 40-55-query force-dynamic fan-out into cached DAL + streamed Suspense, delete the mobile-detail.tsx fork (one responsive tree), add build_state polling chips + inline preview/approve, then pay the crm/[id] 743-line baseline DOWN. Optionally tighten G56 by burning down the 61-site baseline toward the decision's 'any unrouted send fails CI'.

### W5.2 — DONE
**One ranked who-to-contact list: sequence queue merged with inbound triage (replies, doc opens, hot visits), ranked recency x heat; mechanism: queue contract test with fixture events**

*Evidence:* /Users/matthewryan/RyanRealty/lib/data/crm/getInboundTriage.ts (Wave B 1d6ca0f3): merges 4 inbound sources over 72h — unread sms_in/email_in replies, email_events doc-opens classified cma/bpo/market-report, hot visitor_sessions identified to crm_people, showing/lp-form call tasks — rank = signal weight x 24h-half-life recency decay, dismissal via conversation-state watermark. Merged with the sequence queue by mergeNeedsAction, consumed live on the broker home: app/admin/(protected)/broker-dashboard/page.tsx:6-7 imports, :147 getBrokerInboundTriage(feedSlug), :189 mergeNeedsAction(actionQueue, triageItems, 15); server action app/actions/crm.ts:1883 getBrokerInboundTriage + dismissTriageItemAction. Mechanism present: lib/data/crm/getInboundTriage.test.ts — fixture-event-seeded contract tests over triageRank, rankTriageItems, mergeNeedsAction, replySignal, classifyDocEvent, docSignal, visitSignal, isTriageTaskCandidate, watermark/unread helpers (10 describe blocks).

### W5.3 — PARTIAL
**Recommended replies at the thread: extend AI SMS draft pattern to email and inbound-reply context, preloaded in the composer (broker overrides, no auto-send)**

*Evidence:* Email AI drafts LANDED: app/actions/crm-inbox.ts:485-595 aiEmailDraftAction (kinds incl. 'reply' — pulls the FULL last inbound sms_in/email_in message as context, Re: subject threading, voice-rule system prompt, never sends), pill strip in components/admin/crm/EmailComposer.tsx:87-94, format contract components/admin/crm/ai-email-draft.ts + .test.ts. Inbound-reply intelligence LANDED for SMS: lib/crm/reply-intent.ts (+ .test.ts) — deterministic pre-pass + haiku classify, sanitizeRecommendedReply merge-safety (§0), fail-open, kill switch — wired into app/api/twilio/inbound-sms/route.ts:250-325 (timeline note, task name, alert-email body all carry the suggested reply). Composer preload contract LANDED: components/admin/crm/composer-preload.ts (?reply=&replyChannel= consumption) wired in EmailComposer.tsx:277, SmsComposer.tsx:112, mobile/MobileCommsTab.tsx:33. GAP 1: no surface PRODUCES a ?reply= link — repo-wide grep for 'reply=' link builders outside the three consumers returns nothing; the alert email (inbound-sms/route.ts:325) and broker-cell forward (:364) both link /admin/crm/<id>#comms with no reply param, so the classified suggestion arrives as copyable text, never actually preloaded. GAP 2: inbound EMAIL replies are never classified — classifyInboundReply's only consumer is the Twilio inbound-SMS webhook (grep -rln classifyInboundReply); the crm-gmail-sync cron has no reply-intent hookup.

*Remaining:* Wire a producer of the ?reply=/replyChannel deep link (alert email + broker-cell forward + triage/inbox items) so the recommended reply actually preloads the composer, and run reply-intent classification on inbound email (crm-gmail-sync path) with the same suggested-reply surfacing.

### W5.4 — DONE
**Save-as-template and CC-me in the composers**

*Evidence:* Wave B 1d6ca0f3. Save-as-template: components/admin/crm/SaveAsTemplateDialog.tsx (persists via createTemplateAction from app/actions/crm-templates — same writer as the template manager), mounted in BOTH canonical composers: SmsComposer.tsx:280 (channel='sms') and EmailComposer.tsx:387 (channel='email', subject+body). CC-me: EmailComposer.tsx:250-330 — Switch resolves the acting broker's own sending mailbox server-side via getCcSelfAddressAction (app/actions/crm-inbox.ts), adds it to the cc list which submits with the form (hidden cc input when the row is collapsed); checked-state derives from the cc list so hand-removing the chip un-checks it. G50 composer discipline intact (ci:composer-discipline in the gate chain).

### W5.5 — PARTIAL
**Notifications: flip mac-mini relay to Twilio (existing flag), keep serverless SMS-forward rail, add PWA web-push as the durable channel**

*Evidence:* Flag flip: scripts/crm-alert-relay.mjs:77 gates on env.CRM_SMS_ALERTS==='twilio' && campaignVerified(); .env.local:254 on this machine (the relay host reads repo-root .env.local) IS set to CRM_SMS_ALERTS=twilio, and A2P is VERIFIED (memory re-verified 2026-07-13) — so queued broker alerts now send via Twilio Messaging Service instead of iMessage. Serverless SMS-forward rail kept: app/api/twilio/inbound-sms/route.ts:358-375 (awaited broker-cell forward from the A2P business line). NOT done: the queue drain still runs ONLY on the mac-mini LaunchAgent (com.ryanrealty.crm-alert-relay, ~45s) — no Vercel cron touches crm_broker_alerts (grep app/api/cron/ shows only a comment reference; vercel.json has no alert-relay entry), so the single-machine dependency the decision aimed to remove persists for queued alerts. PWA web-push NOT started: VAPID keys are declared in lib/env.ts:42-43 with ZERO consumers (repo-wide grep), no service worker ships (no public/sw*; the only SW code is components/site/StaleServiceWorkerReset.tsx, which UNREGISTERS workers), no push-subscription table or web-push dependency in package.json.

*Remaining:* Move the crm_broker_alerts drain off the mac mini (serverless cron sending via Twilio) so alert delivery survives the machine, and build PWA web-push end to end: service worker, push-subscription storage, VAPID send path, broker opt-in UI.

### W5.6 — DONE
**Calendar-aware scheduling stays deferred; read-only calendar display already works**

*Evidence:* Deferral honored — no calendar-aware send-scheduling code exists anywhere (grep of lib/crm/ and app/actions/crm*.ts for scheduling/suggest-time/calendar-aware: no send-scheduling hits). The read-only display the decision cites is present and multi-surface: components/admin/crm/calendar/CalendarView.tsx, CalendarGrids.tsx, AppointmentSheet.tsx, AppointmentModal.tsx, mobile/MobileCalendarScreen.tsx + MobileCalendarRows.tsx.


## W6

### W6.1 — DONE
**Wire the email send (dead Email tab) + channel-aware sent-state**

*Evidence:* Wave B 1d6ca0f3. /Users/matthewryan/RyanRealty/app/actions/prospecting.ts:374 sendProspectingEmailIntro mirrors the SMS guard chain fail-closed (client-ready doc, off-market/hard-stop/relist verify, person+value-keyed suppression, TOCTOU re-check, merge-token refusal), sends via the sendCmaToLead rail, stamps message-id before finalize. Email claim RPC trio in lib/data/prospecting/send-claim.ts (claimProspectEmailSend/finalize/stamp/release) over supabase/migrations/20260722010100_prospect_email_outreach.sql; outreach_email_* columns present for both expired_listings and fsbo_listings in docs/DATABASE_SCHEMA_SNAPSHOT.md (snapshot regenerates from live DB, so the migration is applied). Channel-aware sent-state: mergeChannelSentState in lib/data/prospecting/types.ts:260, used in batch.ts/docs.ts/get.ts with 42703 feature-detect; per-channel disable stamps (sentSms/sentEmail) + independent idempotency namespace intro-email:{kind}:{id} in components/admin/prospecting/ProspectSendDialog.client.tsx (Email tab reuses EmailBodyEditor); prepareProspectSend returns rail-composed email defaults + both stamps (app/actions/prospecting.ts:679). Tests: lib/data/prospecting/send-state.test.ts.

### W6.2 — PARTIAL
**Ownership duration from county sale date into audit doc, prospecting detail, CRM record**

*Evidence:* Wave B 1d6ca0f3. County source: lib/expired-owner-lookup.ts fetchDialOwnershipSince (Deschutes DIAL deed history, source 'deschutes-dial-deed-history') → CRM record via ownershipCustomFields at lib/expired-listing-processor.ts:359 (crm_people.custom.customOwnershipSince) → prospecting detail via lib/data/prospecting/get.ts:406 ownershipYearsFromDate (source-priority read incl. the custom field) → UI chip 'Owned N years' at components/admin/prospecting/ProspectDetailPanel.client.tsx:159. Tests: lib/data/prospecting/ownership.test.ts, lib/expired-owner-lookup.test.ts. Audit doc: lib/cma/expired-audit.ts buildOwnershipFinding prefers the county date and is unit-tested to prefer it (lib/cma/expired-audit.test.ts:55), BUT the only production call site, lib/cma/build.ts:336 buildFailureFindings({subject, pricing, market, history, photosCount}), never passes ownershipSince — grep shows no caller anywhere does — so the rendered audit only ever shows tenure from the MLS last-sale fallback, never the county deed date.

*Remaining:* Plumb the county date into the audit build: read customOwnershipSince (or the owner-lookup result) inside buildCma and pass ownershipSince to buildFailureFindings at lib/cma/build.ts:336. The county-preferring logic and its tests already exist; the parameter is simply dead at the call site.

### W6.3 — DONE
**Render the under-contract history (days-to-pending, fell-through) in the UI**

*Evidence:* Wave A 5d5286a7. lib/data/prospecting/get.ts:378 maps days_to_pending onto ProspectPriceCycle; underContractStory() in components/admin/prospecting/ProspectPriceHistory.client.tsx:33 renders 'Went pending after N days, fell through …' per cycle (handles closed-after-fall-through, never-pending, still-open); rendered in the detail panel at components/admin/prospecting/ProspectDetailPanel.client.tsx:190. Test: lib/data/prospecting/underContractStory.test.ts.

### W6.4 — PARTIAL
**Reply intelligence: classify inbound replies; interested ⇒ task + preloaded recommended reply**

*Evidence:* Wave B 1d6ca0f3. Classifier done: lib/crm/reply-intent.ts — deterministic pre-pass (STOP-adjacent/wrong-number/bare-ack) + claude-haiku-4-5 call, fail-open with CRM_REPLY_INTENT_DISABLED kill switch (line 243), §0 merge safety via sanitizeRecommendedReply (line 154, voids any unverified number); tests + snapshot (lib/crm/reply-intent.test.ts). Webhook wiring done: app/api/twilio/inbound-sms/route.ts:255 — task name enriched with intent + suggestion (line 298), crm_timeline system note with recommendedReply payload (line 276), broker alert email leads with 'They said / Suggested reply' (line 325). Preload CONSUMPTION done: components/admin/crm/composer-preload.ts (?reply=&replyChannel= contract, tested) consumed by SmsComposer.tsx:113 and EmailComposer.tsx:277. GAP: no producer emits a ?reply= link anywhere — the alert email (route.ts:325), the broker-cell SMS forward (route.ts:365), and the triage deepLink (lib/data/crm/getInboundTriage.ts:419) all link bare /admin/crm/<id>#comms, so the composer never actually pre-fills; the broker must hand-copy the suggestion from the task/alert text.

*Remaining:* Emit the suggested-reply deep link: when a classification carries a recommendedReply, append ?reply=<encoded>&replyChannel=sms to the alert-email link, the broker-cell forward link, and/or the triage-queue deepLink so the existing composer preload fires. Optionally classify email-channel replies now that the email intro channel exists (decision scoped texted prospects, so this is an extension, not the gap).

### W6.5 — DONE
**One-click enroll-in-expired-drip on the prospecting row (manual, pause honored)**

*Evidence:* Wave A 5d5286a7. app/actions/prospecting.ts:797 enrollProspectInDripAction → resolveDripSequenceForKind (lib/data/prospecting/drip.ts:47, automation-rules read with fallback) → manualEnrollPerson (lib/crm/enroll.ts:178). UI: 'Enroll in drip' button + confirm dialog in components/admin/prospecting/ProspectDetailPanel.client.tsx:247-276 with blocked reasons (hard-stop, already enrolled, no configured sequence). Outreach-pause default preserved: autoEnrollPerson explicitly never auto-enrolls skip-traced expired/FSBO owners (lib/crm/enroll.ts:52-56) — enrollment is broker-initiated only.

### W6.6 — DONE
**Expired story panel on the person page (structured, not prose)**

*Evidence:* Wave A 5d5286a7. lib/data/crm/getContactProspectStory.ts links crm person → expired_listings/fsbo_listings rows; components/admin/crm/ContactProspectHistoryCard.tsx renders the structured right-rail card (status + date, MLS#, original→last price with drop %, days on market, prior agent, deep link into the /admin/prospecting detail drawer) and is mounted at app/admin/(protected)/crm/[id]/page.tsx:215 (fetch) and :662 (render). Note: implemented as a purpose-built card rather than a literal reuse of the price-history component — the full per-cycle price history renders one click away in the prospecting drawer (ProspectPriceHistory); the decision's substance (structured story replacing the buried prose note) is met.

### W6.7 — DONE
**FSBO sources: add Craigslist RSS, drop Facebook Marketplace, no public FSBO page**

*Evidence:* Wave B 1d6ca0f3. lib/fsbo-craigslist.ts — Craigslist source live (RSS verified DEAD platform-wide 2026-07-21 → parses the cl-static-search-results no-JS fallback of bend.craigslist.org/search/reo with min_price floor; single fetch covers all 6 service-area cities; fail-soft); wired into lib/fsbo-processor.ts alongside Zillow with cross-source dedupe; fixture-tested (lib/fsbo-craigslist.test.ts + lib/fsbo-craigslist.fixture.html.gz). Facebook Marketplace explicitly dropped per the 2026-07-21 decision (lib/fsbo-processor.ts:11, fsbo-craigslist.ts header). Cron registered: vercel.json /api/cron/detect-fsbo-listings at '35 9 * * *'. No public FSBO valuation page exists — the only public surface is /lp/fsbo, a static lead-capture LP with no valuations (app/lp/fsbo/page.tsx, @data-free). RSS-vs-scrape is a verified-at-source mechanism substitution, not missing work.

### W6.8 — YOUR CALL / OPS STEP
**Capture scope stays at the locked directive ($500K+, SFR, 6 cities)**

*Evidence:* Code honors the locked scope exactly: lib/expired-listing-processor.ts — SERVICE_AREA_CITIES (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine, line 53), MIN_LIST_PRICE = 500_000 (line 62), PropertyType='A' (header §, locked 2026-05-19); lib/fsbo-detector.ts — FSBO_SERVICE_AREA_CITIES (line 53, same 6 cities), FSBO_MIN_LIST_PRICE = 500_000 (line 114). Craigslist re-applies the floor server-side AND in code (fsbo-craigslist.ts). No widening has occurred in any wave.

*Remaining:* Nothing to build — the decision is self-executing and honored. The open item is Matt's widen-or-not call (the document's operating question 2); if he widens, it is the promised one-constant change in expired-listing-processor.ts + fsbo-detector.ts.


## W7

### W7.1 — DONE
**Add monthly cadence to saved-search alerts (keep daily)**

*Evidence:* supabase/migrations/20260721113000_listing_alerts_monthly_cadence.sql widens the CHECK to ('instant','daily','weekly','monthly'); /Users/matthewryan/RyanRealty/lib/saved-search-cadence.ts is the single source (4 cadences, monthly=30d, isCadenceDue); lib/saved-search-frequency.ts normalizer accepts 'monthly'; the alert engine app/actions/saved-search-alerts.ts:64,182 uses isCadenceDue and the local daily-coercion is deleted (comment at :59-63 documents the exact bug removed); consumer UI app/account/saved-searches/SavedSearchControls.tsx:252 and EditSearchDialog.tsx:197 render SAVED_SEARCH_CADENCES; unit tests lib/saved-search-cadence.test.ts + lib/saved-search-frequency.test.ts; hourly cron registered (vercel.json /api/cron/saved-search-alerts). Wave B commit 1d6ca0f3 states the migration was applied to hosted Supabase and the schema snapshot was regenerated from the live DB in the same commit.

### W7.2 — PARTIAL
**Build hide-homes: table + tile control + exclusion from results and alert emails**

*Evidence:* supabase/migrations/20260722010200_hidden_listings.sql (table + RLS, present in the live-generated docs/DATABASE_SCHEMA_SNAPSHOT.md:2481 so applied to prod); app/actions/hidden-listings.ts; tile control components/listing/ListingCardHideControl.tsx rendered by components/search/SearchResults.tsx:174 with client-side exclusion (:129 excludeHiddenListings); shared pure logic components/search/hidden-exclusion.ts + test components/search/__tests__/hidden-exclusion.test.ts; alert-engine exclusion BEFORE the seen-set diff in app/actions/saved-search-alerts.ts:165-253; manage page app/account/hidden/page.tsx + UnhideButton.tsx + AccountNav link (components/account/AccountNav.tsx:10). All commit 1d6ca0f3, unchanged at 96f76ca1.

*Remaining:* The /search map split view is not covered: components/search/MapSearchView.tsx renders its own listing cards (lines 245-592) with no ListingCardHideControl and no hidden-exclusion import, so a hidden home still shows on the map list and pins. Browse surfaces outside /search (e.g. /homes-for-sale city pages, /search/[...slug]) also do not apply the exclusion — SearchResults is imported only by app/search/page.tsx.

### W7.3 — PARTIAL
**Stitch likes/saves to the person (auth-user→person join, save events to first-party store, surface on lead) — mechanism: identity-join contract test**

*Evidence:* Join built: lib/data/crm/getContactSavedHomes.ts resolves person→auth user_ids via visitor_identity_map (crm_person_id/fub_person_id/email or-filter, lines 150-160) + profiles.crm_person_id bridge, reads likes + saved_listings, joins live listing_tile_mv. Save events reach the first-party store: lib/data/crm/recordSaveListingEvent.ts (GPC + session-consent gated) called from the only write paths app/actions/likes.ts:45 and app/actions/saved-listings.ts:61. Surfaced on the lead: app/admin/(protected)/crm/[id]/page.tsx:166,224 (getContactSavedHomes + buildHomesPanelUnion) with liked/saved badges via ViewedHomeCard consumerSources. All commit 1d6ca0f3.

*Remaining:* The promised identity-join contract test is only half there: lib/data/crm/getContactSavedHomes.test.ts exercises ONLY the pure rollup/union helpers — the person→auth-user or-filter (getContactSavedHomes.ts:150-160, visitor_identity_map + profiles chain) is inline and untested. The one join contract test that exists (lib/data/crm/getViewedListings.test.ts, buildSessionOrFilter) covers the visitor_sessions chain, not the consumer-store auth-user join. Extract the saved-homes or-filter into a tested pure helper (same pattern as buildSessionOrFilter) to fulfill the stated mechanism.

### W7.4 — DONE
**BPO one-click from a viewed/liked home card (buyer-side subject)**

*Evidence:* components/admin/crm/ViewedHomeCard.tsx renders a 'Draft BPO' action (line 115) calling startBpoForContactAction(resolvedPersonId, home.listingKey); app/actions/contact-bpo.ts startBpoForContactAction now accepts subjectListingKey and resolves the buyer-side subject by MLS key (purpose 'buyer valuation', lines 98-145) instead of hardcoding the seller-side home address, with an idempotency guard (one live BPO per person+subject listing, lines 73-85); pure helper components/admin/crm/viewed-home-bpo.ts + unit test viewed-home-bpo.test.ts; card rendered in the crm/[id] homes panel and ContactBehaviorPanel.tsx. Review-first flow preserved (draft, not send). Commit 1d6ca0f3.

### W7.5 — PARTIAL
**Broker create-search form gets full consumer filter vocabulary + instant cadence; buyer LP creates the alert row**

*Evidence:* LP half done: app/lp/buyer-listing-alerts/actions.ts:346-376 mints listing_alerts rows via buildBuyerAlertFilterSets + upsertListingAlert (narrowing-guarded, deduped by filters_hash, hard-stop gated), with app/lp/buyer-listing-alerts/alert-filters.ts + alert-filters.test.ts. Instant cadence done: components/admin/crm/ContactSendCenter.tsx renders all four SAVED_SEARCH_CADENCES (line 483) and app/actions/contact-listing-matches.ts:51,75 accepts/normalizes the full SavedSearchFrequency. Broker form expanded in 1d6ca0f3 to city, subdivision, min/max price, beds, baths, minSqFt, propertyType, statusFilter with the hasNarrowingFilter guard, mapped through normalizeSavedSearchFilters.

*Remaining:* 'Full consumer filter vocabulary' is not met: the broker form exposes 9 keys while the consumer vocabulary (lib/search-filters.ts LEGACY_FILTER_KEYS + the field registry) spans ~37 keys — missing maxSqFt, yearBuiltMin/Max, lotAcresMin/Max, neighborhoodSlug, garageMin, keywords, hasPool/hasView/hasWaterfront/hasFireplace/hasGolfCourse, propertySubType, multi-city, and registry fields. Also cleanup: the stale 'cast is a bridge until the action signature widens' comment + `freq as 'daily' | 'weekly'` cast in ContactSendCenter.tsx:249-254 — the action already types SavedSearchFrequency.

### W7.6 — DONE
**Fix the viewed-homes panel's legacy identity path (native leads showed empty)**

*Evidence:* lib/data/crm/getViewedListings.ts implements the native identity chain (visitor_sessions.crm_person_id + lockstep fub_person_id + visitor_identity_map by crm/fub/email → session ids + rr_vid sibling sessions), header documents the closed legacy-fub-only gap (2026-07-21); pure buildSessionOrFilter contract-tested in lib/data/crm/getViewedListings.test.ts ('matches BOTH id columns for a native lead'); the same fix propagated to lib/data/crm/getContactBehaviorSummary.ts (resolveLeadSessionIds union, per the 1d6ca0f3 diff); person page passes native keys at app/admin/(protected)/crm/[id]/page.tsx:164 with the fix rationale in an inline comment. Commit 1d6ca0f3, unchanged at 96f76ca1.


## W8

### W8.1 — PARTIAL
**One generation path: standardize on cache, retire raw-listings RPC + weekly-report path, consistency cron + import gate**

*Evidence:* Landed (Wave C 19fb540f): cross-path §0 reconciliation — app/api/cron/market-stat-consistency/compare.ts + compare.test.ts (pins get_city_period_metrics RPC vs market_stats_cache/market_pulse_live for 7 verdict cities, |delta|>1% alerts), route.ts extended, cron registered vercel.json:192; /reports hub headline cards moved to the cache DAL — lib/data/market/getCityReportSnapshot.ts (+test) consumed by app/reports/page.tsx. NOT landed: the raw-listings RPC is still a live consumer path — app/actions/reports.ts:59 supabase.rpc('get_city_period_metrics') feeds the /reports range-filtered table, and app/actions/market-report.ts getMarketReportData still computes via the same RPC for the homepage carousel (its own comment: "The end state is to retire this RPC read... do not add new consumers"); grep of scripts/ finds NO import gate banning the RPC and no ci:* entry for it in package.json ci:gates; the separate weekly-report generator path is un-retired — app/api/cron/market-report/route.ts → generateWeeklyMarketReport, registered at vercel.json:84.

*Remaining:* Extend market_stats_cache to cover the /reports range filters, migrate app/actions/reports.ts and app/actions/market-report.ts off get_city_period_metrics, retire the RPC and the separate weekly-report generation path, and add the promised import gate banning the retired RPC (none exists in scripts/ or ci:gates).

### W8.2 — DONE
**Weekly history snapshot table fed from pulse + FRED/Freddie PMMS rates**

*Evidence:* supabase/migrations/20260722020100_market_history_weekly.sql; public.market_history_weekly in docs/DATABASE_SCHEMA_SNAPSHOT.md:2993 (snapshot refreshed in Wave C 19fb540f); app/api/cron/market-history-snapshot/route.ts + build-rows.ts (captures active_count, new_count_7d, pending_count, price_reduction_share, months_of_supply, median_list_price per city+region, idempotent weekly upsert) + build-rows.test.ts (179 lines); lib/market-national-series.ts pulls FRED MORTGAGE30US + DGS10 with Freddie Mac PMMS_history.csv keyless fallback and computes the spread; cron registered vercel.json:208 (Mon 13:00 UTC, covered by ci:cron-registered); read path exists — lib/data/market/getMarketHistoryWeekly.ts, consumed by the core-chart priceCutShare series (components/market/MarketCoreCharts.tsx:257).

### W8.3 — DONE
**Tabbed core-chart module (6 metrics) embedded on listing, city, community pages**

*Evidence:* components/market/MarketCoreCharts.tsx (tabbed, six cache-fed series: median price, inventory, days on market, months of supply, price cuts, closed sales — per its header + buildCoreChartTabs in components/market/core-charts.ts) with unit tests components/market/core-charts.test.ts (313 lines); DAL lib/data/market/getCoreChartSeries.ts. Embeds verified: app/cities/[slug]/page.tsx:65,602; app/communities/[slug]/page.tsx:83-84,890 (neighborhood scope with city fallback); listing pages via components/site/listing-detail/NeighborhoodMarketContext.tsx:12,171 imported at app/listing/[listingKey]/page.tsx:29. Shipped in Wave C 19fb540f (includes the recharts-2.x fragment fix).

### W8.4 — NOT STARTED
**/housing-market/[geo] canonical pre-generated report (YTD default, timeframe selector); explore page retired**

*Evidence:* app/housing-market/explore/page.tsx still live (re-exports app/reports/explore/page.tsx — the interactive "create your report" explorer, restyled in place, its own header says every filter/logic preserved); the /reports hub still links to it (app/reports/page.tsx:421 <Link href="/housing-market/explore">); app/housing-market/[...slug]/page.tsx remains the KB city market page — grep finds no timeframe/YTD selector and no pre-generated full-report render; explore still reads the get_city_period_metrics RPC via app/actions/reports.ts. This item sits in Phase 4 of the execution order, which has not run.

*Remaining:* Everything: make /housing-market/[geo] the canonical full pre-generated report with YTD default + timeframe selector, then retire /housing-market/explore and /reports/explore at parity.

### W8.5 — NOT STARTED
**Ten-year back-generation: monthly cache backfill to earliest verified data + per-city archive pages**

*Evidence:* app/api/cron/refresh-market-stats/route.ts backfills only rolling windows + the current month; app/api/cron/refresh-market-stats-monthly-recompute/route.ts recomputes only the last 6 calendar months. No script, cron, or migration performs a backfill to earliest CloseDate (repo-wide grep for market-scoped backfill/earliest-CloseDate finds nothing beyond those two crons). No per-city year-archive pages exist — app/reports/sales/[city]/[period] serves only fixed periods (this week / last week / last month / last year per lib/sales-report-periods). The prerequisite W2.6 earliest-CloseDate query is likewise unevidenced in code.

*Remaining:* Everything: earliest-CloseDate depth query, monthly cache backfill to it, and per-city archive pages gated on real sales volume.

### W8.6 — NOT STARTED
**Bulk + individual sends: audience selector on the send engine reusing the newsletter delivery ledger**

*Evidence:* The build item was the bulk audience selector (the doc itself states the individual half already exists: 'send now' per contact via SendPanel — confirmed at components/admin/crm/ContactSendCenter.tsx:52/191 → sendMarketReportNowAction). No bulk market-report send exists: lib/crm/market-report-send + app/api/cron/crm-market-report-send are the per-subscription cadence engine with no audience selector and no newsletter-queue ledger reuse (grep for queue/ledger in market-report-send.ts hits only broker health alerts); Wave C's bulk cohort enrollment (app/admin/(protected)/newsletters/enroll) is newsletter-only; app/admin/(protected)/crm/subscriptions bulk-manages subscription rows (pre-existing 2026-07-07 model), not a bulk send.

*Remaining:* Build the audience selector on the market-report send engine and route bulk delivery through the newsletter queue's delivery ledger.

### W8.7 — NOT STARTED
**Mohtashami corpus + narrative generation; market_narratives gets its writer**

*Evidence:* Repo-wide grep for 'mohtashami' hits only docs/plans/PROGRAM_2026-07-21/00-MASTER-SPEC.md, docs/plans/PROGRAM_2026-07-21/audits/RESEARCH-research-market-metrics.md, a skill file and a spec screen — zero implementation code, no corpus/ingest table or library. public.market_narratives still has exactly one reader (app/api/reports/export/route.ts:50 .from('market_narratives')) and zero writers anywhere in lib/ or app/ (grep excludes only types/database.ts). No §0-trace or voice-gate wiring for narratives exists.

*Remaining:* Everything: corpus ingestion, narrative generator with §0 trace + voice gate, and the market_narratives writer.

### W8.8 — NOT STARTED
**One geo registry for report coverage; gate on inline geo lists**

*Evidence:* The inline lists persist and grew: lib/data/crm/getMarketReportData.ts:138 CITY_SLUGS, lib/newsletter/produce-draft.ts:41 NEWSLETTER_CITY_SLUGS, MARKET_REPORT_DEFAULT_CITIES in app/actions/market-report-types (consumed by refresh-market-stats-monthly-recompute), PRIMARY_CITIES in lib/cities (app/reports/sales pages), and Wave C ADDED a fifth — VERDICT_CITIES in app/api/cron/market-stat-consistency/compare.ts, whose own comment says it 'mirrors CITY_SLUGS in lib/data/crm/getMarketReportData.ts'. No registry module exists (no match in lib/ or lib/data/geo/), and no gate on inline geo lists appears in scripts/ or the package.json ci:gates chain.

*Remaining:* Create the single report-coverage geo registry, repoint all five duplicated lists at it, and add the promised gate that fails CI on inline geo lists.


## W9

### W9.1 — YOUR CALL / OPS STEP
**Start the newsletter: enroll past clients + engaged leads + westside cohort, send the first issue**

*Evidence:* Code fully ready (Wave C 19fb540f): /Users/matthewryan/RyanRealty/app/actions/newsletter-enrollment.ts (union of past-client tags + 180d engaged + westside_parcels-linked, dry-run default, typed 'ENROLL' confirmation, superuser-only, fail-closed suppression check; covered by scripts/check-newsletter-authz.mjs:40 runCohortEnrollment), admin runner app/admin/(protected)/newsletters/enroll/{page.tsx,EnrollClient.tsx}. Send engine crons pre-registered in vercel.json (newsletter-send */2, newsletter-reconcile hourly, newsletter-monthly-draft 13:15).

*Remaining:* The operating steps: superuser runs the dry-run then the real 'ENROLL' run at /admin/newsletters/enroll, and the first issue goes through the approve-then-drain queue. Whether either has happened lives in prod newsletters/newsletter_recipients rows (off-limits to this audit); no repo ledger evidence of a send exists. The decision doc itself marks this '(S — it's an operating decision, not code)'.

### W9.2 — DONE
**Per-lead newsletter issue history on the contact card**

*Evidence:* components/admin/crm/ContactNewsletterHistory.tsx (server component over newsletter_recipients joined to deduped newsletter_recipient_events ledger), wired into app/admin/(protected)/crm/[id]/page.tsx (import line 39, rendered line 701); DAL getNewsletterHistoryForPerson in lib/data/newsletter/perLead.ts with unit tests lib/data/newsletter/perLead.test.ts. Shipped Wave C 19fb540f.

### W9.3 — DONE
**Wire /account/notifications to govern newsletter membership (supersedes unsubscribe-only)**

*Evidence:* app/account/notifications/page.tsx reads membership via getNewsletterMembershipForUserEmail and renders NewsletterToggle; app/account/notifications/NewsletterToggle.tsx calls setMyNewsletterMembership; app/actions/newsletter-membership-user.ts implements OFF via the exact token-unsubscribe status flip + global suppression mirror and ON via fail-closed canUserResubscribe consent gate (never re-enables bounce/complaint/do_not_email/hard-stop, clears only the owner's soft unsubscribe). Shipped Wave C 19fb540f.

### W9.4 — YOUR CALL / OPS STEP
**Postmaster ingestion cron before the first large send**

*Evidence:* Cron built and registered (Wave A 5d5286a7): app/api/cron/postmaster-sync/route.ts (daily pull of Gmail Postmaster stats for 3 sending domains into deliverability_metrics, ?days= backfill, CRON_SECRET auth) + lib/newsletter/postmaster.ts; registered in vercel.json line 204 ('30 12 * * *'), so G53 ci:cron-registered covers it. G-NL-20 reputation gate reads deliverability_metrics (scripts/check-newsletter-reputation.mjs exists).

*Remaining:* The one-time ops step is unverifiable from code: the route returns skipped=true (never errors) unless GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL/PRIVATE_KEY exist AND the Workspace domain-wide-delegation grant for https://www.googleapis.com/auth/postmaster.readonly is approved (lib/newsletter/postmaster.ts POSTMASTER_SETUP_HINT). No repo evidence confirms the grant or that deliverability_metrics is receiving real rows — until confirmed, the reputation gate still runs on fallback/no-data, the exact state this decision was meant to end. Verify one prod cron invocation returns ok (not skipped) or check the grant in Google Admin.

### W9.5 — PARTIAL
**Webhook-registration check — nightly check against the Resend API**

*Evidence:* scripts/check-resend-webhook.mjs performs a real GET https://api.resend.com/webhooks and asserts an enabled webhook targeting /api/webhooks/resend covering email.delivered/opened/clicked/bounced/complained (unsubscribed WARN-only); wired as npm run ci:resend-webhook (package.json:34) and whitelisted as an off-chain nightly in scripts/check-gates-wired.mjs:68. Shipped Wave C 19fb540f.

*Remaining:* The promised 'nightly' execution has no scheduler anywhere verifiable: zero references in .github/workflows/ (grep across all 9 workflows), no vercel.json cron route runs it, and the Claude scheduled-task list contains only 3 unrelated tasks. It runs only if someone invokes it manually. Additionally the check needs a full-access RESEND_WEBHOOKS_API_KEY (the account RESEND_API_KEY is send-only restricted and the script fails by design on it); provisioning of that key in .env.local is unverifiable from the repo. Wire an actual nightly runner (scheduled task or secret-bearing workflow) and confirm the full-access key exists.


## W10

### W10.1 — PARTIAL
**Wire marketing@ inbox cron + confirm Workspace grant; make /marketing/request an authenticated form writing action rows**

*Evidence:* Cron IS wired: vercel.json lines 200-201 register /api/cron/marketing-inbox-poll at */15 * * * * (added in Wave A 5d5286a7, which also updated the route docstring at /Users/matthewryan/RyanRealty/app/api/cron/marketing-inbox-poll/route.ts to record the 2026-07-21 registration; route enforces requireCronAuth). The gate mechanism exists: package.json ci:cron-registered -> scripts/check-cron-registered.mjs, in the ci:gates chain. BUT /Users/matthewryan/RyanRealty/app/marketing/request/page.tsx docstring still says 'No auth gate... No backend writes... purely a mailto: builder', and RequestBuilder.tsx lines 84-88/125/232 build a mailto:marketing@ryan-realty.com href — no server action, no marketing_brain_actions write, no auth. Last commits touching the request page (739c7b9d, 865342dd, 31d43cd8) all predate the four waves. Workspace grant: lib/marketing-brain/inbox-auth.ts line 16 still states 'As of 2026-05-14 the DWD allowlist contains gmail.send only' while line 13 says gmail.modify is required for the poll path; inbox-poll.ts lines 24/200-202 degrade to send-only 'auth-pending' if the grant is absent — no code evidence the gmail.modify DWD grant was ever confirmed.

*Remaining:* Convert /marketing/request from a mailto builder to an authenticated form that writes marketing_brain_actions rows (the 'two intakes, one queue' half of the decision). Confirm the gmail.modify scope was added to the DWD allowlist in Workspace Admin (operating step — code degrades silently to auth-pending without it, so the wired cron may still be reading nothing).

### W10.2 — NOT STARTED
**Broker content library: broker-visible surface over finished deliverables persisted to storage, with download and per-broker filtering**

*Evidence:* No library surface exists: app/admin/(protected)/ has no content-library route; broker-dashboard/page.tsx and broker-links/ contain no library/deliverable/download features; app/admin/(protected)/media is a superuser-only upload manager for branding/banners, not a deliverable library. No storage persistence: zero supabase storage upload calls in lib/marketing-brain/, app/api/cron/producer-runtime/, app/api/admin/run-producer/, or scripts/_producer_lib.py; no content_library/deliverable_library table in docs/DATABASE_SCHEMA_SNAPSHOT.md. Finished work still lands only in gitignored out/. None of the four wave commits (5d5286a7, 1d6ca0f3, 19fb540f, 96f76ca1) touched this area.

*Remaining:* Everything: storage persistence for finished deliverables, the broker-visible surface, download, and per-broker filtering. (W10 was Phase 4 in the execution order; Phases 0-3 are what shipped.)

### W10.3 — NOT STARTED
**Re-brand step: one parameterized 'render for broker X' pass using the brokers table**

*Evidence:* No re-brand producer exists: marketing_brain_skills/producers/ has 26 entries, none brand/re-brand related; repo-wide grep for rebrand|re-brand|render-for-broker returns only false positives (rebrand.ly shortener in lib/email/deliverability.ts, Juniper Preserve prose in lib/community-seo-content.ts, a newsletter comment in lib/data/newsletter/subscribersAdmin.ts). video_production_skills/ now contains only captions/ — the video producer library that would host such a pass was deleted in June and not rebuilt.

*Remaining:* Everything. The G45 freeze that blocked adding this producer was lifted 2026-07-21 (see W10.7), so it is unblocked but unbuilt.

### W10.4 — NOT STARTED
**Bulk approve / bulk reject in the approval queue**

*Evidence:* Approval is still strictly per-card: app/admin/(protected)/approval-queue/_components/ActionButtons.tsx takes a single actionId and POSTs to /api/admin/approval-queue/${actionId}/action; the API tree under app/api/admin/approval-queue/ contains only [id]/action/route.ts and [id]/comments/route.ts — no bulk endpoint; grep for 'bulk' across app/api/admin/ returns nothing; FilterSidebar checkboxes are filter params, not row selection.

*Remaining:* Everything: multi-select UI in the queue plus a bulk action endpoint/server action.

### W10.5 — NOT STARTED
**Purge catalog drift: request catalog and dispatch registry offering producers deleted in June**

*Evidence:* Drift confirmed still live at HEAD: lib/marketing-brain/inbox-producer-registry.ts routes 20 action types to producer paths that do not exist on disk — 18 under video_production_skills/ (listing_reveal, listing-tour-video, market-data-video, news-video, neighborhood_tour, meme_content, data_viz_video, monthly-market-report-orchestrator, youtube-long-form-market-report, earth_zoom, google_maps_flyover, avatar_market_update, area_guides, listing_launch, tiktok-listing-tour, social_calendar, market_report_video, news_video, youtube-long-form-walkthrough) plus lib/crm/send-event.ts (FUB decommissioned) and social_media_skills/coming-soon-teaser. app/marketing/request/deliverables.ts still offers listing_reel, listing_tour_video, coming_soon_teaser, monthly_market_report, market_data_short, market_youtube_longform, market_data_viz, neighborhood_tour, news_clip, meme_video etc. Last commits touching these files (de5cb66e, 739c7b9d, c10e48fa) all predate the four waves — a broker request for any of these still dispatches into a void.

*Remaining:* Everything: prune the ~20 dead entries from inbox-producer-registry.ts and the matching items from app/marketing/request/deliverables.ts (and inbox-parser.ts action types), or point them at surviving producers; no gate exists asserting registry paths resolve to real SKILL.md dirs.

### W10.6 — PARTIAL
**Per-broker Instagram auto-posting deferred; interim share-to-social rides OG-image + ShareButton rails with a pre-written caption field**

*Evidence:* The deferral holds as decided: no per-broker OAuth or per-broker IG posting code exists anywhere (grep across app/api/ for broker-scoped instagram/oauth returns nothing) — consistent with the recorded 'deferred'. The existing rails exist: components/ShareButton.tsx with generic title/text prefill props (lines 9-12, 33-36, 82-83), used by CardActionBar, PageActionBar, ListingActions, ShowcaseStickyBar.

*Remaining:* The interim piece — a pre-written caption field for broker share-to-social — was never added (no caption concept in any Share* component), and there is no broker deliverable surface to share from since W10.2 does not exist. IG auto-posting itself stays deferred per the decision ('revisit after the library operates').

### W10.7 — DONE
**New producers (weekend-events, re-brand) require lifting the G45 freeze**

*Evidence:* The freeze was lifted: commit 37e83538 ('feat(process): lift G45, confirm approval model, add G53 cron-registered, fix sitemap drift'); docs/MECHANICAL_GATES.md line 59 marks G45 'RETIRED 2026-07-21 — producer-layer growth freeze, lifted by Matt' with script and baseline deleted; CLAUDE.md carries 'Producer layer — freeze LIFTED 2026-07-21'; no G45/freeze script remains in package.json or scripts/. The unblocking this item asked for is complete — the producers it unblocks (weekend-events, re-brand) remain unbuilt, tracked under W10.3 and the Phase-4 backlog.


## W11

### W11.1 — NOT STARTED
**One generated banned-list source; consumers generated; parity test fails CI on any consumer drift**

*Evidence:* No wave commit touched any voice file (git log 5d5286a7~1..96f76ca1 --name-only has zero voice/vocab hits; no commits since 2026-07-21 mention voice or orwell). The pre-decision baseline is unchanged: /Users/matthewryan/RyanRealty/scripts/brand-voice-vocabulary.cjs is 'single source' for exactly 2 consumers (eslint-rules/no-brand-voice-violations.js + scripts/check-brand-voice.mjs), parity-tested by scripts/__tests__/brand-voice-vocabulary.test.cjs (wired via ci:hook-tests) — that test is dated GAP-7/2026-05-28, predates the decision, and checks only those 2 consumers. The drifted hand-typed copies the decision targets all still exist and still disagree: lib/marketing-brain/generate-briefs.ts:297-311 still hard-bans 'about', 'around', 'approximately', 'spacious', 'cozy', 'turnkey', 'leverage', 'navigate', 'comprehensive', 'foster' (all relaxed canonically 2026-06-02); app/api/cron/gbp-health-check/route.ts:36 has its own BANNED_WORDS; scripts/_producer_lib.py:350-400 has its own HARD_BANNED|SOFT_FLAGGED (includes 'approximately','roughly'); lib/email/voice-precheck.ts:24-32 has its own subset list with no parity test; lib/crm/templateVoiceCheck.ts has its own self-contained list (parity-tested separately). No generation step exists anywhere.

*Remaining:* Everything: collapse the ~12 hand-typed lists (generate-briefs.ts, gbp-health-check route, _producer_lib.py, voice-precheck.ts, templateVoiceCheck.ts, plus the copies inventoried in docs/plans/PROGRAM_2026-07-21/audits/brand-voice-enforcement-orwell-rules-migration.json) into generated consumers of brand-voice-vocabulary.cjs, fix the June-relaxed-word drift in generate-briefs.ts and _producer_lib.py, and extend the parity test to fail CI on any consumer drift (today it covers 2 of ~12).

### W11.2 — PARTIAL
**One shared voice-check function on every send path (blog, CMA/BPO prose, social captions, sequence templates) + ratchet gate on unchecked send paths**

*Evidence:* Only pre-decision pieces exist; nothing shipped after 2026-07-21. Covered today: newsletter sends via checkNewsletterVoice in lib/email/voice-precheck.ts, mechanically enforced by scripts/check-newsletter-voice-paths.mjs (ci:newsletter-voice-paths in ci:gates) — this is the 'newsletter pattern' the decision says to generalize; CRM template persistence via lib/crm/templateVoiceCheck.ts called from lib/crm/templateValidation.ts:99 / app/actions/crm-templates.ts, with parity test lib/crm/templateVoiceCheck.test.ts (committed ecce5538, 2026-06-25). NOT covered: blog publish — app/actions/blog.ts saveBlogPost (line 216) has zero voice references; CMA prose — lib/cma/render.ts has no runtime check (comment-only claims); BPO prose — lib/bpo/narrative.ts:5 claims 'compliant by construction', no check; social captions — app/api/social/publish/route.ts:197 runs only assertNoDashes (punctuation), no banned-word scan. No shared function exists (voice-precheck.ts and templateVoiceCheck.ts are independent implementations with independent lists), and no generalized 'voice-gate on send paths' ratchet gate exists — package.json shows only the newsletter-specific ci:newsletter-voice-paths.

*Remaining:* Build the one shared voice-check function (both existing runtime checks are separate self-contained lists); add blocking checks to blog publish (saveBlogPost), CMA/BPO prose render, and social caption word-scan; add the promised ratchet gate (ci:email-quality pattern) that fails CI when a send path lacks the check.

### W11.3 — NOT STARTED
**Orwell reviewer — advisory LLM pass on long-form (violations list + rewrite, facts unchanged), non-blocking**

*Evidence:* grep -rniE 'orwell' across all code/docs (node_modules and .next excluded) returns zero hits outside docs/plans/PROGRAM_2026-07-21/ (the plan/audit files themselves). The program's own migration audit (docs/plans/PROGRAM_2026-07-21/audits/brand-voice-enforcement-orwell-rules-migration.json) recorded 'Orwell six rules: missing, build from zero' and no commit since 2026-07-21 mentions orwell (git log --all --since=2026-07-21 --grep=orwell -i is empty). No passive-voice detector, no reviewer harness for blog/newsletter/market-narrative/CMA prose exists in scripts/ or lib/.

*Remaining:* The entire reviewer: advisory LLM pass over blog, newsletter, market narratives, and CMA prose that lists violations (stale phrases, long words with replacements, cuttable words, passive voice) then rewrites with facts/numbers/names unchanged, wired non-blocking alongside the deterministic floor.

### W11.4 — NOT STARTED
**Canon cleanup — VOICE.md Orwell + never-pander section; delete stale five-attribute SKILL.md model and contradictory cursor blog rules; repoint producer-gate references**

*Evidence:* All four sub-parts unchanged: (1) marketing_brain_skills/brand-voice/VOICE.md (135 lines, last commit 5c282e8f, pre-decision) has no Orwell or never-pander section — its headings end at 'The one exception — Matt's 1:1 correspondence'; grep for pander/orwell in the file returns nothing. (2) marketing_brain_skills/brand-voice/SKILL.md still carries the stale five-attribute model — 'The five voice attributes' table at line 27 (trustworthy/honest/knowledgeable/professional/dependable) and in its frontmatter description. (3) .cursor/rules/blog-voice.mdc still exists with its own independent tone rules and its own 'Forbidden Words/Phrases' list ('unparalleled', 'world-class', 'exclusive' — items not in the canonical vocabulary). (4) Producer-gate references not repointed: scripts/validate-producer.mjs:56 (G35) still hard-requires the literal string 'voice_guidelines.md' in every producer SKILL.md, the exact blocker the program audit flagged as preventing retirement of that file.

*Remaining:* All of it: add the Orwell + never-pander section to VOICE.md, delete the five-attribute model from SKILL.md, delete/reconcile .cursor/rules/blog-voice.mdc, and repoint the G35 validate-producer.mjs required-reference from voice_guidelines.md.

### W11.5 — NOT STARTED
**Rewrite pass over stored copy (published blog posts, templates) with the reviewer, batched, reviewed before republish**

*Evidence:* No rewrite tooling exists: ls scripts/ matches nothing for rewrite/orwell; no batch job, admin surface, or migration touches blog_posts or crm template bodies for voice rewriting in any wave commit (git log 5d5286a7~1..96f76ca1 --name-only has zero voice-related files). This item also depends on the W11.3 reviewer, which does not exist (zero Orwell hits repo-wide).

*Remaining:* Everything, and it is blocked behind W11.3: build the reviewer first, then run the batched rewrite over published blog posts (public.blog_posts) and stored CRM/sequence templates, with Matt review before republish.


## W12

### W12.1 — DONE
**Referral-capture tier: middleware 404 becomes light city page with live listings + capture form tagging geo:out-of-area; sitemap includes only top cities by inventory**

*Evidence:* middleware.ts:275-310 resolveGeoCityRedirect (commit 96f76ca1): /cities/<non-service-area> 308-> /oregon/<slug>, /oregon/<service-area> 308-> /cities/<slug>; old /cities hard-404 branch removed from isInvalidGeoSlug, junk slugs still get a real 404 from the page guard (app/oregon/[city]/page.tsx:99-102 notFound()). app/oregon/[city]/page.tsx: honest copy ('${city} is not a market we work in person'), live inventory via getListingTiles over listing_tile_mv, stats from geo_snapshot_mv (lib/data/geo/getOutOfAreaCities.ts:60). Capture form components/site/kb/KbOutOfAreaReferral.client.tsx -> app/actions/out-of-area-referral.ts tags geo:out-of-area + referral:candidate + city-interest:<slug> via ensureNativeLead; only internal broker alert + task fire, no lead-facing sends. Sitemap: app/sitemap.ts:440-443 pushes getOutOfAreaCitySitemapEntries(); policy OUT_OF_AREA_INDEXABLE_MIN_ACTIVE=5 / TOP_N=25 in lib/out-of-area-cities.ts:42-45 with unit tests lib/out-of-area-cities.test.ts (committed in 96f76ca1); non-indexable cities render noindex via generateMetadata (page.tsx:86-92). Commit message records browser-verification of /oregon/klamath-falls + /oregon/medford.

### W12.2 — DONE
**Buyer intake geocoding: classify inquired property, route out-of-area leads to referral queue instead of standard buyer drip**

*Evidence:* lib/referral-geo.ts (pure module, 16 tests in lib/referral-geo.test.ts): classifyPropertyGeo, cityFromListingAddress, referralIntakeTags, geoReferralEnrollBlock; fail-closed geo:unclassified when city unparseable. Wired into app/actions/track-contact-agent.ts:76-77 and :140 (listing inquiry paths, parses city from listingAddress) and app/contact/actions.ts:56-65 (tour/question path via tile City/State). Drip block: lib/crm/enroll.ts:71-72 geoReferralEnrollBlock inside autoEnrollPerson, which covers both the intake fire-and-forget path and the 15-min crm-auto-enroll catch-all cron. Queue: listReferralCandidates (lib/data/crm/referralReceivables.ts:64) surfaces referral:candidate + geo:unclassified people on /admin/crm/referrals. Gate deliberately keys on referral:candidate not bare geo:out-of-area to avoid breaking the pre-existing seller-LP geocode path (documented lib/referral-geo.ts:117-122). Classification is city-name matching against the service-area allowlist, not lat/lng geocoding, which satisfies the decision's intent (classify the inquired property).

### W12.3 — PARTIAL
**Referral disposition in CRM: referral: tag namespace + Referred-Out disposition + light receivable record (25% inbound fee)**

*Evidence:* Tag namespace: REFERRAL_CANDIDATE_TAG='referral:candidate' (lib/referral-geo.ts:30), applied by both intake paths and the /oregon LP form. Receivable: supabase/migrations/20260722212000_referral_tier.sql creates referral_receivables (fee_basis_pct numeric default 25, status pending->agreement-sent->active->closed->paid|dead, RLS on with no policies = service-role only); applied to hosted Supabase — table present in docs/DATABASE_SCHEMA_SNAPSHOT.md line 3511, snapshot regenerated from live prod 2026-07-22T14:42Z. Disposition surface: app/admin/(protected)/crm/referrals/page.tsx — record-handoff form -> recordReferralReceivable (lib/data/crm/referralReceivables.ts:130) inserts receivable + crm_timeline system entry; queue removes people with a receivable row (page.tsx:54-55); admin nav child at lib/admin/nav.ts:124 (nav budget pins bumped 37/20->38/21). W9/agreement e-sign explicitly deferred by the decision itself. Gap: no first-class Referred-Out marker on the person record — CRM_STAGES (lib/crm/constants.ts:3-9) has no Referred-Out stage, and recordReferralReceivable writes nothing to crm_people (no referral:referred-out tag, no stage change); the disposition is only derivable from the receivables join, so the person keeps stage 'Lead' + referral:candidate everywhere else in the CRM (people lists, smart views, person detail).

*Remaining:* Write a person-level Referred-Out disposition when a handoff is recorded — either a 'Referred Out' stage in CRM_STAGES or a referral:referred-out tag stamped by recordReferralReceivable — so the state is visible/filterable on the person record, not only on /admin/crm/referrals via the receivables join.

### W12.4 — YOUR CALL / OPS STEP
**One prod query confirms Burns/Harney presence and sizes the real out-of-area inventory**

*Evidence:* Query scaffolding exists: lib/out-of-area-cities.ts:102-116 countOutOfAreaCitiesWithActiveAtLeast with the exact prod SQL shape documented ('spot-check against live'), and lib/data/geo/getOutOfAreaCities.ts:132 documents the same spot-check SQL. But no recorded result anywhere: grep for Burns/Harney across docs/, lib/, app/, scripts/, docs/plans/PROGRAM_2026-07-21/ and git log returns only Ken Burns animation refs, the Spark coverage-counties note (docs/research/spark-mls.md:307), and the pre-Wave-D audit which itself confirmed zero Burns/Harney code presence (docs/plans/PROGRAM_2026-07-21/audits/geographic-page-system-subdivisions-neighborho.json:63). Wave D commit 96f76ca1 browser-verified /oregon/klamath-falls and /oregon/medford, never Burns; middleware.ts:278 cites 'Medford: 672 active at audit' but no Burns/Harney figure or out-of-area inventory sizing trace is recorded in any tracked doc. This audit is barred from querying prod, so the confirmation cannot be produced here either.

*Remaining:* Run the documented one-off query against prod geo_snapshot_mv (count out-of-area cities with active_all_count >= 5; confirm whether Burns appears and at what count) and record the result with a verification trace in the program package (04-DECISIONS-RECORDED.md or the W12 lane notes).


## W13

### P0.1 — DONE
**Phase 0 gate: ci:cron-registered (G53) — every cron route registered or marked**

*Evidence:* scripts/check-cron-registered.mjs + scripts/cron-registered-baseline.json (shrink-only, 11->9 in Wave A); package.json has ci:cron-registered inside ci:gates chain; docs/MECHANICAL_GATES.md row G53; shipped in commit 37e83538, baseline shrunk in 5d5286a7. 12 routes carry cron: invoked-by / manual-only markers.

### P0.2 — DONE
**Phase 0 gate: ci:reachable-exports (G55) — no orphaned components/endpoints**

*Evidence:* scripts/check-reachable-exports.mjs (227 lines, Wave A 5d5286a7) + scripts/reachable-exports-baseline.json (~202-entry shrink-only backlog); ci:reachable-exports in ci:gates (package.json line 178); docs/MECHANICAL_GATES.md row G55; orphan class proven closed by Wave A/D deletions (HeroSearchOverlay, SearchSplitView, SmartSearch in 96f76ca1).

### P0.3 — PARTIAL
**Phase 0 gate: ci:sitemap-resolvable — sitemap-emitted URL family whose resolver can 404 fails CI**

*Evidence:* No script named or matching sitemap-resolvable exists: grep of package.json and scripts/*.mjs finds nothing; docs/MECHANICAL_GATES.md has no such gate. What landed instead: one-shot drift fixes in 37e83538 (communities derived from data/resort-communities.json, 404-ing /cities/{city}/{subdivision} URLs de-emitted) plus family-specific contract tests in Wave D 96f76ca1 (lib/data/subdivisions/subdivision-index.test.ts sitemap<->llms.txt parity, lib/data/seo/derive-search-links.test.ts, lib/seo/search-matrix.test.ts).

*Remaining:* Build the general gate: enumerate every URL family app/sitemap.ts emits and prove each resolves (or is covered by a per-family contract test), wired into ci:gates as ci:sitemap-resolvable. Today only subdivision/search-matrix families have contract tests; cities, communities, neighborhoods, ZIP, blog, /oregon/[city] families have no resolver-parity check, so the 2026-07-21 drift class can silently recur.

### P0.4 — PARTIAL
**Phase 0: heartbeat cron — registered pipeline silent past cadence alerts Matt**

*Evidence:* lib/pipeline-heartbeat.ts (223 lines) + lib/pipeline-heartbeat.test.ts (26 tests), Wave A 5d5286a7; wired into app/api/cron/loop-health-check/route.ts (imports @/lib/pipeline-heartbeat), registered in vercel.json (/api/cron/loop-health-check); monitors 6 pipelines: sync-delta, listing_search_mv, fsbo-scrape, expired-detect, saved-search-alerts, market_stats_cache; one consolidated stale-alert email.

*Remaining:* The verdict's third named example — audience sync — is not monitored: grep of lib/pipeline-heartbeat.ts and loop-health-check/route.ts finds no westside/meta-audience probe, and the Wave C crons (meta-westside-audience, westside-cohort-digest, vercel.json lines 212/216) have no staleness coverage. Add heartbeat probes for the audience-sync pipelines (and any cron registered after Wave A).

### W13.1 — PARTIAL
**CLAUDE.md shrinks — stale facts out, rules become gates, file converges to canon pointers**

*Evidence:* Only commit 37e83538 touched CLAUDE.md since 2026-07-20 (64 lines: approval-model section rewritten, G45 section shrunk to lift record). File is still 1044 lines (identical count to pre-Wave-A 5d5286a7~1). Stale facts remain: routing table still cites docs/FUB_SELLER_WORKFLOW_2026-05-17.md and app/api/cron/seller-workflow-pause/route.ts (route does not exist on disk), FACEBOOK_SELLER_GROWTH_PIPELINE.md, voice_system_v2 (3 refs), _style_backup — despite recorded decision 04-DECISIONS-RECORDED.md section 3 ('zero reference to FUB'). Mechanism inputs exist: G44 ci:process-canon in ci:gates, docs/plans/PROGRAM_2026-07-21/audits/CONSOLIDATION-LANES.json committed, FUB-purge handoff package d5148bba.

*Remaining:* Execute the shrink: purge FUB-era sections and dead-path citations from CLAUDE.md, delete/archive the ~30 FUB_*.md docs the recorded decision condemned (all still in docs/), convert surviving prose rules to gate pointers. The prepared CONSOLIDATION-LANES.json verdicts have not been acted on.

### W13.2 — PARTIAL
**No new plan files; rogue-plan gate arm fixed (deletions + subdirectories)**

*Evidence:* Behavior held: git log --diff-filter=A since 2026-07-21 shows zero new docs/plans/*.md outside PROGRAM_2026-07-21/ and ADMIN_REBUILD/; decisions merged into docs/plans/PROGRAM_2026-07-21/04-DECISIONS-RECORDED.md section 9. But the gate arm is untouched: scripts/check-process-canon.mjs lines 63-71 still do non-recursive readdirSync('docs/plans') filtered to top-level .md (subdirectories like PROGRAM_2026-07-21/ and ADMIN_REBUILD/ are invisible to the rogue check) and only flag present-but-unregistered files (a deleted registered plan never fails). git log shows no commits to the script since before 2026-07-01.

*Remaining:* Fix scripts/check-process-canon.mjs: recurse into docs/plans subdirectories for the rogue check, and fail when a canon-registered plan file no longer exists on disk (the deletions arm).

### W13.3 — PARTIAL
**Skills reviewed and streamlined — five loop skills tracked, stale state stripped, updated to new approval model; retired producer stubs deleted; contradicting cursor rules die**

*Evidence:* Only the preservation step happened: docs/plans/PROGRAM_2026-07-21/preserved-skills/{crm-e2e,tc-builder}/SKILL.md are git-tracked (commits 4b1f200f/d5148bba, 2026-07-21). Everything else is unexecuted: git ls-files .claude/skills/ shows crm-e2e and tc-builder still NOT tracked (present on disk only; .gitignore .claude/skills/* has no un-ignore lines for them); .claude/skills/tc-builder/SKILL.md line 281 still carries the embedded 'PAUSED — Matt directive 2026-06-11' block; growth-loop, experience-rollout, local-seo, tc-builder SKILL.md all still encode the old draft-first approval model (grep hits at growth-loop:56/88, experience-rollout:56, local-seo:15, tc-builder:237-264) and none references the 2026-07-21 model; git log shows zero commits to .cursor/ or marketing_brain_skills/producers/ since 2026-07-20 (.cursor/rules/blog-voice.mdc still present; no retired-stub deletions).

*Remaining:* Promote the preserved crm-e2e + tc-builder copies to tracked .claude/skills (add .gitignore un-ignore lines), strip the tc-builder PAUSED block and other stale fleet state, rewrite the approval-model sections of all five loop skills to the 2026-07-21 model, delete retired producer stubs, delete/reconcile cursor rules that contradict canon (blog-voice.mdc et al).

### W13.4 — DONE
**Draft-first commit hook rewritten to enforce the 2026-07-21 approval model**

*Evidence:* scripts/check-draft-first.mjs rewritten in 37e83538: header documents the 2026-07-21 model; trigger narrowed to public/**.{mp4,mov,webm}; clears on Approved-by: matt / Draft-shown: <url> / DRAFT_FIRST_OK=1; invoked by .husky/commit-msg line 4. CLAUDE.md READ-SECOND section rewritten to the four per-action classes in the same commit. Code and site content now commit clean, matching 04-DECISIONS-RECORDED.md section 9.4.

### Q1 — DONE
**Question 1: producer freeze G45 — lift?**

*Evidence:* Answered LIFTED 2026-07-21: 04-DECISIONS-RECORDED.md section 9.1; commit 37e83538 deleted the gate script + baseline (no *freeze* file in scripts/, no ci:producer-freeze in package.json); CLAUDE.md 'Producer layer — freeze LIFTED 2026-07-21'.

### Q2 — DONE
**Question 2: expired capture scope — keep $500K / SFR / 6-city floor or widen?**

*Evidence:* Answered KEPT 2026-07-21: 04-DECISIONS-RECORDED.md section 9.2 ('The 2026-05-19 scope stands: SFR, $500K+, six cities. Widening is a one-constant change whenever Matt says so.'). Commit message 37e83538 records 'KEEP EXPIRED FLOOR'.

### Q3 — DONE
**Question 3: newsletter audience — past clients + engaged leads + West Side cohort?**

*Evidence:* Answered START 2026-07-21 with exactly that audience: 04-DECISIONS-RECORDED.md section 9.3 ('past clients + engaged leads + the West Side cohort, consent-respecting. Not the full ~12K cold book'), with named preconditions (postmaster cron — wired in Wave A as /api/cron/postmaster-sync in vercel.json; Resend-webhook registration check). First-issue execution is a W9 item, not part of this question.

### Q4 — SUPERSEDED
**Question 4: indexable sold-listing pages — ORMLS/IDX display-rule confirmation**

*Evidence:* Resolved NO by the ODS Rules review, same day: 04-DECISIONS-RECORDED.md section 9.6 — ODS Aug-2024 section 5-3 licenses active-only IDX display, section 5-4 A.4 makes sold data VOW-only behind sign-in; public indexable sold pages are off the table. Mechanically pinned by G54: scripts/check-ods-compliance.mjs, ci:ods-compliance in ci:gates, docs/MECHANICAL_GATES.md row G54, commit f99397d3, memory reference_ods_rules.

### Q5 — DONE
**Question 5: approval model — confirm the 2026-07-21 decision, then rewrite the hook**

*Evidence:* Confirmed 2026-07-21: 04-DECISIONS-RECORDED.md section 9.4; CLAUDE.md 'Approval Model — confirmed by Matt 2026-07-21' section replaces Draft-First-Commit-Last; scripts/check-draft-first.mjs narrowed accordingly and wired via .husky/commit-msg (commit 37e83538). Runtime arms exist independently: publisher humanApprovedAt stamp, governed sends (ci:governed-send, ci:email-send-gated in ci:gates).
