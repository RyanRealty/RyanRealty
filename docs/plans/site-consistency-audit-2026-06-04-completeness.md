# Site consistency audit 2026-06-04 completeness companion

Date: 2026-06-04
Status: DRAFT

This is the completeness companion to `site-consistency-audit-2026-06-04.md`. It corrects and extends the main audit by closing the two blind spots that pass left open. The main audit never inventoried persisted assets or spend, and it checked cron membership in `vercel.json` without ever verifying whether each cron actually writes data at runtime. The trigger for this pass was a funded 3,568-row `competitor_intel` system that the main audit treated as "no data." Every claim below was independently re-verified with a live SQL query or a source read, all run today against project `dwvlophlbvvygjfxcrhm`. No numbers are invented.

## Cron-health table

Twenty-nine crons across five slices. Columns are path, schedule, writes-to, table-exists, last-write, status. "table-exists" was checked with `to_regclass`. "last-write" is the live max timestamp on the write target. EXTERNAL means the route only reads and dispatches email or webhooks and has no Supabase write path, so liveness cannot be confirmed from the database.

### Alive

| path | schedule | writes-to | table-exists | last-write | status |
| --- | --- | --- | --- | --- | --- |
| /api/cron/sync-delta | 3,18,33,48 * * * * | listings, price_history, status_history, activity_events, sync_state | yes | 2026-06-04 19:33:06Z | ALIVE |
| /api/cron/sync-history-terminal | 12 * * * * | sync_cursor (default), listing_history | yes | 2026-06-04 19:12:29Z | ALIVE |
| /api/cron/sync-full | 0 2 * * 0 | listings, sync_cursor, listing_history | yes | 2026-05-31 02:04:32Z | ALIVE |
| /api/cron/refresh-market-stats | 0 7 * * * | market_stats_cache | yes | 2026-06-04 19:30:00Z | ALIVE |
| /api/cron/refresh-market-stats-monthly-recompute | 0 4 * * 0 | market_stats_cache (monthly rows) | yes | 2026-06-04 19:30:00Z | ALIVE |
| /api/cron/refresh-video-tours-cache | 37 * * * * | video_tours_cache | yes | 2026-06-04 18:37:53Z | ALIVE |
| /api/cron/refresh-mvs | 8 * * * * | listing_tile_mv, geo_snapshot_mv, listing_boundary_xref_mv | yes | no timestamp (row counts healthy) | ALIVE |
| /api/cron/refresh-similar-listings | 30 4 * * * | similar_listings_mv | yes | no timestamp (74,545 rows) | ALIVE |
| /api/cron/marketing-daily-digest | 0 14 * * * | marketing_brain_actions (comms:matt_summary) | yes | 2026-06-04 14:00:30Z | ALIVE |
| /api/cron/publisher-sweep | 53 * * * * | marketing_brain_actions (published_at), content_performance | yes | 2026-06-04 14:00:30Z | ALIVE |
| /api/cron/snapshot-channels | 0 12 * * * | marketing_channel_daily (10 sub-crons) | yes | 2026-06-03 | ALIVE |
| /api/cron/token-heartbeat | 0 12 * * * | sync_logs (token_heartbeat:%) | yes | 2026-06-04 12:00:06Z | ALIVE |
| /api/cron/analytics-daily-digest | 30 14 * * * | none (reads + Resend email) | yes (inputs fresh) | external dispatch | EXTERNAL |
| /api/cron/gbp-monthly-digest | 0 13 1 * * | none (GBP read + Resend) | n/a | external dispatch | EXTERNAL |
| /api/cron/gbp-health-check | 42 * * * * | none (GBP read + optional webhook) | n/a | external dispatch | EXTERNAL |

### Broken set

