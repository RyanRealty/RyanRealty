# SITE-128 — Bend @375 ring fill settle (2026-09-19)

Look rematch FAIL on `dpl_8mPgUD1TnSYE6efbuk2E1mbYGp1k` after Cos rematch of
`381997f27` (`subjectRingKeepFittedZoom`).

## Production @375 (before — FAIL)

`placeLookRing=refit` `placeLookZoom=10` `placeLookFill=0.00`
Ring SVG ~101×126 on 320×187. Dark knot under $ pills. Chip unread.
$ pills + 2×2 photo cards PASS.

## Why fill stayed 0 / the knot persisted after 381997f27

1. `subjectRingKeepFittedZoom(10)` returns 10. It only blocked the old
   `setZoom(9)`. `fitBounds` on a 13rem island still settles on integer z10.
2. At z10 the projected SVG is 101×126. Fill = 101/187 ≈ 0.54 (need ≥ 0.7).
3. `pixelBox()` was read on the same idle as `update()`, before OverlayView
   drew, so `placeLookFill` stamped `0.00` and never restamped.
4. The 450ms apply called `fitBounds` again and snapped any later zoom back
   to z10. `ringInView` refit zoomed OUT when bbox corners clipped, never IN.

## After (this tip)

`subjectRingZoomFromMeasuredBox(10, 320×187, 101×126)` → ~10.37.
Predicted box ~131×163. Fill 0.70. Max box 163 ≥ 110.

Same recorded city GeoJSON. Pin cap 36 and 13rem / 2×2 cards untouched.
Fractional zoom on the look island. Settle restamps fill after draw.

| Shot | What it proves |
|---|---|
| `ours-local-cities-bend-375.png` | City outline spans the island; Bend chip; 2×2 cards |
| `ours-local-cities-bend-375-map.png` | Map crop: fill ≥ 0.7, box ≥ 110, not a 101×126 knot |
| `ours-local-cities-bend-375-measure.json` | island, SVG box, fill, zoom, ring, pills, cards |
