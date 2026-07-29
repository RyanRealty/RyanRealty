# Buyer-journey E2E audit — findings (run 20260729-0525)

Target: https://ryan-realty.com (production).
Test identity: `matt+buyertest-20260729@ryan-realty.com`, Supabase user
`4e61dbb2-1650-4901-9757-059d398b1c69`, CRM person `59778`.
Contract: [qa/buyer-journey/manifest.json](../../../qa/buyer-journey/manifest.json),
verifier `qa/buyer-journey/verify.mjs`.

## Findings

### F1 · P0 · Saved searches stored a filter that matches nothing — alerts never fire
**Fixed** — commit `a4f13870` (+ extraction `HEAD`).

`SaveSearchButton` re-derived geography from the pathname and labeled every
second URL segment `subdivision`. `/homes-for-sale/bend/river-west`,
`/bend/old-bend` and `/bend/multi-family` share that shape but are a
neighborhood, a neighborhood, and a preset. The alert matcher compares
`subdivision` against `SubdivisionName`:

| stored filter | matching listings |
|---|---|
| `subdivision_lower = 'river-west'` | 0 |
| `subdivision_lower = 'old-bend'` | 0 |
| `subdivision_lower = 'multi-family'` | 0 |
| `boundary_neighborhood = 'River West'` | 7,215 |
| `boundary_neighborhood = 'Old Bend'` | 1,643 |

All four saved searches created in this journey would have sent zero alerts,
forever, with no error anywhere. Production blast radius at audit time was only
these 4 test rows (existing customer alerts use real subdivision names like
"West Hills", which do match), but any customer saving from a neighborhood or
preset page got a dead alert.

Fix: the page already resolves the segment, so it now passes canonical keys
down (`neighborhoodSlug` = `bend-river-west`, subdivision DISPLAY name, or the
preset's real params) via `lib/search/saved-search-path-filters.ts`.

### F2 · P1 · Advanced-search RPC could never match a multi-code property type
**Fixed** — migration `20260729140000`, applied to production.

`search_listings_advanced` matched `p_property_type` with `ILIKE '%value%'`, but
the app maps UI labels to MLS codes and sends a CSV. Single codes worked by
accident; multi-code labels could never match.

| p_property_type | before | after |
|---|---|---|
| `A,B,C` (Residential) | 0 | 1,052 |
| `E,F,G,H` (Commercial) | 0 | 45 |
| `C` (Multi-Family) | 24 | 24 |
| `D` (Land) | 195 | 195 |

1,052 + 195 + 45 = 1,292 = the unfiltered Bend active count, so the segments now
partition correctly. The main grid hid this because it serves property-type
filters from `listing_tile_mv`; the RPC path is reached by saved-search alerts
(a `neighborhoodSlug` forces it), deep pagination, and amenity-combined queries.

### F3 · P1 · /account sat on skeleton loaders for ~24s
**Fixed** — index applied to production, migration `20260729150000`.

Saved/liked/recently-viewed keys may be a `ListingKey` OR an MLS `ListNumber`,
so `getListingsByKeys` queries both in parallel. `listing_key` had a unique
index; `list_number` had none.

| | before | after |
|---|---|---|
| 12-key saved-homes lookup | Parallel Seq Scan, 593,866 rows filtered, **62,033 ms** | Index Scan, **32 ms** |
| /account time to content | ~24,000 ms | **897 ms** warm, 2,259 ms cold |

### F4 · P0 · Valuation form hangs on "Sending…" — the seller never sees confirmation
**Fixed** — commit `69b46e3d`.

`submitValuationRequest` ran everything on the request path: CRM capture,
tagging, broker alert, suppression check, property lookup, `computeCMA`, a
500-row city fetch, a PDF render, and two email sends. The client awaits the
server action, so the button stayed on "Sending…" the whole time.

| submit | outcome |
|---|---|
| 1 | acknowledgment email delivered **77s** after submit |
| 2 | **20s** |
| 3 | server action never returned inside **150s** |

The lead is captured every time, so this reads as a dead form: the seller gives
up or re-submits. This audit created duplicate `valuation_requests` rows doing
exactly what a real seller would do. Fix: insert + CRM capture stay inline
(must be durable before we answer), everything else moves to `after()`.

### F5 · P2 · Autocomplete has no entry for "RiverWest"
Typing `RiverWest` (one word, as a buyer would) returns "No results". The
neighborhood is registered as `River West`. Two-word spelling returns addresses
but no neighborhood row either — the neighborhood is reachable only by URL or
the Communities nav. Reported, not fixed.

### F6 · P3 · Listing-detail Save/Like controls have no accessible name
The detail-page control is a bare text `Save` button with no `aria-label`,
unlike the card control (`Save listing` / `Remove from saved`). Screen-reader
users get "Save" with no object. Reported, not fixed.

## Verified working

- Entry attribution: GBP → site carried `utm_source=gbp`, `rr_vid` cookie set, CRM person created with `source = ryan-realty.com`
- All four searches returned correct geography/type; 12/12 spot-checked listings matched the database on city, type, price, beds/baths
- Favorites: 12/12 saved through the UI, 12 rows in `saved_listings` with timestamps matching the clicks
- Search page loads: 632–845 ms (well under the 2s cap)
- Multi-family inventory is real: Bend 24 actives, Redmond multi-family reachable via the preset

## Not yet exercised

Phases 6 (CMA delivery + click tracking + per-figure §0 trace), 7 (market
reports ×4), and 8 (back-office integrity + cleanup). The CMA request itself was
exercised and produced F4. Test data still present: 12 `saved_listings`, 4
`listing_alerts`, 3 `valuation_requests`, CRM person 59778 — cleanup is a
required manifest step and has NOT been run.
