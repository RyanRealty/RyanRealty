---
name: database-canonical-reference
description: REQUIRED reference whenever an agent touches the Ryan Realty Supabase database. Use BEFORE writing any SQL, market-report code, listings query, RPC, cron job, or migration. Covers every `public.*` table, the cache model (`market_pulse_live` 10–15 min freshness, `market_stats_cache` 6-hour freshness), the 14 resort communities + 14 Bend neighborhoods registered as `geo_type='neighborhood'`, the `listings` mixed-case quoting rule, slug formats per geo_type, and the SFR-only convention.
when_to_use: Use whenever the task mentions any of — market report, market stats, market data, listings query, listing detail, Supabase, SQL, query, RPC, migration, cache, market_pulse_live, market_stats_cache, listings table, listing data, MLS, Spark, geo_type, geo_slug, neighborhood, subdivision, community, resort community, Tetherow, Sunriver, Eagle Crest, Pronghorn, Caldera Springs, Awbrey Glen, NorthWest Crossing, Crosswater, Black Butte Ranch, Brasada Ranch, Widgi Creek, Vandevert Ranch, Three Rivers, Broken Top, Bend neighborhood, Awbrey Butte, Larkspur, comparable sales, CMA comps, polygon, boundary, methodology_version, refresh-market-stats cron, compute_and_cache_period_stats, refresh_market_pulse, backfill_rolling.
---

# Database canonical reference — load this skill before any DB work

## What this skill does

Forces you (the agent) to load the canonical database reference at **[docs/DATABASE_FOR_AI_AGENTS.md](../../../docs/DATABASE_FOR_AI_AGENTS.md)** before generating any SQL, building any market report, writing a listings query, or modifying any migration. Compliance is enforced by:

1. The `.cursor/rules/database-canonical-reference.mdc` rule (`alwaysApply: true`) which surfaces in every Cursor session
2. The CLAUDE.md top-of-file pointer
3. This skill's `when_to_use` triggers
4. `COMMENT ON TABLE` annotations in Postgres
5. `supabase/README.md` pointer

If you ever ship a query against `public.listings`, `public.market_stats_cache`, `public.market_pulse_live`, `public.boundaries`, `public.neighborhood_subdivisions`, `public.subdivision_flags`, or any cache RPC WITHOUT having read the doc first, you've violated the data accuracy rule ([CLAUDE.md §0](../../../CLAUDE.md)).

## The drill (every time you touch the DB)

1. **Open [docs/DATABASE_FOR_AI_AGENTS.md](../../../docs/DATABASE_FOR_AI_AGENTS.md).** On your first session of the day that touches DB work, read end-to-end (~10 min). On subsequent tasks, jump to the relevant section (the doc has a 12-row lookup table in §0).
2. **Match your task to a section:**
   - Market report (city / community / neighborhood / subdivision)? → §3 + §7 templates
   - Listings query (CMA, comps, detail page, search)? → §4 + §7 templates
   - Adding a new cache RPC or migration? → §1 (mental model) + §2 (table inventory) + §5 (freshness expectations) + §6 (methodology versioning)
   - Don't know where to start? → §0 (12-row lookup table)
3. **Use the canonical slug/type** from §3 and §8. Never invent slugs. Never invent SubdivisionName aliases — `public.neighborhood_subdivisions` already has the canonical list.
4. **Cite the section in your output.** When you ship a change or surface a query result, mention which section you followed. Example: "Per docs/DATABASE_FOR_AI_AGENTS.md §3a, resort community market reports route through `geo_type='neighborhood'` with bare slug like `tetherow`."
5. **If you find a gap** (table, slug, alias, behavior not documented), update the doc IN THE SAME COMMIT as your change. Doc drift is a bug.

## Hot-path reminders (the stuff that actually bites)

- `listings` uses **PascalCase RETS columns that MUST be double-quoted**: `"ListingKey"`, `"ListPrice"`, `"StandardStatus"`, `"City"`, `"SubdivisionName"`, `"CloseDate"`, `"BedroomsTotal"`, `"BathroomsTotal"`, etc. Forgetting the quotes is the #1 cause of "column does not exist" errors.
- **Slug formats differ by geo_type:**
  - `geo_type='city'` → bare slug `'bend'`
  - `geo_type='region'` → `'central-oregon'`
  - `geo_type='neighborhood'` → bare slug `'tetherow'` or `'bend-awbrey-butte'`
  - `geo_type='subdivision'` → slugified MLS name, e.g. `'tetherow-phase-5'`
  - `subdivision_flags.entity_key` → `'city:slug'` format, e.g. `'bend:tetherow'`
