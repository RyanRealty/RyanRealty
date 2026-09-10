# References — `place-type`

Table mark: **69** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/cities/[slug]/types/[type]/page.tsx` · sample URL: `/cities/bend/types/single-family`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The opening: two near-identical Amboqia headlines ("Single-family in Bend" then "Single-family on the map") stacked with nothing but whitespace between them. It is the single least-composed passage on the page, made worse by sitting directly above a genuinely strong object — the Atlas density map — that TASTE itself names as the reference to copy.

## External pages to beat (one sentence each)

1. **Zillow Bend single-family search** (https://www.zillow.com/bend-or/) — One H1 claim, then map — not two stacked near-identical Amboqia titles.
2. **Redfin property-type filtered map** (https://www.redfin.com/city/16163/OR/Bend) — Atlas opens with a caption, not a duplicate headline.
3. **V3Atlas (shipped)** (components/site/v3/V3Atlas.client.tsx) — Give Atlas a short eyebrow/caption; one plain claim under the page H1, then the map.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Quiet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3ListingRow.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **map with data-encoded cells under one H1 claim**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c place-type <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
