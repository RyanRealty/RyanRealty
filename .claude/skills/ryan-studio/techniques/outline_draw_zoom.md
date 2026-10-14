# Camera into a place, its outline drawn on

Source: prompt-motion research 2026-10-07 (log-space zoom about the fixed point)
Category: scene

Ready: implemented in `lib/studio/motion/map.ts`, held by `lib/studio/motion/paper.test.ts`.

## Recipe
The city outline, a log-space camera move about the fixed point into the place, the place's recorded `boundaries` outline drawn on ring by ring (starting at 60% of the move), then its live figures. A faint ghost outline rides the whole zoom so no frame of the move is empty. Used by the `place_map` paper film.

## Use
Tier: signature. A film may use it only once Matt has approved it (status `approved` with his reel); until then video_gate and the render preflight refuse it.

In a timeline film: a beat with no footage and `scene: { kind: "outline_draw_zoom", outline: "<key>", line: "<heading words>", eyebrow?: "<small capitals>" }`, and a `brief.outlines` row `{ key, geo_type, geo_slug, context?, source }`. The renderer reads the outline (and the context it zooms in from, when given) from the `boundaries` table through `getBoundaryGeoJSON`; with no context the outline draws at once. The beat needs a `context` (the planner refuses a camera that does not move) and about 3.5 s for the move, the draw and its hold.

Known gap (measured 2026-10-14 on a synthetic timeline film): on its cream beat the camera move and the hairline draw change too few pixels for check 6 (freezedetect, 1.2 s), which read the beat as frozen until the fill arrived. Before Matt sees a reel, the beat needs more moving mass (the tint growing with the camera, heavier strokes, or the place's figures arriving during the move). The heading is the proof the renderer reads back off the page before it records the technique; `video:check` fails a brief technique that never ran.
