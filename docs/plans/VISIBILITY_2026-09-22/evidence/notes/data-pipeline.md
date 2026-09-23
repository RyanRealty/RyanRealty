# data-pipeline reader — long-form notes (2026-09-22, HEAD 83a459c, branch claude/admiring-feynman-7lgwc3)

Read-only. `git status --short` empty before and after. Scratch files: this dir (sync-status.json, db-reads*.mjs + .out, body_*.html).
Evidence sources: repo files (paths:lines), `node scripts/sync-status-report.mjs --json`, scratch helper reads through supabase-js
(service role), and — BEFORE the orchestrator banned MCP tools mid-task — Supabase `get_advisors`, `query_logs` (ClickHouse over
postgres_logs), one `execute_sql` row read of `cron.job` / `cron.job_run_details` / `market_pulse_live` / `market_stats_cache`, and
Vercel `get_runtime_errors` / `get_runtime_logs group_by` / `list_deployments`. Those captured results stand; nothing was re-queried
after the ban. Anything I could not re-check is marked UNVERIFIED.

## 1. Sync (Spark → Supabase)

`node scripts/sync-status-report.mjs --json` (2026-09-22T19:36Z):
- totalListings 596,891 · listing_history rows 3,912,714 · history_finalized 587,825 · history_verified_full 587,519
- activeListingFreshness: lastDeltaSuccessAt 2026-09-22T19:33:13Z, deltaHealth "current", 2.9 min since; deltaEligibleListings 9,066
- activity_events last 24h (246 sampled): price_drop 109, new_listing 47, status_closed 34, status_pending 31, status_active 9, canceled 6, expired 6, withdrawn 4
- strictVerification: backlog 305 (expired 303, closed 2); runTelemetry.health "stalled — No strict verify run in about 230,365 minutes"
  (last run 2026-04-15T20:11Z). Cause: `/api/cron/sync-verify-full-history` has a route dir but is NOT in vercel.json (see §5 orphans).
- warnings: `listing_year_finalization_stats` and `listing_year_on_market_finalization_stats` "Could not find the table" (PGRST205) —
  the script still reads MVs that were dropped; `/api/cron/refresh-listing-year-stats` route exists but is unregistered.
- cursors.syncCursor phase idle, cron_enabled true. yearCursor legacy (updated 2026-04-14).
- Freshness confirmed independently via helper: price_history latest created_at 2026-09-22T19:48:16Z; listing_history latest
  2026-09-22T19:48:18Z; activity_events latest price_drop 2026-09-22T19:48:13Z. Delta lane is live.
- Running the report itself costs the DB: postgres_logs show its own PostgREST count queries at 17–32 s
  (`listings WHERE StandardStatus ilike $1 AND history_finalized = $2 ... count`) and `report_listing_history_row_count()` at 64.5 s
  (19:35:34Z). The status report is a heavy query against the 597K-row table.

Doc drift: docs/SYNC.md:7-8 says delta every 2 min via Inngest and full sync every 10 min via Vercel cron; vercel.json has
`sync-delta` at `3,18,33,48 * * * *` (every 15 min) and `sync-full` at `0 2 * * 0` (weekly). SYNC_HANDOFF_PLAYBOOK names
`sync-parity`, `start-sync`, `sync-verify-full-history` as lanes — none is registered in vercel.json.

Ingest coverage (lib/sync/deltaSync.ts:71): `EXPAND: 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents,CustomFields'`.
lib/spark.ts:697-735 maps OpenHouses into the row; the `listings.OpenHouses` column is read at request time (15 timeouts/24h on
`SELECT ListingKey, City, OpenHouses FROM listings ...`). Tables: `open_houses` 20 rows, last created 2026-04-03 (dead as a table, the
column is live); `listing_videos` 31 rows, latest 2026-09-21T04:56Z (written by lib/data/sync/syncWrites.ts:387-390; the coverage index
dated 2026-08-22 calls it DEAD — stale); listing page calls `getListingVideos` with an 8 s timeout fallback
(app/listing/[listingKey]/page.tsx:375); `listings_historical` 0 rows (Spark Historical Listings endpoint never ingested —
"previously listed at $X" not available); `listing_photos` 4,124 rows (2026-04-04) and `listing_photo_classifications` 0 — photos live
in `details` JSON. docs/SPARK_FIELDS_AUDIT.md still points at `app/actions/sync-spark.ts` and lists HOA/schools/garage/taxes as
"check the API" — never closed; CustomFields is now expanded but the doc does not say so.

