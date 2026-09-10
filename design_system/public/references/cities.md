# References — `cities`

Table mark: **30** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/cities/page.tsx` · sample URL: `/cities`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The city list itself: seven-plus hairline-divided rows of a thumbnail, a name, a one-line description, and a bare right-aligned number — the literal "wall of text, scrolling lists" Matt named, with no bar, chart, map, or interaction anywhere in the fold.

## External pages to beat (one sentence each)

1. **Zillow Bend homes** (https://www.zillow.com/bend-or/) — City directory encodes magnitude (price / count) as a visible mark, not a bare right-aligned numeral.
2. **Visit Bend places index** (https://www.visitbend.com/) — Place identity (photo + name) leads; counts are secondary and still readable at a glance.
3. **NYT The Upshot city indexes** (https://www.nytimes.com/section/upshot) — Directory rows carry a shared-scale bar or dot so magnitude is felt before the label is read.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3PlaceIndex.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Quiet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **horizontal bar or dot strip on a shared inventory scale behind each city row**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c cities <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
