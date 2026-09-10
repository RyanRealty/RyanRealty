# References — `price-drops`

Table mark: **30** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/price-drops/page.tsx` · sample URL: `/price-drops`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The listing grid itself, even setting the overlap bug aside — it is a photo, a price, a badge, and an address, the exact form of a portal's price-reduced search results, with no chart or drill-in to make the reader pause.

## External pages to beat (one sentence each)

1. **Redfin price-reduced search** (https://www.redfin.com/) — Drop amount is a first-class mark on the card, not a badge afterthought.
2. **Zillow price-cut filters** (https://www.zillow.com/) — The reduced state is the filter and the visual story of the grid.
3. **WSJ Markets 'biggest movers'** (https://www.wsj.com/market-data) — Change is encoded as signed marks on a shared scale — magnitude before address.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3ListingRow.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3AlertsStrip.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Ledger.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **stat tile with sparkline or signed horizontal bar for drop magnitude on each card**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c price-drops <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
