# References — `sell`

Table mark: **59** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/sell/page.tsx` · sample URL: `/sell`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The entire visible viewport on both shots — it is one hero photo, one headline, and one address field with a submit button; competent and on-brand, but a person would fill the field or bounce, not stop scrolling, because nothing on screen suggests there's more to see.

## External pages to beat (one sentence each)

1. **Zillow seller hub / Zestimate entry** (https://www.zillow.com/seller-advertise/) — Address field sits on a composed product preview, not a lone photo+CTA.
2. **Redfin sell / instant offer entry** (https://www.redfin.com/) — Typing an address reframes the hero toward the subject — form-specific behavior.
3. **V3Stage + V3Ask (shipped)** (components/site/v3/V3Ask.client.tsx) — Address ask already exists; give Stage a form-specific dim/reframe toward the typed street.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Stage.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Ask.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Sheet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **Stage + ask with form-specific motion that IS the data (reframe toward address)**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c sell <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
