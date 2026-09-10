# References — `team`

Table mark: **39** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/team/page.tsx` · sample URL: `/team`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The whole page, immediately — three identical contact cards are the entire route with nothing below the fold worth scrolling to, so there is no point at which the page earns a second look.

## External pages to beat (one sentence each)

1. **Compass agent roster** (https://www.compass.com/) — Editorial roster rows: photo, specialty line, one primary reach — not three identical icon-button cards.
2. **The Agency team** (https://www.theagencyre.com/) — Portraits at a shared head height with a one-line bio in the broker's register.
3. **Linear team / about craft** (https://linear.app/) — Restraint: one primary action per person, secondary reaches as text links.

## Adapt from shipped code (do not generate from adjectives)

- `app/about/_v3/AboutFaces.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Doors.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Proof.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **editorial roster (faces + specialty line); one primary reach per broker**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c team <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
