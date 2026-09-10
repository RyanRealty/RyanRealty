# References — `community`

Table mark: **61** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/communities/[slug]/page.tsx` · sample URL: `/communities/tetherow`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The "New listings · Tetherow" section directly under the hero — one plain sentence ("2 houses came on the market in Tetherow in the last 30 days") plus an email-capture form, no mark, no thumbnail, no timeline — reads like a newsletter-signup footer promoted to the second position on the page; no, a reader would not stop scrolling here.

## External pages to beat (one sentence each)

1. **Tetherow official** (https://tetherow.com/) — Resort photography and amenity story — pair with our live counts and atlas, never raw 'measured HOA' jargon.
2. **Redfin neighborhood / community market** (https://www.redfin.com/) — New-listings card carries a data mark before the email field.
3. **V3AlertsStrip + V3Instrument (shipped)** (components/site/v3/V3AlertsStrip.client.tsx) — Inline count or spark of recent activity on the new-listings card before any form.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3AlertsStrip.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **stat tile / alerts spark on new-listings; Atlas for place**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c community <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
