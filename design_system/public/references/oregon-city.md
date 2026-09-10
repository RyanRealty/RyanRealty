# References — `oregon-city`

Table mark: **41** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/oregon/[city]/page.tsx` · sample URL: `/oregon/medford`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The hero (#top): three static numbers and a button, no image, no map, no interaction, indistinguishable from the same section on any of the other ~360 city pages this route serves — no, a reader would not stop scrolling here.

## External pages to beat (one sentence each)

1. **City of Bend official site** (https://www.bendoregon.gov/) — Place identity (photo / landmark) before any stat strip.
2. **Zillow city overview** (https://www.zillow.com/bend-or/home-values/) — Market claim with a chart form, not three orphaned KPI tiles.
3. **DATA_GRAPHICS MOS pattern (in-repo)** (docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md) — Two bars — homes for sale vs a month of sales — is the house form for supply, not a tile that says 3.9.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Stage.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **horizontal bar MOS (homes for sale vs a month of sales) instead of three KPI tiles**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c oregon-city <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