| path | schedule | writes-to | table-exists | last-write | status |
| --- | --- | --- | --- | --- | --- |
| /api/cron/marketing-competitor-recon | 0 7 * * 1-5 | competitor_intel | yes | 2026-05-22 07:11:26Z | DEAD |
| /api/cron/marketing-weekly-cycle | 0 2 * * 1 | marketing_decisions (weekly_cycle) | yes | 2026-05-13 21:18:52Z | DEAD |
| /api/cron/loop-health-check | 30 12 * * * | marketing_decisions (loop_health_check) | yes | never (0 rows of type) | DEAD |
| /api/cron/detect-fsbo-listings | 20 7 * * * | fsbo_listings | yes | never (0 rows) | DEAD |
| /api/cron/marketing-measurement-loop | 0 15 * * * | content_performance, marketing_decisions | yes | never (0 rows) | DEAD (claimed VOID) |
| /api/cron/seller-lead-attribution | 0 13 * * * | content_performance (UPDATE) | yes | never (0 rows) | DEAD (claimed VOID) |
| /api/cron/marketing-snapshot-google-ads | 30 6 * * * | marketing_channel_daily (google_ads) | yes | never (0 rows for channel) | DEAD (claimed VOID) |
| /api/cron/refresh-reporting-cache | 0,45 * * * * | reporting_cache (table missing) | no | none | VOID |
| /api/cron/refresh-listing-year-stats | 27 */4 * * * | two finalization MVs (missing) | no | none | VOID |
| /api/cron/refresh-place-content | 0 3 * * * | cities, neighborhoods, communities | yes | 2026-03-13 04:21:27Z | STALE |
| /api/cron/market-report | 0 14 * * 6 | market_reports | yes | 2026-05-30 14:00:25Z | STALE |
| /api/cron/visitor-hot-lead-escalation | */15 * * * * | visitor_sessions (hot_lead_fired_at) | yes | 2026-06-03 01:45:28Z | STALE |
| /api/cron/producer-dispatcher | 23 * * * * | marketing_brain_actions (in_production) | yes | 2026-06-04 06:23:34Z | STALE |
| /api/cron/producer-runtime | 47 * * * * | marketing_brain_actions, marketing_cost_ledger | yes | 2026-05-24 21:00:43Z | STALE |

Status labels reconciled. The verifier downgraded three crons that the source agents labelled VOID. VOID means the target table does not exist. For `marketing-measurement-loop`, `seller-lead-attribution`, and `marketing-snapshot-google-ads`, the target tables do exist with zero rows, so the correct label is DEAD. Only `refresh-reporting-cache` and `refresh-listing-year-stats` are truly VOID, both the target table or MV and (for reporting-cache) the RPC are absent.

## Bleeding now (ranked)

This is what each broken cron is actually costing, worst first.

1. **marketing-competitor-recon (DEAD, P1) - funded Apify intel is going stale.** Last write 2026-05-22, 13 days silent, with 8 consecutive weekday runs missed (Mon 2026-05-26 through Wed 2026-06-04). `competitor_intel` holds 3,568 rows across 22 competitors and 6 data types and is funded by per-run Apify actor compute. This is the system that triggered the whole pass and the one the main audit called "no data." Likely cause is an Apify actor timeout, an expired API key, or Vercel silently not firing the cron. Fix: re-run the cron manually, confirm `APIFY_API_TOKEN` is valid, and check the Apify actor run history for errors. Gate: cron-health.

2. **refresh-reporting-cache (VOID, P1) - 32 failed runs per day against a table that does not exist.** Schedule `0,45 * * * *` fires every 45 minutes and calls `compute_reporting_cache_payload`. Both the `reporting_cache` table and the RPC are absent in the snapshot. Every invocation errors or silently no-ops. The `/reports` page freshness guarantee depends on this cache-warm. Fix: either create `reporting_cache` plus the RPC, or delete the cron and the cache-warm call. Until then this is pure noise burning compute and masking real failures. Gate: schema-presence.

3. **marketing-weekly-cycle (DEAD, P1) - the brain's weekly planning loop has not produced a live decision since 2026-05-13.** Three consecutive Monday runs missed. A NOT NULL constraint bug was documented and fixed 2026-05-21, but no live `weekly_cycle` row has appeared post-fix, so the fix did not restore the loop. Fix: trigger a live (non-dryrun) run and confirm a row lands. Gate: cron-health.

