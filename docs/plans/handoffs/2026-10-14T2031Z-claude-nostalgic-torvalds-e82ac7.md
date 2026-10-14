# 2026-10-14 (Claude Code, post-deploy statement timeouts)

Surface: Claude Code desktop. Branch `claude/nostalgic-torvalds-e82ac7`, base `main` @ `8ff21f7c1`.

## Root cause (measured)
#533 (2026-10-13 23:46Z) added Pending to `LISTING_SITEMAP_STATUSES`. The listings sitemap
pages `listing_tile_mv` by `standard_status IN (...) ORDER BY listing_key` as anon (3s).
The partial index from 20260916080000 is Active + Active Under Contract only, so the
planner walked `listing_tile_mv_key` over ~600K rows: 3,622 ms, 577,011 rows filtered,
307,810 buffers, on a quiet database. Postgres logs, query_id 4231575862387612922:
0 timeouts on 2026-10-13, 588 on 2026-10-14 (largest source; 1,057 total vs ~142 the day before).
Each call retries 4 times, and every sitemap universe build ran it too. deploy:verify's
sitemap smoke fetches six sitemaps at once, so a deploy put ~20 of those walks on the
database in 15 seconds; the matrix inventory read (59 ms alone), `getCommunityBySlug`
(juniper-preserve, broken-top) and `get_place_schools` then timed out behind them.

## Landed in this branch
- `supabase/migrations/20261014200000_listing_tile_mv_src_on_market_key.sql`: partial index
  on the three statuses. Applied to production via MCP during delivery. After: 351 ms,
  920 buffers, no filter.
- `buildAllUrls(..., { listings: false })` from `lib/sitemap-class-rows.ts`: the class
  universe no longer reads listings it always discarded (slowest leg, 13-28s).
- `lib/data/sitemap/listingSitemapIndex.test.ts`: fails if the status set and the index
  predicate drift apart again. `app/sitemap.listings-leg.test.ts` pins the leg skip.

## Next
- Verify: deploy, `npm run deploy:verify`, then postgres_logs for 15 minutes after READY.
- `get_place_schools` timed out 122 times on 2026-10-13 in build-time bursts (pre-existing,
  geography intersections per call). Measure again once the tile walks are gone.
- Nested `unstable_cache` in `getClassRows` still re-runs the matrix read live per class
  build (~6s when healthy). Not a timeout source once the walks stop.

## Skills read
None matched (no SKILL.md covers sitemap or Supabase index work). CLAUDE.md §0/§7, AGENTS.md CORE RULES.
