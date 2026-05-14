# Neighborhood polygon-boundary fix — pipeline diagnosis + proposed SQL migration

**Generated:** 2026-05-14
**Audit thread:** continued from `docs/seo-execution-log-2026-05-14.md`

## What we found

The database HAS infrastructure for per-neighborhood market data (it just isn't producing rows). Specifically:

| Table | State |
|---|---|
| `neighborhoods` | 13 rows, all with `boundary_geojson` populated, but **4 of 13 polygons are placeholder rectangles ~30 sq meters each** (microscopic) |
| `neighborhood_subdivisions` | 1,576 subdivision-to-neighborhood mappings (uses historical/plat names that don't match current MLS feed naming) |
| `listings.boundary_neighborhood` | Field exists but **461 active SFR show "Undesignated", 244 show "Outside City Limits"**, only ~27 properly tagged |
| `market_pulse_live` | **Only emits `geo_type='city'` (16 rows) + `geo_type='region'` (1 row)**. Never emits `geo_type='neighborhood'`. |
| `market_stats_cache` | Same gap — 4 stale non-city rows from 2024-04-30 |

PostGIS 3.3.7 IS installed. Manual `ST_Contains` against real polygons works correctly:

```
Active SFR listings, by neighborhood polygon (PostGIS point-in-polygon):
  old-farm-district  → 51
  mountain-view      → 48
  century-west       → 36
  larkspur           → 29
  southwest-bend     → 29
  orchard-district   → 26
  southern-crossing  → 17
  southeast-bend     → 16
  old-bend           → 9
  boyd-acres         → 2     ← placeholder polygon
  awbrey-butte       → 1     ← placeholder polygon
  river-west         → 0     ← placeholder polygon
  summit-west        → 0     ← placeholder polygon
```

## Root cause — three layered problems

**1. Four neighborhoods have placeholder polygons.** Awbrey Butte, Summit West, River West, Boyd Acres each have a `boundary_geojson` that's a ~30 sq m rectangle near each centroid. These are stubs that someone added intending to fill in later. They never got filled in.

**2. The listings tagging pipeline isn't running.** Even for the 9 neighborhoods with real polygons, only the original tag (probably set at listing-creation time) is in `listings.boundary_neighborhood`. There's no scheduled job re-running ST_Contains to keep tags fresh. Most active listings still show "Undesignated."

**3. The aggregation pipeline doesn't emit neighborhood rows.** `market_pulse_live` and `market_stats_cache` aggregators run for cities + regions only. Even if listings were tagged correctly, the cache wouldn't update.

## Proposed fixes (in order of impact)

### Phase 1 — Replace placeholder polygons (5-min DB migration)

Hand-drawn approximations of Awbrey Butte, Summit West, River West, Boyd Acres bounding boxes based on known geography. These are rough but capture the right zones for SEO classification. Better to ship and refine than to wait for perfect GIS data.

```sql
-- Awbrey Butte (NW Bend, north of downtown, butte area)
UPDATE neighborhoods SET boundary_geojson = '{
  "type":"Polygon","coordinates":[[
    [-121.358,44.073],[-121.302,44.073],[-121.302,44.107],[-121.358,44.107],[-121.358,44.073]
  ]]
}'::jsonb WHERE slug='awbrey-butte';

-- Summit West (west of NW Crossing, Tetherow + Discovery West + Shevlin + Valhalla Heights area)
UPDATE neighborhoods SET boundary_geojson = '{
  "type":"Polygon","coordinates":[[
    [-121.405,44.040],[-121.335,44.040],[-121.335,44.078],[-121.405,44.078],[-121.405,44.040]
  ]]
}'::jsonb WHERE slug='summit-west';

-- River West (between Old Bend and Awbrey Butte, along Deschutes)
UPDATE neighborhoods SET boundary_geojson = '{
  "type":"Polygon","coordinates":[[
    [-121.345,44.050],[-121.310,44.050],[-121.310,44.075],[-121.345,44.075],[-121.345,44.050]
  ]]
}'::jsonb WHERE slug='river-west';

-- Boyd Acres (NE Bend)
UPDATE neighborhoods SET boundary_geojson = '{
  "type":"Polygon","coordinates":[[
    [-121.295,44.075],[-121.245,44.075],[-121.245,44.118],[-121.295,44.118],[-121.295,44.075]
  ]]
}'::jsonb WHERE slug='boyd-acres';
```

After applying, re-run the PostGIS ST_Contains test query to verify each neighborhood gets a sensible count (Summit West should see 100+ active listings — NW Crossing + Discovery West + Shevlin all live there).

### Phase 2 — Backfill `listings.boundary_neighborhood`

```sql
UPDATE listings l
SET boundary_neighborhood = sub.name
FROM (
  SELECT l2."ListingKey" AS listing_key, n.name
  FROM listings l2
  JOIN neighborhoods n ON ST_Contains(
    ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326),
    ST_SetSRID(ST_MakePoint(l2."Longitude"::float, l2."Latitude"::float), 4326)
  )
  WHERE l2."City"='Bend' AND l2."Latitude" IS NOT NULL
) sub
WHERE l."ListingKey" = sub.listing_key;
```

After this, ~261+ listings should be properly tagged (vs the current ~27).

### Phase 3 — Add a daily cron that re-runs Phase 2

Whatever job populates the MLS feed (probably `automation_skills/` cron) needs to ALSO run the polygon backfill after each MLS sync. Otherwise tags go stale within a day.

### Phase 4 — Extend `market_pulse_live` aggregation to emit neighborhood rows

The aggregator (whichever script/cron populates `market_pulse_live`) needs to:

```
FOR EACH n IN neighborhoods:
  INSERT INTO market_pulse_live (geo_type='neighborhood', geo_slug=n.slug, geo_label=n.name, ...)
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE "StandardStatus"='Active') AS active_count,
      COUNT(*) FILTER (WHERE "StandardStatus"='Pending') AS pending_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice"::numeric)
        FILTER (WHERE "CloseDate" >= NOW() - INTERVAL '90 days' AND "ClosePrice" > 0) AS median_close_price_90d,
      ...
    FROM listings l
    WHERE l.boundary_neighborhood = n.name AND l."PropertyType"='A'
  )
```

Same for `market_stats_cache` rolling windows.

### Phase 5 — AgentFire neighborhood-page subdivision mapping refresh

The 1,576 entries in `neighborhood_subdivisions` are historical/plat names. Current MLS feeds classify many active listings with abbreviated names ("Valhalla Heights" vs "Valhalla Heights Phase III") or "N/A". The mapping needs a second pass with current-MLS-name aliases. Lower priority than Phase 1-4.

## Effort estimate

- Phase 1: 5 min (run 4 UPDATE statements + verify)
- Phase 2: 10 min (one bulk UPDATE, ~30 sec query time on 590K-row table)
- Phase 3: 30 min (find or create the daily-sync cron, add the backfill step)
- Phase 4: 2-4 hours (modify aggregation logic, test, deploy)
- Phase 5: 1-2 hours (mapping table refresh)

Phase 1 + 2 are the biggest immediate wins. Together they take 15 minutes and unblock the 4 most-trafficked neighborhood pages.

## What this unblocks for the SEO audit

Once Phase 1 + 2 are run:
- Summit West neighborhood pages (Valhalla Heights, Tree Farm, anything in the NW Crossing area) can get current market snapshots
- Awbrey Butte pages can get current data
- River West, Boyd Acres pages can get current data

Combined with the city-level pages already working, every AgentFire neighborhood/area page would have a real market snapshot above the JS-loaded "$0" widget. Audit Section 5.5 fully addressed.
