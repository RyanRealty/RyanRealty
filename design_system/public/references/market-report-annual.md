# References — `market-report-annual`

Table mark: **31** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/housing-market/annual-review/page.tsx` · sample URL: `/housing-market/annual-review`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The opening #market section, which is the entire visible page on both shots — 16 static stat tiles with zero chart, mark, or interactive element in view; a reader scrolls past it the way they'd scroll past a spreadsheet, and the wired chart that could have carried the section never appears in the fold.

## External pages to beat (one sentence each)

1. **NAR Housing Statistics annual** (https://www.nar.realtor/research-and-statistics) — Headline claim over a chart; tiles are not the whole first screen.
2. **Case-Shiller / S&P release pages** (https://www.spglobal.com/) — One series with a scrubber and annotation beats a sixteen-tile KPI wall.
3. **Our World in Data annual reviews** (https://ourworldindata.org/) — Small multiples or one emphasis line; every figure has a plain sentence.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Chart.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Drawing.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **emphasis line with a scrubber (or small multiples) — cap headline tiles at 3–4 with a plain sentence each**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c market-report-annual <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
