# References — `market-report-region`

Table mark: **63** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/housing-market/central-oregon/page.tsx` · sample URL: `/housing-market/central-oregon`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The source/citation paragraph beneath the chart — dense, jargon-laced ("leftover membership," "sample-gated when published"), and the least editorial text on the page; a reader would not stop scrolling there, it is the opposite register of the plain claim sentence sitting just above it.

## External pages to beat (one sentence each)

1. **Redfin regional market data** (https://www.redfin.com/news/data-center/) — Regional chart with plain-English citation under the figure.
2. **Oregon OHCS / housing reports** (https://www.oregon.gov/ohcs) — Public agency plain language for methodology; no leftover-membership jargon in visitor copy.
3. **V3Chart + V3SourceLine (shipped)** (components/site/v3/V3Chart.tsx) — Rewrite the trace in buyer/seller language; keep hover on the regional series.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Chart.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3SourceLine.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **emphasis line with scrubber; plain source line**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c market-report-region <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
