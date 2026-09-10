# References — `buy`

Table mark: **42** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/buy/page.tsx` · sample URL: `/buy`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The hero. Eyebrow ("CENTRAL OREGON") over a large serif headline over one CTA button on a full-bleed landscape photo is the exact shape TASTE.md names as the model's "statistically safest layout" — the only difference from the banned "stacked-section" description is that there is no figure row yet, because there is no data in the hero at all. It is a page whose entire job is helping someone buy a house, and its first and only visible content in a 900px-tall capture is a picture of a mountain.

## External pages to beat (one sentence each)

1. **Redfin Bend buy** (https://www.redfin.com/city/16163/OR/Bend) — Hero carries live inventory signal, not only a photo and CTA.
2. **Zillow buy search** (https://www.zillow.com/bend-or/) — Count and price band visible in the first viewport beside the search control.
3. **Stripe Checkout / product heroes** (https://stripe.com/) — One primary ask with a live product object in frame — data as spectacle, not eyebrow→heading→CTA alone.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Stage.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Pulse.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3ListingRow.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **hero figure / pulse inside Stage; listing row density below**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c buy <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
