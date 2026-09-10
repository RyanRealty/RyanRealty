# References — `reviews`

Table mark: **48** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/reviews/page.tsx` · sample URL: `/reviews`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The #reach block — a person landing on a reviews page to judge trustworthiness meets four identical arrow-tipped rows of contact info before seeing a single star or quote, which is the least compelling way to open a page whose entire subject is a perfect 5.0 across 25 reviews.

## External pages to beat (one sentence each)

1. **Google Business Profile reviews UI** (https://www.google.com/maps) — Stars and quotes lead; contact reaches are not the first band.
2. **Zillow agent reviews** (https://www.zillow.com/) — Review density is visual (stars + count) before any phone-book row.
3. **V3Proof / V3ProofBlock (shipped)** (components/site/v3/V3Proof.client.tsx) — Quotes and figures as the object; reach sits beside proof, not above it as four equal doors.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Proof.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3ProofBlock.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Doors.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **beeswarm or proof quotes as the object; collapse reach below proof**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c reviews <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
