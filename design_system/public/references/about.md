# References — `about`

Table mark: **31** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/about/page.tsx` · sample URL: `/about`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The #who contact-link stack — it is a column of seven anchor tags with an arrow icon, no image, no data mark, nothing that earns a second look before the reader either clicks a phone number or leaves.

## External pages to beat (one sentence each)

1. **Compass About** (https://www.compass.com/about/) — Faces and the firm's own record open the page; contact channels are secondary reach, not the fold.
2. **The Agency About** (https://www.theagencyre.com/) — Editorial portraits at display scale carry identity before any link list.
3. **Stripe About** (https://stripe.com/about) — Quiet claim + one proof object; no phone-book stack of equal weight links.

## Adapt from shipped code (do not generate from adjectives)

- `app/about/_v3/AboutFaces.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Proof.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Doors.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order and the 2026-09-12 lock: **firm-story hero on the office exterior; Google reviews + featured quote; closings carousel; Contact four-up; one-line inquiry to /contact; Who you work with teasers that only door to /team**. Do not open on broker Cards.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c about <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
