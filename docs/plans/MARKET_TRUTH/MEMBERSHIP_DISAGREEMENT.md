# Place membership — disagreement report

**As-of 2026-08-22.** Hosted `place_membership` after `refresh_place_membership` keyset (397 batches, **2,753,274** rows). One-current-primary unique index held (0 duplicate current primaries).

Cities resolve by MLS city text (D5), hyphen slug from `market_service_area` else `market_hyphen_slug`. Sub-city by `ST_Within` (invalid polygons skipped). `is_primary` = smallest `ST_Area` then `geo_slug` ASC. Alias fallback when no polygon: `SubdivisionName` → boundaries label / `neighborhood_subdivisions` / `communities.name`.

## Inventory by method

| geo_type | method | rows | primaries | listings |
|---|---|---:|---:|---:|
| city | city_text | 594,353 | 594,353 | 594,353 |
| region | city_text | 277,951 | 277,951 | 277,951 |
| county | city_text | 581,821 | 581,821 | 581,821 |
| zip | city_text | 578,555 | 578,555 | 578,555 |
| subdivision | polygon | 246,390 | 191,105 | 191,105 |
| subdivision | alias | 4,482 | 4,482 | 4,482 |
| neighborhood | polygon | 200,976 | 129,008 | 129,008 |
| neighborhood | alias | 8,046 | 8,046 | 8,046 |
| community | alias | 260,700 | 260,700 | 260,700 |

Overlap extras (non-primary polygon rows) are stored so maps can still pin; sums must filter `is_primary`. Neighborhood polygons stay `unverified` (Broken Top / `bend-southeast-bend` / `bend-undesignated` — REGISTRY §4).

## Disagreement vs live attribution paths

### 1. MLS `"City"` vs membership `geo_type='city'`

Expected agreement: membership slug is `market_service_area.city_slug` or hyphen of `"City"`. Pulse/cache still key some cities on the space form (`la pine`); membership is hyphen (`la-pine`). That is the 2-of-20 slug split EXECUTE names — already gated by `ci:city-cache-slug` on cache reads. Membership does not copy the space form.

### 2. Pulse city polygon vs membership city text (the `/sell` defect)

Pulse `refresh_market_pulse` clips city inventory to the TIGER polygon. Membership does not. Detached active, 2026-08-22:

| city | pulse (polygon, type A) | shadow (MLS city, detached) | reason |
|---|---:|---:|---|
| Bend | 488 | 775 | D5. Polygon drops the unincorporated ring. |
| Redmond | 191 | 274 | same |
| Prineville | 83 | 181 | same |
| Sisters | 35 | 110 | same |
| Terrebonne | 6 | 51 | CDP polygon; pulse MoS NULL |
| Culver | 12 | 29 | same |
| Madras | 48 | 75 | same |
| La Pine | 172 | 170 | not polygon-clipped (AUDIT F8); 2-home exact-Active vs pulse mix |
| Sunriver | 57 | 56 | CDP ≈ MLS city |
| Powell Butte | 62 | 62 | match |
| Black Butte Ranch | 31 | 31 | match |
| Camp Sherman | 5 | 5 | match |
| Metolius | 6 | 6 | match |
| Tumalo / Warm Springs / CRR | 0 | 0 | no MLS City text |

### 3. `listing_boundary_xref_mv` vs membership primary (on-market only)

xref stores every containing polygon (no tie-break). Membership picks one primary.

| geo_type | xref listings | have a membership primary | primary slug ≠ an xref slug |
|---|---:|---:|---:|
| subdivision | 2,735 | 2,735 | 714 (26.1%) |
| neighborhood | 1,915 | 1,885 | 648 (33.8%) |

The 714 / 648 are not geocode misses — they are overlap listings where xref has 2–8 rows and membership named the smallest polygon. 30 neighborhood xref listings have no membership primary (invalid polygon skipped). Closed sales are absent from xref entirely (AUDIT: on-market only); membership covers listed and sold alike, which is the absorption-defect fix.

### 4. `neighborhood_subdivisions` text join vs membership

Pulse community writer attributes closes by `subdivision_label = "SubdivisionName"` and actives by xref polygon. Membership uses the same alias table only when no neighborhood polygon exists (8,046 alias-only). Where a polygon exists, polygon wins. Mixed-method cells stay `unverified` and must not publish a ratio (REGISTRY §4).
