# CONTEXT.md — Ryan Realty domain language

One canonical name per concept. Code identifiers win when they disagree with casual speech; the disagreement is listed under Flagged ambiguities. Brand-facing prose still follows `docs/VOICE.md`.

---

## Language

### Place geography (Exploration System — locked 2026-08-11)

**City**:
MLS `City` as a public place page at `/cities/{slug}`. Market pulse and inventory default to this grain when nothing finer is known.
_Avoid_: Market, Area (when meaning a city), Town (in code — UI may say “town” only in consumer copy for Sisters/etc.)

**Neighborhood**:
A GIS-only place (Deschutes/Bend polygons in `boundaries`). There is **no** MLS neighborhood field. Membership is point-in-polygon (`boundary_neighborhood` on listings, `listings_in_boundary`). Public route: `/cities/{citySlug}/{neighborhoodSlug}`.
_Avoid_: District (unless school district), Community (for Bend GIS areas), Subdivision

**Subdivision**:
MLS `SubdivisionName` (a plat / named development). Public route `/subdivisions/{slug}` only when indexable (GIS polygon + minimum lifetime sales — see `isSubdivisionIndexable`). Not every MLS string gets a page.
_Avoid_: Community (when meaning a raw MLS plat), Neighborhood, HOA name (unless it equals the MLS subdivision)

**Community**:
A **curated** resort or master-planned place in `data/resort-communities.json` (~20 entries), public at `/communities/{slug}`. Membership is **alias-aware** (`subdivision_aliases`) and/or resort boundary — never a raw slug of every MLS name. Alias-aware active counts are mandatory for resorts.
_Avoid_: Subdivision (when meaning Tetherow/Crosswater as a product), Neighborhood, “community” for arbitrary MLS `SubdivisionName`

**GolfCourse**:
Lifestyle venue in the golf registry (`data/golf/`), public at `/central-oregon/golf/{slug}`. May link to a parent **Community** via `communitySlug`. Nearby homes are lat/lng joins, not MLS FKs.
_Avoid_: Community (the course is not the resort page), Club (unless that is the registry label)

**Region**:
Central Oregon service-area rollup (`getRegionPulse`, market hubs). Not a single polygon membership page for every listing.
_Avoid_: Market (alone), CO (ambiguous)

**PlaceContext**:
The resolved ladder for a listing or geo key: city → optional neighborhood → optional curated community → optional subdivision, plus preferred market grain and explore links. Assembled by `resolvePlaceContext` / `resolvePlaceContextFromListing` — callers must not re-derive membership inline.
_Avoid_: Geo blob, Location context, Area bag

**GeoScope**:
Membership resolver (`resolveGeoScope`) answering “which listings are inside this geography?” for city | neighborhood | community | subdivision. Spatial vs registry vs MLS name rules live there.
_Avoid_: PlaceContext (different job: UI ladder + links vs listing membership predicate)

**MarketPulse**:
10–15 min cache row in `market_pulse_live` feeding live inventory KPIs (active count, median list, etc.). Prefer pulse for “live inventory”; do not invent finer-grain numbers when no row exists.
_Avoid_: Market snapshot, Live stats cache, MarketStats (different table)

**MarketStatsCache**:
Closed-sales / period stats in `market_stats_cache` (YTD, rolling windows). Inventory fields often null — use **MarketPulse** for active inventory.
_Avoid_: Pulse, Market pulse

### Listings (minimal)

**Listing**:
One MLS property record surfaced on `/listing/*`. Public inventory default is SFR (`PropertyType = 'A'`) unless the surface is explicitly multi-type.
_Avoid_: Home (in code identifiers), Property (when meaning the listing row)

**ListingTile**:
Card/map pin projection from `listing_tile_mv` — not full detail.
_Avoid_: Listing card row, Search hit (unless search-specific)

---

## Relationships

- A **Listing** sits in exactly one MLS **City** (field may be messy; registry can override canonical city for known resorts).
- A **Listing** may sit in zero or one GIS **Neighborhood** (`boundary_neighborhood`).
- A **Listing** may have an MLS **Subdivision** name; that may match zero or one curated **Community** via aliases.
- A **Community** contains many **Subdivision** aliases and optional child plats; it is not the same entity as a single plat page.
- A **GolfCourse** may reference one **Community**; a **Community** page should link back when that reverse edge exists.
- **MarketPulse** grain must never be labeled finer than the row’s actual `geo_type` / slug (§0). Prefer “city context” copy over a fake neighborhood median.
- **PlaceContext** is derived; **GeoScope** is membership. Pages that need both call both — they do not merge responsibilities.

---

## Example dialogue

**Dev:** A listing’s MLS subdivision is “Tetherow” and GIS neighborhood is null. What do we show in the place ladder?

**Domain:** **Subdivision** node (plat) + **Community** node (curated Tetherow from registry aliases) + **City**. No **Neighborhood** step. Market grain prefers community/subdivision pulse when present, else city.

**Dev:** User is on `/subdivisions/valhalla-heights`. Is that a community page?

**Domain:** No. That is a **Subdivision** page. If the plat is not in the resort registry, there is no **Community** parent. Parent is **City** (and **Neighborhood** if GIS places the plat there).

**Dev:** Can we put city-wide open houses on a neighborhood page under the heading “Northwest Crossing open houses”?

**Domain:** Only if membership is in-boundary. If the feed is city-wide, the eyebrow must say the **City** name. Never label city inventory as neighborhood inventory.

**Dev:** Should every MLS SubdivisionName get `/communities/{slug}`?

**Domain:** No. Only registry **Community** entries. Everything else is **Subdivision** (if indexable) or search filters only.

---

## Flagged ambiguities

- **“Community” in AGENTS.md vs product** — Older docs equated Community with MLS SubdivisionName. **(resolved 2026-08-11)** Product language: **Community** = curated resort registry only; MLS name = **Subdivision**. Code still has legacy fields (`communitySlug` on listing often = subdivision slug) — treat those as technical debt; UI copy follows this doc.
- **“Neighborhood”** — GIS Bend districts vs casual “nice neighborhood.” Code/UI for place pages mean GIS **Neighborhood** only.
- **marketGeo.geoType: 'community' on listing page** — Historically used for MLS subdivision market lookup. Prefer **PlaceContext.preferredMarketGrain** going forward so we do not call a plat a community in new code.
- **Pulse vs stats** — Two caches, two jobs; see MarketPulse / MarketStatsCache above.