- **Don't aggregate raw `listings`** for market reports — use `market_stats_cache` (≤ 6h freshness) or `market_pulse_live` (≤ 15 min freshness, city/region only).
- **SFR-only convention** for market reports: `"PropertyType" = 'A' AND property_sub_type = 'Single Family Residence'`. Pronghorn has 35 active lots + 16 active homes; without the filter you mix them.
- **Slow-turnover communities** (Pronghorn, Crosswater, Vandevert Ranch) often show `sold_count=0` on rolling_90d — fall back to `rolling_365d` or `ytd`.
- **Bend = TIGER incorporated city polygon**, NOT "Bend area." Drops ~239 MLS-tagged-Bend listings that sit in unincorporated Deschutes County. This is intentional. For Bend-area semantics, query `region='central-oregon'`.

## Lookup shortcut (when in a hurry)

| If you need… | Query |
|---|---|
| Market report for a city | `SELECT * FROM market_stats_cache WHERE geo_type='city' AND geo_slug=$1 AND period_type=$2` |
| Market report for a resort community | `SELECT * FROM market_stats_cache WHERE geo_type='neighborhood' AND geo_slug=$1 AND period_type=$2` (slugs: tetherow, sunriver, eagle-crest, pronghorn, caldera-springs, awbrey-glen, northwest-crossing, crosswater, black-butte-ranch, brasada-ranch, widgi-creek, vandevert-ranch, three-rivers, broken-top) |
| Live active inventory (city/region) | `SELECT * FROM market_pulse_live WHERE geo_type=$1 AND geo_slug=$2 AND property_type='A'` |
| Property detail | `SELECT * FROM listings WHERE "ListingKey" = $1` (mind the quotes) |
| Subdivisions in a community | `SELECT subdivision_label FROM neighborhood_subdivisions WHERE neighborhood_slug=$1` |
| Is this community a resort? | `SELECT is_resort FROM subdivision_flags WHERE entity_key=$1` (`$1` = `'city:slug'`) |
| Polygon for a geo | `SELECT polygon FROM boundaries WHERE geo_type=$1 AND geo_slug=$2` |
| Methodology trace for a cache row | `SELECT * FROM cache_methodology_definitions WHERE version=$1` |

## TypeScript server actions (use these, don't write your own)

| Use case | Function | File |
|---|---|---|
| Market stats for a city | `getMarketStatsForCity(cityName)` | `app/actions/market-stats.ts` |
| Market stats for a community / subdivision (auto-routes resort communities to neighborhood-level cache) | `getMarketStatsForSubdivision(city, subdivision)` | `app/actions/market-stats.ts` |
| Live inventory pulse | `getLiveMarketPulse({ geoType, geoSlug, propertyType })` | `app/actions/market-stats.ts` |
| Cached period stats | `getCachedStats({ geoType, geoSlug, periodType })` | `app/actions/market-stats.ts` |
| Community page data | `getCommunityBySlug(slug)`, `getCommunityListings(slug)`, `getCommunityMarketStats(city, subdivision)` | `app/actions/communities.ts` |

## Anti-patterns (these are bugs, not opinions)

❌ Aggregating raw `listings` to compute a market report. The cache exists for this. Methodology + freshness trace come free.

❌ Inventing a subdivision alias. `neighborhood_subdivisions` has the canonical list — query it.

❌ Inventing a slug. Use [data/resort-communities.json](../../../data/resort-communities.json) or `boundaries` for the canonical set.

❌ `SELECT *` or `SELECT details` on `listings` on a hot path. Use explicit column lists.

❌ Shipping a market figure without a methodology trace. Every cache row carries `methodology_version` — surface it in your output.

❌ Quoting `"city"` (lowercase) when the column is `"City"` (PascalCase). Postgres preserves case; the wrong case = column does not exist.

## What "compliance" looks like in practice

When you (the agent) get a task like:

> "Show me how many homes sold in Tetherow last quarter at what median price"

The compliant response is:

1. **Recognize this is a market-report task → load this skill.**
2. **Open [docs/DATABASE_FOR_AI_AGENTS.md](../../../docs/DATABASE_FOR_AI_AGENTS.md) §3a.** Tetherow is a resort community → `geo_type='neighborhood'`, `geo_slug='tetherow'`.
3. **Query the right cache:**
   ```sql
   SELECT sold_count, median_sale_price, median_dom, methodology_version
   FROM public.market_stats_cache
   WHERE geo_type='neighborhood' AND geo_slug='tetherow' AND period_type='quarterly'
   ORDER BY period_start DESC LIMIT 1;
   ```
4. **Surface the methodology version** in the answer: "Tetherow Q2 2026: 3 sold, $2.3M median, computed under methodology v4-2026-05-15."

The non-compliant version:

1. Skim the question.
2. Write `SELECT count(*), median(...) FROM listings WHERE SubdivisionName ILIKE '%Tetherow%' ...` (raw aggregation, no methodology, wrong case on column).
3. Ship the answer without trace.

If you catch yourself heading toward path 2, stop. Load the skill. Use the cache.
