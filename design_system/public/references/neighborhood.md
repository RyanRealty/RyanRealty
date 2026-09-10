# References — `neighborhood`

Table mark: **58** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/cities/[slug]/[neighborhoodSlug]/page.tsx` · sample URL: `/cities/bend/awbrey-butte`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The new-listings callout block: correct, on-token, and the only content visible in the fold, but it reads as a static sentence beside a newsletter form — its one real interaction (the numeral door) is invisible at rest, so nothing on screen signals there is anything to do here; a reader lands on a poster and a signup box, not a market.

## External pages to beat (one sentence each)

1. **Awbrey Butte / local HOA or neighborhood association pages** (https://www.bendoregon.gov/) — Place voice and map identity; we win on live MLS depth they lack.
2. **Zillow neighborhood pages** (https://www.zillow.com/) — New-listings signal is interactive / linked into inventory, not a static sentence + newsletter only.
3. **V3AlertsStrip (shipped)** (components/site/v3/V3AlertsStrip.client.tsx) — Door numeral with a persistent affordance at rest; hover/focus reveals the listings path.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3AlertsStrip.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **stat tile with sparkline or alerts door with persistent affordance**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c neighborhood <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
