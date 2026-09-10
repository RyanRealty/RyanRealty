# References — `market-report-detail`

Table mark: **53** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/housing-market/[...slug]/page.tsx` · sample URL: `/housing-market/bend`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The source/methodology paragraph at the foot of the fold — dense, undifferentiated small gray prose with an internal codename buried in it; nobody's eye stops there, and on mobile it consumes the rest of the visible screen with the least designed text on the page.

## External pages to beat (one sentence each)

1. **Redfin monthly housing market updates** (https://www.redfin.com/news/) — Chart first, plain-language source line — no internal methodology codenames in the fold.
2. **Our World in Data chart pages** (https://ourworldindata.org/) — Emphasis line + scrubber; citation is plain English under the figure.
3. **V3Chart + V3SourceLine (shipped)** (components/site/v3/V3Chart.tsx) — Hover/scrub on the series; source line is visitor language, not mt-v1 stamps.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Chart.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3SourceLine.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **emphasis line with scrubber; plain-language source chip**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c market-report-detail <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
