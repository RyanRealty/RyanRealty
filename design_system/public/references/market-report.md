# References — `market-report`

Table mark: **41** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/housing-market/page.tsx` · sample URL: `/housing-market`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

#chooser — a visitor's honest first read of a page titled "housing market" is a five-row text menu with no number, mark, or chart anywhere on screen; nobody stops scrolling here, and there is nothing yet to stop for.

## External pages to beat (one sentence each)

1. **Redfin Data Center** (https://www.redfin.com/news/data-center/) — Chooser previews a spark or figure behind each door so the hub is not a bare link list.
2. **NAR research hub** (https://www.nar.realtor/research-and-statistics) — Each entry shows a recent number beside the label.
3. **FT Markets hub** (https://www.ft.com/markets) — Index chips with live figures lead; prose follows.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Doors.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Chart.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **stat tile with sparkline behind each chooser door**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c market-report <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
