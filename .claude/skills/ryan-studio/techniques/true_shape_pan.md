# True-shape pan across a real photo

Source: Matt 2026-10-07: listing photos never squeezed
Category: footage

Ready: implemented in `lib/video/pan.ts`, held by `lib/video/pan.test.ts`.

## Recipe
A real photo is scaled uniformly and a 9:16 window eases across it; never stretched, squeezed or regenerated (Matt 2026-10-07). Direction alternates per beat; a tall photo pans down.

## Use
List `true_shape_pan` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
