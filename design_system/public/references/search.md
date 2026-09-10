# References — `search`

Table mark: **32** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/search/page.tsx` · sample URL: `/search`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The map basemap: stock, unstyled Google Maps cartography occupying the majority of both viewports, carrying none of the site's navy-on-cream identity.

## External pages to beat (one sentence each)

1. **V3Atlas on this site's place pages** (/cities/bend) — Cream field, navy marks, place names — cartography that IS the brand, not Google default chrome.
2. **Redfin map search** (https://www.redfin.com/city/16163/OR/Bend) — Pins encode price; the map is the product and the list is the detail.
3. **Apple Maps / Mapbox studio examples** (https://www.mapbox.com/maps) — Custom basemap identity; stock Google tiles are the floor this class must leave.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Field.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Atlas.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Filter.client.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **map with data-encoded cells (Atlas-grade basemap), never stock Google chrome**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c search <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
