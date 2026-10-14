# 2026-10-14 (Cursor, market_metric cache + index)

Branch: `cursor/market-metric-cache-baa6`. Builds on merged #618 (listing_tile_mv sitemap index); does not duplicate it.

**Landed (this PR).** 1h `unstable_cache` on every `market_metric` DAL read (slice, overlay, slug probe, boards), React.cache + inflight dedupe, getMetrics slice concurrency 3, community_subdivisions 1h + RPC cap 2. Index `market_metric_def_geo_lookup_idx` applied CONCURRENTLY on prod; migration records IF NOT EXISTS. Gate `ci:market-metric-cached` in always lane. AGENTS.md KAD 10.

**EXPLAIN after index (mt-v1 tetherow):** Index Scan cost 2.8. sunriver slug probe Index Only Scan cost 2.16 (was ~49k).

**Before (pg_stat_statements, still pre-cache):** queryid 4896140272980079526 14261 calls / 562.8ms mean; geo_slug -1280938930413982371 1262 / 1151.8ms; community_subdivisions -3942130057413509305 1045 / 1119.3ms.

**Next.** Merge, Vercel READY, community 200s, re-check statements ~30 min later.

**Held.** Standing holds unchanged. No sends. No data deletes.

**Skills read.** database-canonical-reference, DATABASE_FOR_AI_AGENTS.md, AGENTS.md land path.
