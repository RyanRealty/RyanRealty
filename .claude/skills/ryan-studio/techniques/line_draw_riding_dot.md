# Line drawn on with a riding dot

Source: prompt-motion research 2026-10-07 (ultimaxbt-bbebf5: the dot and the line move as one)
Category: scene

Ready: implemented in `lib/studio/motion/chart.ts`, held by `lib/studio/motion/paper.test.ts`.

## Recipe
A verified monthly series drawn left to right on the brand ease while a navy dot rides the tip; time on x is film time, a month with no published value is a gap the dot steps over. The first and latest months are labelled at their own points (end-of-line label, full-ink leader). Used by the `market_trend` paper film.

## Use
List `line_draw_riding_dot` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