## 2. Caches, methodology, accuracy path

- `market_pulse_live`: 45 rows (17 city/region + 28 neighborhood), every row `methodology_version = 'v3-2026-05-07'`, updated_at
  19:33:18Z (city/region) and 19:34:06Z (neighborhood) — fresh. (execute_sql row read, before ban.)
- `market_stats_cache`: latest computed_at 2026-09-22T19:45:00Z, v3-2026-05-07. The 15-minute pg_cron pipeline
  (`post_sync_pipeline_runs`: stats_runs 60, stats_errors 0, pulse 45 rows, total 28–53 s) recomputes 60 period stats every 15 min;
  the Vercel `/api/cron/refresh-market-stats` also runs daily 07:00. docs/DATABASE_FOR_AI_AGENTS.md:125,204 say "every 6 hours".
- `cache_methodology_definitions` v3 row present (helper read). Only v4 mention in app/lib is a comment in
  app/actions/market-stats.ts:229-232 that correctly says no live row carries v4. No page claims v4. OK.
- Neighborhood-grain MoS in `market_pulse_live` (row read 19:34Z): bend-summit-west 48.60 (81 actives), bend-century-west 50.00 (25),
  bend-awbrey-butte 32.40 (54), pronghorn 66.00 (11), brasada-ranch 15.60, bend-boyd-acres 13.14; city terrebonne 30.00 on 5 actives.
  lib/market/geo-grain-trust.ts:1-40 documents why: `refresh_community_market_pulse()` takes actives from the polygon xref and closes
  from a `neighborhood_subdivisions` TEXT join → different populations; measured 2026-08-19 century-west 2 closes via alias vs 42 in
  polygon. Pages withhold via lib/market/publish-months-of-supply.ts (grain-gated) and publishPlaceFace; the neighborhood page sets
  `monthsOfSupply: null` at app/cities/[slug]/[neighborhoodSlug]/page.tsx:493 and community page :556. The WRITER still emits the
  impossible number every 15 min with a v3 stamp; consumers that do not pass the gate (JSON feed, CRM report, CMA) depend on each
  call site remembering. `lib/market/classify.ts:23` has no small-n guard (only `closedLast6Months <= 0`).
- refresh-market-stats errors (Vercel runtime errors, 48h): `compute_and_cache_period_stats: neighborhood bend-undesignated has no
  subdivisions in neighborhood_subdivisions` ×10 across rolling_30d/90d/365d/monthly/quarterly — that bucket never gets stats.
- More than one computation path for public numbers (grep):
  - MoS: lib/market/classify.ts:21 (canonical JS) · SQL `refresh_market_pulse()` · SQL `refresh_community_market_pulse()` ·
    `compute_and_cache_period_stats` · market-truth mt-v1 shadow cells (`/api/cron/compute-neighborhood-metrics`,
    `/api/cron/compute-subdivision-metrics`, `refresh-sale-pricing-facts` → `compute_market_metrics_shadow`, which timed out 8× in 48h).
  - Median: 6 copy-pasted `medianListPrice()` in lib/data/{parks,trails,golf,events,venues,schools}/get*Detail.ts, each over a
    request-time bounding-box scan of raw `listings` (lib/data/parks/getParkDetail.ts:132-147: `.from('listings')...gte/lte Latitude/
    Longitude ... limit`), plus lib/data/geo/neighborhood-public-inventory.ts:70, lib/data/analytics/rebuildAnalyticsMarts.ts:78,
    lib/data/listings/getRepeatSalesAppreciation.ts:48, lib/data/proof/outcomes.ts:126, and SQL percentile_cont in RPCs.
  docs/plans/STATISTICS_ENGINE_MISSION.md (Matt 2026-08-17: "only one source of statistics ... always through this engine") is not
  met for these amenity pages.

## 3. F7 / materialized views / database load — the central finding

