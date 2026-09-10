# References — `compare`

Table mark: **29** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/compare/page.tsx` · sample URL: `/compare`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The whole first viewport, both desktop and mobile — "Up to four homes" plus one sentence plus a text link is the entire page above the footer; nothing rewards scrolling because there is nothing below it. A visitor would not stop scrolling here because there is nothing past the first two lines to read.

## External pages to beat (one sentence each)

1. **Redfin Compare** (https://www.redfin.com/) — Empty state previews the comparison table shape with the visitor's own saved homes as one-tap adds.
2. **Zillow saved-homes compare** (https://www.zillow.com/) — Shows the product on first view: photo columns and feature rows, not a sentence describing them.
3. **Wirecutter comparison tables** (https://www.nytimes.com/wirecutter/) — Side-by-side columns with a visible winner mark; the table IS the first viewport.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Slots.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `app/compare/_v3/CompareEmpty.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/compare/CompareClient.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **table / sheet form — four visible slots as the product demo (V3Slots), never prose-plus-link**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c compare <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
