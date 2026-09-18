# SITE-128 — Bend @375 ring fit/scale (2026-09-18)

Look rematch FAIL on `dpl_AXi1pkPDec4yt1B9Xzs8vp322vdA` (`1a5ea269b` / Mini-land `ff126836a`).

## Production @375 (before — FAIL)

`prod-cities-bend-375-before.png` / `prod-cities-bend-375-before-map.png`

| | |
|---|---|
| Island | 335 × 208 |
| OverlayView SVG | **87 × 99** (dark knot) |
| Fill (constraining axis) | 0.48 |
| Bend chip | in DOM, parked on the knot under the $ pile |
| $ pills + 2×2 cards | PASS |

## Root cause

Phone-island camera called `fitBounds(recorded ring)` then `map.setZoom(9)`
using the *pre-fit* zoom (`fitBounds` is async). z9 on a 13rem island
projects the recorded city boundary to ~87×99. OverlayView teardown on
every effect redrew at that scale. Not missing geom.

## After (this tip, local `next dev --webpack` :3199)

`ours-local-cities-bend-375.png` / `ours-local-cities-bend-375-map.png`

| | |
|---|---|
| Island | 335 × 208 |
| OverlayView SVG | **137 × 162** |
| `data-place-look-zoom` | 10 (fitted, not clamped to 9) |
| `data-place-look-ring` | `in-view` |
| `data-place-look-fill` | **0.78** |
| Bend chip | visible at the north of the fitted ring |
| $ pills + 2×2 cards | PASS (no regression) |

Same recorded city GeoJSON. Pin cap 36 and 13rem / 2×2 cards untouched.
Measure JSON: `ours-local-cities-bend-375-measure.json`.