pg_cron (`cron.job`, row read before ban):
| jobid | name | schedule | command |
|---|---|---|---|
| 146 | post_sync_pipeline_15min | */15 | run_post_sync_pipeline('cron-15min') |
| 147 | post_sync_pipeline_safety_net | 30 9 * * * | same |
| 162 | rr_search_facet_counts_refresh | 12,27,42,57 | rr_refresh_search_facet_counts() |
| 163 | refresh_dal_mvs_15min | 5,20,35,50 | set local statement_timeout 900s; refresh_geo_snapshot_mv(); refresh_listing_boundary_xref_mv(); refresh_listing_search_mv(); … |
| 164 | refresh_listing_tile_mv_30min | 2,32 | set local statement_timeout 1800s; refresh_listing_tile_mv() |
| 182 | rr_redact_listing_details_30min | 9,39 | UPDATE listings … (90-min window) |
| 210/211 | subdivision_plat_closed / city_inventory nightly | 10:20 / 10:56 | |

`cron.job_run_details` 14:42–19:39Z (80 rows): job 164 durations 387, 401, 398, 389, 387, 407, 406, 435, 471 s (avg ≈409 s, 2×/h);
job 163: 234–347 s (avg ≈267 s, 4×/h); job 146: 19–223 s (avg ≈51 s, 4×/h); job 162: 3 s. Sum ≈ 2,100 s of refresh work per hour
(58% of wall clock before overlap). 164 (:02→~:09) and 163 (:05→~:09:30) overlap by design of the clock. All runs "succeeded";
F7's 600 s failures are gone (F7 migration 20260729193000 applied; 20260801053000 confirms no `now()` column; `mv_refresh_state`
listing_tile_mv_src refreshed 19:39:29Z). F7's own "honest residual" — REFRESH CONCURRENTLY re-runs the full 594K-row query — is
now the whole cost, twice an hour, plus a 4–5 min job 163 that F7 described as cheap.

postgres_logs (ClickHouse, 24h to 19:37Z): **954 "canceling statement due to statement timeout"**, all `application_name = postgrest`.
By 5-minute bucket of the hour: :00 170 · :05 213 · :10 104 · :15 14 · :20 22 · :25 80 · :30 72 · :35 132 · :40 29 · :45 49 · :50 50 · :55 12.
487 of 954 (51%) land in :00–:14, when 146 (:00), 164 (:02), 163 (:05) and the Vercel `refresh-mvs` (:08) all run; the :30–:39
bucket (204) is the other tile-refresh window. Hourly: spikes 03:00Z 168, 13:00Z 189, 14:00Z 144, 15:00Z 161.
Timed-out query shapes (count): listing_tile_mv tile reads 327 (getListingTiles; search + place pages) · RPC(p_city,p_days) =
`analytics_financing_mix_co` 179 (/housing-market/bend; the function sets statement_timeout 8 s) · raw `listings` bbox projection
`ListingKey, ListPrice, BedroomsTotal…` 133 (the five amenity detail DALs) · `listing_history WHERE event_date >=` 98
(lib/data/listings/getListingDetailBundles.ts:110-322) · raw `listings` closed keyset (`StandardStatus ilike, CloseDate >=, ClosePrice >=,
lat/lng not null, City = ANY, ORDER BY ListingKey`) 83 (lib/data/listings/getAtlasTiles.ts:186-197) · `SELECT PostalCode FROM listings`
42 (app/sitemap.ts:516-521 zip leg) · RPC(p_shapes) 25 (searchListingsAll shapes) · `listings … OpenHouses` 15 ·
`SELECT City FROM listings` 11 · `listing_tile_mv … city_lower` 10 · `refresh_listing_tile_mv()` via PostgREST 1.

Vercel runtime errors (48h to 19:39Z; captured before the ban; 50 clusters, first 222 lines read, rest are ≤2-count repeats):
- `[Error: An error occurred in the Server Components render…]` **count 7,602, users 549**, routes /cities/bend/boyd-acres,
  /cities/bend/summit-west, /communities/juniper-preserve, /cities/bend (+ .segments .rsc); a second cluster of the same 2,534/549.
- `Failed to load static file for page: /500 ENOENT …/.next/server/pages/500.html` **2,555, users 570**, same routes. app/error.tsx and
  app/global-error.tsx exist; there is no pages/ dir; the fallback Next reaches for is missing, so the visitor gets a raw 500.
