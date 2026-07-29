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

## Phases 6-8 (completed 2026-07-29 18:20Z, after the fixes deployed)

**All four fixes verified live.** The saved searches now store canonical filters
and match real inventory — 48 / 14 / 24 / 11 listings where every one was
**zero** before. The valuation form settles in **1,702 ms** with a proper
confirmation (was 20-150s+). `/account` renders in **897 ms** warm (was ~24 s).

**Phase 6 — CMA.** The seller LP created `cmas` row `cma-1265-saginaw`; the
build worker produced it with 3 comps and a $410,000 recommendation. Its own
adversarial audit returned **verdict `fail`** with three critical findings (two
of the three priced comps are attached condo/townhouse products against a
detached subject). The guard behaved exactly as designed: `needs_review = true`,
the full rationale recorded in `build_summary.review_reason`, `status` stayed
`draft`, `delivered_at` null, and `/cma/<slug>` correctly refused to serve a
draft. **Nothing was auto-delivered, and I did not approve it** — a CMA its own
auditor calls indefensible should not reach a homeowner. The audit was also
factually right: those comps really are in "Hawthorne Townhouses" and "Monterra
Condominiums" while the subject sits in Kenwood Gardens.

**Phase 7 — market reports.** Subscribed to all four journey geographies
(`bend-river-west`, `bend-old-bend`, `bend`, `redmond`), the send cron delivered
1 of 1 due, and the click chain was verified end to end: a signed tracking token
produced a 302 to the target plus an `email_click` row in `crm_timeline`
(`source = email-tracking`). Note the system sends **one digest covering all
subscribed areas**, not four separate emails — the manifest's "4 reports"
expectation is satisfied by 4 subscribed areas in one send.

**§0 figure verification.** 7 figures traced, **0 unverified** — see
[RUN-20260729-figure-trace.md](RUN-20260729-figure-trace.md). The one figure that
reached an inbox ("Old Bend home prices are down 17.1% from a year ago") traces
exactly to `market_stats_cache.yoy_median_price_delta_pct = -17.0558…`,
methodology `v3-2026-05-07`.

**Phase 8 — integrity + cleanup.** Exactly **1** CRM person despite ~6 form
submissions across the journey (no duplicates), correct source, 30 timeline rows
across 6 event kinds. Cleanup removed 124 rows across 11 tables plus the CRM
person and the Supabase auth user; re-verified **0 rows** across all 12 tables
and 0 remaining `buyertest` auth users.

Verifier: `node qa/buyer-journey/verify.mjs` → **exit 0**, 16/16 steps.

## New findings from phases 6-8

- **F5 · P2** — `/account/notifications` market-report prefs silently discard
  changes unless a separate "Save market report preferences" button is clicked.
  Every other toggle on the page auto-saves, under a header that reads "Changes
  save automatically." A buyer who flips the toggle and picks areas believes
  they subscribed; no row is written and nothing warns them.
- **F7 · P2** — search pages degrade to 20-50 s while the 15-minute
  `run_post_sync_pipeline` runs (`/homes-for-sale/redmond/multi-family` measured
  51.5 s / 4.4 s / 36.7 s), though the underlying MV query is 106 ms. Page
  latency is hostage to the sync job.
- **F8 · P3** — `marketing_assignments` accumulates a row per event rather than
  per person: one test buyer produced 12 identical `idx-registration` rows.
- **Editorial (not a data fault)** — the -17.1% subject line rests on 15 sales
  in a year and 3 in the last 90 days. Correctly cited, but thin; worth a
  minimum-sample floor before a neighborhood YoY move becomes a subject line.
