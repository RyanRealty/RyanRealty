# Exploration System — end-to-end goal

**Mission start:** 2026-08-11  
**Done means:** A real buyer can land on a listing, subdivision, neighborhood, community, golf course, or city and **never hit a dead end** — multi-rail explore, honest market grain, unified place ladder, lifestyle chapters, same product language.

## User walkthrough (acceptance)

1. Open a Bend listing in Valhalla Heights → see place identity links (plat · community · city) → click plat → full GEO page (inventory, map, market, sales history, schools, parents/peers, lifestyle, alerts) → climb to NWX community → to Bend city → open another listing → “more in this plat” + “similar beds nearby” rails work.
2. No city-wide stats labeled as neighborhood stats.
3. Admin untouched.

## Build ladder (serial after foundation)

| # | Increment | Status |
|---|-----------|--------|
| 0 | CONTEXT.md + resolvePlaceContext + PlaceIdentityLine | **Shipped** `58c95c58` |
| 1 | Unified related-homes ranker | **Shipped** (this commit) |
| 2 | Subdivision full GEO rebuild | **Shipped** (this commit) |
| 3 | Listing lifestyle + parents + related merge | **Shipped** (this commit) |
| 4 | Community golf reverse links | **Shipped** (this commit) |
| 5 | Neighborhood peers + lifestyle | **Shipped** (ExploreMap basemap + peers) |
| 6 | ExploreMap basemap on place pages | **Shipped** (`getExploreMapOptions` + KbListingMap) |
| 7 | Photo stamps on place maps | **Shipped** (zoom ≥15 photo icons on KbListingMap) |
| 8 | Builder explore rail | **Shipped** (`builderName` + ledger) |
| 9 | Nbhd in-boundary OH/activity when keys exist | **Shipped** |

## Non-goals

Admin rewrite, all 1848 MLS “community” pages, Matterport, always-on GIS school catchments.

## Mission status (2026-08-11)

**Primary + residual explore loop: COMPLETE** on `main`.

| Residual | Status |
|----------|--------|
| OverlayView pills + photo stamps on place maps | Done |
| Dual-pane list↔map (subdivision) | Done |
| `/builders` + `/builders/[slug]` | Done |

A buyer can climb listing → plat → community → neighborhood → city → builder with shared basemap craft, dual-pane inventory on plats, multi-edge rails, and §0-honest scoping.

Optional later: dual-pane on neighborhood/city; typed `builder_name` column; dual-pane pin↔row highlight wired into map markers.
