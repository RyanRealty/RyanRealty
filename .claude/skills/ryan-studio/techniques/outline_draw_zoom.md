# Camera into a place, its outline drawn on

Source: prompt-motion research 2026-10-07 (log-space zoom about the fixed point)
Category: scene

Ready: implemented in `lib/studio/motion/map.ts`, held by `lib/studio/motion/paper.test.ts`.

## Recipe
The city outline, a log-space camera move about the fixed point into the place, the place's recorded `boundaries` outline drawn on ring by ring (starting at 60% of the move), then its live figures. A faint ghost outline rides the whole zoom so no frame of the move is empty. Used by the `place_map` paper film.

## Use
List `outline_draw_zoom` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