4. **producer-runtime (STALE, P1) - the producer that bills Anthropic tokens has not run in 11 days, and 4 actions are stuck in_production.** `marketing_cost_ledger` last wrote 2026-05-24. Four `marketing_brain_actions` rows dispatched today at 06:23 were never flipped to ready. Most likely `PRODUCER_RUNTIME_ENABLED` is not set to true, so the route early-exits with `{skipped:true}`. Fix: confirm the env flag, then clear the 4 stuck rows. Gate: cron-health.

5. **detect-fsbo-listings (DEAD, P1) - has never successfully processed a single FSBO.** `fsbo_listings` has zero rows ever. The pipeline depends on Apify, Resend, and FUB. Any missing env var short-circuits before the upsert. Fix: verify `APIFY_API_TOKEN` and the Apify actor city configuration, run once, confirm a row. Gate: cron-health.

6. **loop-health-check (DEAD, P1) - the watchdog itself is dark.** Zero `loop_health_check` rows ever. Likely cause is a column-type mismatch: `marketing_decisions.rules_cited` is `TEXT[]` but the code inserts a JSON object, which silently fails the insert. This is the cron meant to observe the health of all the other loops, and it has never recorded a single observation. Fix: correct the insert to match the array column type. Gate: cron-health.

7. **marketing-measurement-loop (DEAD, P2) and seller-lead-attribution (DEAD, P1) - both starved on an empty content_performance.** `content_performance` has 0 rows because no marketing content has ever flowed approved → executed → platform-published. The crons run cleanly but find zero candidates. seller-lead-attribution is P1 because it is the link between FUB seller leads and content attribution, so the north-star metric is unmeasurable. Fix is upstream: get one piece of content fully published so `content_performance` gets its first row. Gate: cron-health.

