# Each data point a note pitched by its value

Source: prompt-motion research 2026-10-07 (sync points computed from the picture's curves)
Category: sound

Ready: implemented in `lib/studio/motion/sound.ts`, held by `lib/studio/motion/sound.test.ts`.

## Recipe
Each plotted value sounds as one note, pitched by its own verified value, on the frame the picture reaches it (sync points read off the picture's curves, never typed).

## Use
List `data_sonification` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