- `[build-place-atlas] read failed … [getAtlasTiles] … statement timeout` 394 / 123 users on /, /search, /contact, /cities, /communities/crosswater.
- listing-detail lookups TimeoutError 52+3; `@react-pdf/stylesheet` ERR_MODULE_NOT_FOUND 42 / 21 users on /api/pdf/report,
  /api/reports/export; `chrome-live: incomplete read` 39; `[searchListingsAll] shapes RPC unavailable` 25; getFinancingMix 13;
  `[getCommunitySubdivisions] RPC error … statement timeout` 11; getListingTiles timeouts for Grants Pass / Klamath Falls / Medford /
  Bend / Madras / Larkspur / Boyd Acres / Old Farm (out-of-market cities dominate); `Vercel Runtime Timeout … 300 s / 800 s / 60 s` 8 on
  cma-solicit-screen, refresh-place-content, marketing-competitor-recon, crm-health-check, /cities/redmond; refresh-sale-pricing-facts
  `compute_market_metrics_shadow upstream request timeout` 8; getParkDetail timeouts (shevlin 6, sawyer 4, riverbend 3, …);
  `[withTimeoutFallback:comm:stock] TypeError: f is not iterable` 4 on /communities/widgi-creek.
- Vercel 5xx by requestPath (48h): /api/cron/refresh-mvs 24, then ~180 /subdivisions/* paths (elkai-woods 13, forest-park 13, …),
  /api/pdf/report 6, /api/cron/refresh-sale-pricing-facts 4.
Live re-check (Chrome UA, 19:49–19:55Z): /cities/bend/boyd-acres 200 0.44 s 1,915,329 B · /cities/bend/summit-west 200 0.62 s
2,144,553 B · /communities/juniper-preserve 200 0.46 s 335,787 B · /cities/bend 200 0.53 s 3,773,923 B (x-vercel-cache STALE; a first
attempt got "Connection reset by peer" after 11 s) · /communities/widgi-creek 200 · /housing-market/bend 200 · /homes-for-sale 200
1.18 s 719 KB (MISS). /about and /communities/caldera-springs: sandbox proxy failed (ws_closed_mid_exchange) — UNVERIFIED.
So the errors are intermittent and line up with the refresh windows, not permanent breakage.

Duplicate refresh path: app/api/cron/refresh-mvs/route.ts (vercel.json `8 * * * *`) calls refresh_listing_tile_mv, geo_snapshot,
boundary_xref, listing_search, neighborhood_year_pricing through PostgREST, returns HTTP 500 when any RPC fails (route.ts:150). Its
header still says "every 15 minutes" and "~30-40 s" (route.ts:7-11,26-30); the tile refresh is 387–471 s and pg_cron already owns
all but neighborhood_year_pricing. At :08 it fires while 164 (:02) and 163 (:05) are still running. `refresh_listing_tile_mv()` DOES guard with
`pg_try_advisory_lock(7101)` (supabase/migrations/20260729193000_listing_tile_mv_drop_now_refreshed_at.sql:326-345) and returns
`{ok:true, skipped:true}` on a miss — so while 164 holds the lock the Vercel call is a harmless no-op for the tile view; when 164
has already finished (it runs ~6.5-8 min from :02, so :08 is a coin flip) the Vercel call takes the lock and runs a THIRD full tile
refresh through PostgREST, which is what the one observed PostgREST statement timeout of `refresh_listing_tile_mv()` is. The other
four RPCs (geo_snapshot, boundary_xref, listing_search, neighborhood_year_pricing) run every hour regardless; whether they hold
their own locks is UNVERIFIED. The 24 5xx/48h are the observed effect; the exact failing RPC is UNVERIFIED (log query timed out).

Advisors (get_advisors, before ban): PERFORMANCE — unused_index 256 (on hot tables: listings ×11 incl. idx_listings_price_per_sqft,
sale_to_list, days_to_pending, school_district, estimated_piti, boundary_subdivision, remarks_fts_active_gin, status_lower,
city_vt_modts, list_agent_mls_id, buyer_office_name; listing_history ×3; market_stats_cache, market_pulse_live, boundaries polygon,
crm_people ×5), auth_rls_initplan 57, multiple_permissive_policies 49, unindexed_foreign_keys 37, duplicate_index 10 (boundaries,
crm_tasks, expired_listings, listing_history, market_pulse_live, market_stats_cache, marketing_brain_actions, saved_listings),
auth_db_connections_absolute 1. No slow-query lint returned. SECURITY — rls_enabled_no_policy 160, security_definer_view 12 (ERROR:
analytics_v_closed_sale_co, audit_winners, geo_snapshot_mv, listing_boundary_xref_mv, listing_tile_mv, similar_listings_mv,
site_signal, subdivision_plat_unsold_anchor, target_query_benchmark, v_boundary_counts/hierarchy/validity), function_search_path_mutable
121, rls_disabled_in_public 1 (spatial_ref_sys), extension_in_public 3 (pg_trgm, postgis, vector), materialized_view_in_api 4,
anon_security_definer_function_executable 35, authenticated_security_definer_function_executable 39.

## 4. RUM (web_vitals, 60,000 most recent rows = 2026-09-17T11:33Z → 2026-09-22T19:52Z, JS p75)
| class | n LCP | LCP p75 ms | INP p75 | CLS p75 | TTFB p75 ms |
|---|---|---|---|---|---|
| other | 7,084 | 9,040 | 96 | 0.002 | 368 |
| search (/homes-for-sale,/search) | 2,125 | 8,244 | 176 | 0.089 | 2,080 |
| subdivision | 327 | 4,548 | 88 | 0 | 2,628 |
| city | 252 | 3,136 | 184 | 0.014 | 999 |
| home | 249 | 4,572 | 96 | 0.004 | 762 |
| market-blog | 210 | 3,504 | 72 | 0.003 | 1,120 |
| community | 165 | 6,052 | 112 | 0.004 | 1,950 |
| neighborhood | 87 | 12,484 | 136 | 0.008 | 1,055 |
| listing | 41 | 2,548 | 48 | 0.003 | 471 |
| place-type | 31 | 4,136 | 24 | 0.005 | 1,279 |
| zip | 19 | 11,588 | 16 | 0.002 | 1,053 |
Worst paths (n≥10): /communities/caldera-springs 19.5 s, /homes-for-sale 16.7 s (n 104), /about 15.7 s (n 72), /communities 15.5 s,
several /homes-for-sale/<out-of-market> 10–14 s, /communities/northwest-crossing 10.6 s. Every public class is above the 2.5 s
"good" LCP threshold. web_vitals total 773,032 rows. site_signal source=rum also holds lcp/fcp/ttfb/cls/fid/inp (scope page).

## 5. Cron inventory (vercel.json 76; app/api/cron has 91 route dirs)
Registered (schedule → purpose): analytics-daily-digest 14:30 email · blog-monthly-city-report monthly · broker-agent-digest 14:00 ·
buyer/seller-lead-attribution daily · cma-build-worker */30 · cma-solicit-screen hourly (Vercel 300 s timeouts) · compute-neighborhood-
metrics + compute-subdivision-metrics every 6 h (mt-v1 shadow cells) · crm-alert-drain every minute · crm-auto-enroll 4×/h ·
crm-bulk-worker */2 · crm-geo-resolve daily · crm-gmail-sync 4×/h · crm-health-check 2×/h (300 s timeouts) · crm-market-report-send 4×/day ·
crm-portal-lead-intake 4×/h · crm-response-clock */5 · crm-scheduled-sends */5 · crm-sequence-engine 4×/h · crm-task-reminders daily ·
daily-broker-digest 15:00 · deploy-health 2×/h · detect-fsbo-listings daily · dnc-scrub weekly · fred-ingest daily · gbp-health-check daily ·
gbp-monthly-digest monthly · generate-market-narratives daily · loop-health-check daily · **loop-sentinel */10 (kill switch
LOOP_SENTINEL=off → 144 `loop_sentinel:skip` rows/24h = 93% of all sync_logs rows)** · market-history-snapshot weekly ·
market-report weekly · market-stat-consistency daily · marketing-competitor-recon weekly (300 s timeout) · marketing-inbox-poll */15 ·
marketing-measurement-loop daily · marketing-optimization-report weekly (producer-era report email) · meta-audience-sync daily and
meta-westside-audience daily (DRY-RUN unless env flag; flag state UNVERIFIED) · newsletter-monthly-draft · newsletter-reconcile hourly ·
newsletter-send */2 · offline-conversions daily (Meta upload; env-gated, UNVERIFIED) · **performance-pull-48h/7d/30d daily — read
marketing_brain_actions status='executed'; latest executed row 2026-08-18 (format comms_matt_summary); content_performance has 6 rows,
all measured 2026-06-16 with null impressions → three dead crons** · postmaster-sync daily · prospecting-first-touch-drip every minute ·
publisher-sweep */30 · rebuild-analytics-marts daily + weekly full · refresh-market-stats daily 07:00 · refresh-market-stats-monthly-
recompute weekly · **refresh-mvs hourly (duplicate of pg_cron 163/164; 24 5xx/48h)** · refresh-place-content daily (300 s timeout) ·
refresh-sale-pricing-facts every 6 h (8 upstream timeouts) · refresh-similar-listings daily · refresh-subdivision-stats daily ·
review-ask-on-close daily · saved-search-alerts hourly · skyslope-mirror-refresh daily · snapshot-active-inventory daily ·
snapshot-channels daily (fans out to the 8 unregistered marketing-snapshot-* routes) · sync-delta 4×/h · sync-full weekly ·
sync-history-terminal hourly · taxlot-refresh daily · tc-deal-calendar daily · tc-envelope-reminders hourly · token-heartbeat daily ·
visitor-hot-lead-escalation */15 · warm-geo-pages */10 · warm-sitemaps hourly · weekly-pipeline-digest, westside-cohort-digest weekly.
Short-cadence invocations ≈ 5,400/day (two every-minute crons alone = 2,880).
Orphan route dirs not in vercel.json (15): detect-expired-listings, marketing-snapshot-{ga4,gbp,gsc,meta-ads,meta-page,tiktok,x,youtube},
neighborhood-default-subscriptions, refresh-listing-year-stats, start-sync, studio-slate, sync-parity, sync-verify-full-history.
G53 (scripts/check-cron-registered.mjs) tolerates a baseline that may only shrink.
sync_logs is not a cron ledger: 155 rows/24h = 144 sentinel skips + 9 token_heartbeat + snapshot-channels + skyslope_mirror_refresh.
Cron failure evidence therefore comes only from Vercel runtime errors (above) and postgres logs.