8. **marketing-snapshot-google-ads (DEAD, P2) - Google Ads is the only channel with zero rows.** The route gracefully no-ops when `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, or `GOOGLE_ADS_ACCESS_TOKEN` are missing. The other 10 snapshot channels all wrote today at 12:01Z. Fix: configure the three env vars in Vercel, or accept that Google Ads is intentionally off and remove the cron. Gate: cron-health.

9. **refresh-listing-year-stats (VOID, P2) - errors every 4 hours against two MVs that do not exist.** The RPC `refresh_listing_year_sync_stats` body refreshes two materialized views that `to_regclass` returns NULL for. Admin sync-status year-breakdown pages get no data. Fix: create the MVs or remove the cron and RPC. Gate: schema-presence.

10. **refresh-place-content (STALE, P2) - cities content has not refreshed in 83 days.** Daily 3am cron, but `cities` last updated 2026-03-13 with only 1 row, and `neighborhoods` last 2026-05-14. Likely the chunk finds nothing to refresh after the first pass, or the Grok LLM call fails silently. Fix: confirm geo seed rows exist and the LLM path is alive. Gate: cron-health.

11. **market-report (STALE, P2) - one Saturday miss.** No `weekly-2026-05-24` row. Banner generation (Grok) runs before the `market_reports` upsert, so a banner timeout aborts the whole run without writing. Fix: move the upsert ahead of, or decouple it from, banner generation. Gate: cron-health.

12. **visitor-hot-lead-escalation, producer-dispatcher (STALE, P2) - silent but plausibly legitimate.** Both are conditional writers that no-op when there is no qualifying work. hot-lead last fired 2026-06-03 01:45 against a 15-minute schedule, and dispatcher last dispatched today at 06:23. The risk is a real hot session or pending action being missed without anyone noticing. Fix: monitor, do not assume broken. Gate: cron-health.

### The watchdogs are not wired to alert

`loop-health-check`, `token-heartbeat`, and `gbp-health-check` all exist as crons, yet none of them caught a single one of the failures above. `loop-health-check` has never written a row, so it observes nothing. `token-heartbeat` only refreshes OAuth tokens and logs to `sync_logs`, it does not watch data-write freshness. `gbp-health-check` only checks GBP content. The conclusion is that the watchdogs are present in `vercel.json` but not wired to alert on metric-write staleness. A funded 3,568-row intel system going 13 days dark with zero notification is the proof.

### The two gates this pass adds

- **cron-health gate:** every metric-writing cron must have a fresh write row within its expected interval, or it must fire an alert. A cron whose target table or MV shows a max timestamp older than its cadence is a failure, not a quiet no-op. This gate would have caught competitor-recon, weekly-cycle, producer-runtime, refresh-place-content, and market-report.

- **schema-presence gate:** no cron or DAL function may target a table, MV, or RPC that is absent from the schema snapshot. This is a build-time check against `to_regclass` / `information_schema`. This gate would have caught refresh-reporting-cache and refresh-listing-year-stats before they ever shipped, and it would have flagged the missing `compute_reporting_cache_payload` RPC.

## Persisted-asset and spend inventory

These are the real, persisted assets the main audit under-credited. Classification is one of LIVE-ASSET, SPEND-RECORD, DEAD, STALE, COMPLETED-ARCHIVE, INVESTIGATE, CRUFT. Every freshness figure is a live query result from today.

### Recorded spend

`marketing_cost_ledger` records exactly one cost_type, `anthropic_tokens`, across 145 rows totalling **$8.42 USD**, all dated 2026-05-22 to 2026-05-24. That is the only spend the ledger captures. It does not capture Apify, BatchData, NeverBounce, Tracerfy, or Meta. Those costs were incurred by one-shot scripts that write only to local `out/` files, never to the ledger. The largest confirmed external spend recorded anywhere is the `westside-bend-merge` pipeline: **BatchData ~$420** (`summary-enrichment.json`, 6,000 records at $0.07/match) plus **NeverBounce ~$48** (`summary-neverbounce.json`, 7,160 checks at $0.008), for **~$468 total** on that one pipeline. The headline gap is governance: real money was spent through paths the budget ledger never sees.

### Behavioral and intel data the main audit under-credited

| asset | classification | rows / spend | freshness | recommendation |
| --- | --- | --- | --- | --- |
| activity_events | LIVE-ASSET | 16,489 rows, 9 event types | 2026-06-04 19:33:04Z (writing now) | keep |
| visitor_events | LIVE-ASSET | 924 rows, page_view + listing_view | 2026-06-04 13:21:02Z | keep |
| visitor_sessions | LIVE-ASSET | 66 rows, UTM + FUB bridge + hot-lead | 2026-06-04 13:21:02Z | keep |
| user_events | LIVE-ASSET | 5,037 rows, 1 event_type | 2026-06-04 13:21:02Z | investigate (only data-export reader) |
| visits (legacy) | LIVE-ASSET | 4,978 rows | 2026-06-04 13:21:02Z | investigate (parallel to visitor_events) |
| engagement_metrics | LIVE-ASSET | 3,738 rows | 2026-06-04 19:33:41Z | keep |
| competitor_intel | DEAD | 3,568 rows, 22 competitors, Apify-funded | 2026-05-22 07:11:26Z (13 days silent) | revive |
| marketing_channel_daily | LIVE-ASSET | 39,128 rows, 10 channels | 2026-06-04 12:01:30Z | keep |
| marketing_cost_ledger | SPEND-RECORD | 145 rows, $8.42 anthropic_tokens only | 2026-05-24 21:00:43Z | keep (extend to capture Apify/BatchData/etc.) |
| asset_library | LIVE-ASSET | 1,482 rows (1,166 photos, 307 video) | 2026-06-03 21:13:23Z | keep |
| listing_history | LIVE-ASSET | 3,875,292 rows (ground truth said 3,330) | 2026-06-04 19:22:32Z | keep |
| market_stats_cache | LIVE-ASSET | 10,375 rows | 2026-06-04 19:30:00Z | keep |
| content_performance | DEAD | 0 rows ever | none | investigate (starves 2 crons) |

### out/ work product (over 1.3 GB gitignored), the highest-value items

| asset | classification | spend | freshness | recommendation |
| --- | --- | --- | --- | --- |
| out/design-recon/ (18,716 competitor ads) | LIVE-ASSET | Apify | 2026-05-26 | keep (Tier 4 producers load it at build) |
| out/seller-ad-concepts/ (49 ad concepts) | LIVE-ASSET | Meta | 2026-05-30 | keep (3 ads live on Meta) |
| out/meta-fub-audiences/ (16 live Meta audiences) | LIVE-ASSET | Meta | 2026-06-02 | keep |
| out/meta-custom-audiences/ (25,364 hashed rows) | LIVE-ASSET | Meta | 2026-06-02 | keep |
| out/lp-rebuild/ + out/lp-review/ (LP redesigns) | LIVE-ASSET | none | 2026-06-03 | keep (pending Matt approval) |
| out/ga4-404/ (top 404 = /lp/seller-home-value 81 users) | LIVE-ASSET | none | 2026-06-02 | keep (actionable 404 fix) |
| out/westside-bend-merge/ (9,234 homeowners, FUB pushed) | COMPLETED-ARCHIVE | BatchData ~$420 + NeverBounce ~$48 | 2026-05-27 | archive |
| out/farm-merge/ (5,564 contacts pushed to FUB) | COMPLETED-ARCHIVE | none | 2026-06-01 | archive |
| out/agentfire-media/ (1,305 migrated images) | COMPLETED-ARCHIVE | none | 2026-05-22 | archive |
| out/fub-cache/people.json (13,277 contacts) | STALE | none | 2026-05-26 (9 days) | sweep |
| out/ loose root PNGs + research MDs | CRUFT | none | 2026-05-27 to 2026-06-03 | sweep |

### Config-driven brain systems and data/ datasets

| asset | classification | freshness | recommendation |
| --- | --- | --- | --- |
| config/marketing-brain/competitors.json (28 targets) | LIVE-ASSET | 2026-05-14 | keep (drives competitor-recon) |
| config/marketing-brain/topics.json (12 buckets) | LIVE-ASSET | 2026-05-14 | keep |
| config/marketing-brain/inbox-senders.json | LIVE-ASSET | 2026-05-14 | keep (note: poll cron absent from vercel.json) |
| data/resort-communities.json + 27 community JSONs | LIVE-ASSET | actively read | keep (source of truth for /communities) |
| data/golf/ (8 files) + data/golf-landing.ts | LIVE-ASSET | 2026-06-03 | keep |
| data/co-schools.ts + co-schools-research.json | LIVE-ASSET | 2026-06-03 | keep |
| data/co-parks.ts | LIVE-ASSET | 2026-06-03 | keep |
| data/legacy-redirects.json | LIVE-ASSET | gated by CI | keep (live in middleware) |
| data/meme-library.jsonl | STALE | 0 bytes (empty) | investigate |
| data/bend-neighborhood-districts.geojson | INVESTIGATE | no readers found | investigate |
| data/cutover-rollback.json | COMPLETED-ARCHIVE | inert | archive |

### External paid systems

| system | classification | spend captured in ledger? | recommendation |
| --- | --- | --- | --- |
| Apify (competitor-recon) | DEAD | no | revive (13 days silent) |
| Apify (expired-pipeline DIAL + property-owner) | LIVE-ASSET | no | keep |
| Tracerfy (expired-owner skip-trace, live cron) | LIVE-ASSET | no | keep |
| BatchData (westside-bend, ~$420) | COMPLETED-ARCHIVE | no | archive |
| NeverBounce (westside-bend, ~$48) | COMPLETED-ARCHIVE | no | archive |
| Meta custom audiences (16 live audiences) | LIVE-ASSET | no | keep |
| GA4 daily ingestor (1,869 rows) | LIVE-ASSET | n/a | keep |
| GSC daily ingestor (20,008 rows, largest channel) | LIVE-ASSET | n/a | keep |

The recurring finding across this table: five external paid systems write only to local `out/` files and none of them post to `marketing_cost_ledger`. The ledger's $8.42 is not total marketing automation spend, it is only the Anthropic token slice of one cron.

## Corrections to the main audit doc

Apply these to `site-consistency-audit-2026-06-04.md`. They are stated as explicit overrides.

1. **"Competitive intelligence = no data" is false.** `competitor_intel` holds 3,568 rows across 22 competitors and 6 data types, observation range 2026-05-12 to 2026-05-22, funded by Apify. The correct statement is that the intel system is built, funded, and populated, but its cron has been DEAD for 13 days, so the data is going stale. The asset exists, the loop is broken.

2. **"Telemetry is thin / barren" is overstated.** The behavioral capture layer is active and writing today: `activity_events` 16,489 rows (writing this minute), `visits` 4,978 rows, `user_events` 5,037 rows, `visitor_events` 924 rows, `visitor_sessions` 66 rows, `engagement_metrics` 3,738 rows. The site is capturing behavior continuously. The accurate characterization is not "barren" but "rich capture, thin consumption" - several of these tables have no analytics reader beyond a data-export path, and two parallel visit-tracking systems (`visits` and `visitor_events`) coexist with unclear division of labor.

3. **`listing_history` row count was off by three orders of magnitude.** Ground truth stated 3,330 rows. The live count is 3,875,292 across 543,829 distinct listing keys. Correct the figure.

4. **Add a cron-runtime-health finding to Cluster 9.** The main audit verified cron membership in `vercel.json` but never checked whether each cron writes data at runtime. Runtime verification finds 6 broken crons the membership check could not see: competitor-recon (DEAD), weekly-cycle (DEAD), loop-health-check (DEAD), detect-fsbo-listings (DEAD), refresh-reporting-cache (VOID), refresh-listing-year-stats (VOID), plus measurement-loop, seller-lead-attribution, and google-ads snapshot all DEAD on empty target tables. Membership in `vercel.json` proves a cron is scheduled, not that it produces data.

5. **Credit the persisted asset and spend layer the main audit omitted entirely.** The main audit inventoried no DB behavioral data, no spend, no `out/` work product, no config-driven brain systems, and no external paid systems. This companion's inventory section is the missing chapter. Of particular note: 16 live Meta audiences, 18,716 competitor ads in design-recon, ~$468 of confirmed external skip-trace spend that the budget ledger never recorded, and a $8.42 ledger that captures only Anthropic tokens.

## Coverage and gaps

What this pass reached: all 29 crons re-verified by live query, all 37 populated public tables, the full `out/` tree, the three `config/marketing-brain/` files, the `data/` datasets, and seven external paid systems. Status labels were reconciled against the verifier's VOID-vs-DEAD distinction.

What this pass did not reach:

- EXTERNAL crons (analytics-daily-digest, gbp-monthly-digest, gbp-health-check) cannot be confirmed alive or dead from the database. They only read and dispatch email or webhooks. Confirming them requires Resend delivery logs and webhook receipt logs, which were not pulled.
- The `out/` total is over 1.3 GB and only the 34 named directories plus notable loose files were inventoried. Loose-file totals at the `out/` root are estimated, not measured precisely.
- Several assets are flagged `needsVerify`: `listing_boundary_xref_mv` freshness (no timestamp column), `marketing-inbox-poll` cron absence from `vercel.json` (route exists, docstring claims it is wired but it is not in the 29-entry list), the 4 stuck `in_production` brain actions, the `sync_state` singleton being 4 days behind while `sync_cursor` is current, and `community_engagement_metrics` 6-day staleness. These warrant a follow-up.
- No Vercel cron invocation logs were pulled, so for STALE conditional-writers (visitor-hot-lead-escalation, producer-dispatcher) we cannot distinguish "Vercel is not firing the cron" from "the cron fires but legitimately finds no work." The cron-health gate would resolve this by requiring an explicit alert on staleness.
- Whether the documented `weekly-cycle` NOT NULL fix (2026-05-21) actually works was not re-tested by a live trigger. No live row has appeared since, which is suggestive but not conclusive.
