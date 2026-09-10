# References — `listing-detail`

Table mark: **55** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/listing/[listingKey]/page.tsx` · sample URL: `/listing/220222277`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The price/facts block: a real $50,000 price-drop data point is stated as one line of plain text with no visual encoding and nothing to interact with — the exact static-figure-row pattern TASTE.md names as the floor, never the ceiling.

## External pages to beat (one sentence each)

1. **Zillow Showcase listings** (https://www.zillow.com/) — Full-bleed gallery with filmstrip index; price-cut is a visual event, not one muted line.
2. **Redfin listing detail** (https://www.redfin.com/) — Map, payment estimate, and interactive facts reachable without leaving the fold's identity.
3. **V3ListingClose + V3Atlas (shipped)** (components/site/v3/V3ListingClose.client.tsx) — Price-cut close instrument and atlas already exist below the fold — pull identity into the first viewport.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3ListingClose.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Sheet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **hero figure gallery with filmstrip; price-cut as visual exception mark**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c listing-detail <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
