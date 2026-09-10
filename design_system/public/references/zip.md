# References — `zip`

Table mark: **33** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/zip/[zip]/page.tsx` · sample URL: `/zip/97702`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The Field/map section: the map is the visual centerpiece of the first viewport and it is an unstyled, default Google Maps embed with Google's own chrome — the exact object TASTE.md names as the thing not to ship ("Not a Google default map"). I would not stop scrolling on the strength of what's visible; the page reads as a functional listings directory, not an editorial statement about this ZIP.

## External pages to beat (one sentence each)

1. **Zillow ZIP pages** (https://www.zillow.com/) — ZIP identity + inventory map with styled tiles and a claim sentence above the list.
2. **Census Reporter ZIP profiles** (https://censusreporter.org/) — One hero figure for the place, then interactive charts — never an unstyled embed as the centerpiece.
3. **V3Atlas (shipped)** (/cities/bend) — Navy-on-cream cartography already exists in-tree; adapt it rather than shipping Google default chrome.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Field.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **map with data-encoded cells via V3Atlas treatment; hero figure for the ZIP claim**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c zip <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
