# References — `city`

Table mark: **54** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/cities/[slug]/page.tsx` · sample URL: `/cities/bend`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The 'NEW LISTINGS · BEND / 142 houses' stat block — a correctly sourced, correctly verdicted, well-typeset number and sentence that gives the reader nothing to do but read it once and scroll or leave; no mark, no toggle, no reveal.

## External pages to beat (one sentence each)

1. **Zillow Bend market** (https://www.zillow.com/bend-or/home-values/) — Interactive market chart and inventory context in the first scroll.
2. **Redfin Bend housing market** (https://www.redfin.com/city/16163/OR/Bend/housing-market) — Supply encoded as graphics, not only a verdict sentence.
3. **V3Atlas + V3AlertsStrip (shipped)** (components/site/v3/V3Atlas.client.tsx) — Cream field / navy marks / door numerals that reveal more on hover — the house differentiator for place pages.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3AlertsStrip.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **horizontal bar MOS + Atlas; alerts door numerals with hover**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c city <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
