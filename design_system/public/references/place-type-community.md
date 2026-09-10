# References — `place-type-community`

Table mark: **44** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/communities/[slug]/types/[type]/page.tsx` · sample URL: `/communities/tetherow/types/single-family`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

Desktop's entire first viewport, below the header and one headline, is eight identical rows of thumbnail–address–price–specs with a hairline between each — no chart, no map, no claim sentence, no visual encoding of price. It is the rubric's own definition of a banned tell ("a Ledger past six rows with no visual encoding is a table wearing hairlines"), and on desktop it is not one section among several, it IS the fold.

## External pages to beat (one sentence each)

1. **Tetherow's own site** (https://tetherow.com/) — Subject owns photographs and story; we must add numbers and map interaction they lack.
2. **Zillow community / HOA pages** (https://www.zillow.com/) — List is secondary to a place claim and map; bare scrolling address rows fail.
3. **V3Atlas + Instrument (shipped)** (components/site/v3/V3Atlas.client.tsx) — Claim-first stat line above the list, atlas as differentiator when the boundary loads.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3ListingRow.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **map with data-encoded cells + hero figure claim above the list**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c place-type-community <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
