# SITE-128 — Bend @375 ring fit/scale (2026-09-18)

Look rematch FAIL on `dpl_AXi1pkPDec4yt1B9Xzs8vp322vdA` (`1a5ea269b` / Mini-land `ff126836a`).

## Production @375 (before — FAIL)

`prod-cities-bend-375-before.png` — live ryan-realty.com `/cities/bend` at 375.
Halo/ink CSS present. OverlayView SVG ~87×99px under the $ pile (dark knot).
Bend chip not visible. $ pills + 2×2 photo cards PASS.

## Root cause

Phone-island camera called `fitBounds(recorded ring)` then `map.setZoom(9)`
using the *pre-fit* zoom (`fitBounds` is async). z9 on a 13rem island
projects the recorded city boundary to ~87×99. OverlayView teardown on
every effect redrew at that scale. Not missing geom.

## After (this tip)

| Shot | What it proves |
|---|---|
| `ours-local-cities-bend-375.png` | City outline spans the island under $ pills; Bend chip readable; 2×2 cards |
| `ours-local-cities-bend-375-map.png` | Map crop: ring fill ≥ 0.7, not an 87×99 knot |
| `ours-local-cities-bend-375-measure.json` | SVG box, island box, fill, zoom, pill count, card count |

Same recorded city GeoJSON. Pin cap 36 and 13rem / 2×2 cards untouched.