## 6. Schema hygiene
Snapshot docs/DATABASE_SCHEMA_SNAPSHOT.md generated 2026-09-09T18:30Z: 296 `###` entities, only 14 carry a row count. Migrations after
the snapshot: 20260909200000, 20260910013000, 20260916080000, 20260921120000, 20260921180000, 20260922160000 (G16 refresh is
local/nightly and needs creds; it has not run in 13 days). DATA_COVERAGE_INDEX generated 2026-08-22 (31 days) — wrong on listing_videos.
Helper counts (2026-09-22): listing_videos 31 · open_houses 20 · listing_photos 4,124 · content_performance 6 · listings_historical 0 ·
fub_person_geo 2,255 (FUB decommissioned 2026-06-24) · producer_change_requests 0 · producer_execution_failures 1 · content_briefs 987 ·
hero_videos 2 · video_tours_cache 2 · saved_searches 2 · tiktok_auth 1 · post_sync_pipeline_runs 11,970 · web_vitals 773,032.
Coverage index DEAD (0 rows, 2026-08-22): listing_detail_mv, cma_document_registrations, listing_alert_queue, listing_inquiries,
listing_photo_classifications, listing_shares, listing_sync_status, listing_views, listings_historical, sale_pricing_water_reclass_queue,
crm_appointments, crm_people_collaborators, crm_person_files, crm_short_links, profiles(crm_person_id), referral_receivables, tc_deal_people.
docs/DATABASE_FOR_AI_AGENTS.md:704 still says market_pulse_live carries no neighborhoods (28 neighborhood rows exist).

## 7. Deploys
Vercel production deployments 2026-09-21/22: 15 listed, 13 READY, 2 CANCELED; latest 83a459c (READY). 12 commits carry "Node: none".
Page HTML sizes: /cities/bend 3.77 MB, /cities/bend/summit-west 2.14 MB, /cities/bend/boyd-acres 1.92 MB — large for a place page.

## 8. What I could not verify
- Advisors / Vercel runtime errors could not be re-observed after the MCP ban; figures above are from the single capture at 19:36–19:39Z.
- Whether `refresh_listing_tile_mv()` uses an advisory lock; exact error text of the /api/cron/refresh-mvs 500s (log query timed out twice).
- Supabase instance size today (F7 said 2 cores / 1 GB shared_buffers on 2026-07-29).
- Meta audience / offline-conversion env flags (no env access).
- Which of geo_snapshot / boundary_xref / listing_search dominates job 163's 4–5 minutes.
- How many `details.Videos` arrays are non-empty (TOAST scan forbidden by docs/TOAST_READ_DISCIPLINE.md).
