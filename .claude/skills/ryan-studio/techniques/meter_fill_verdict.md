# Months-of-supply meter filling to its value

Source: Studio motion stage 2026-10-07 (critic pass: a meter fills to its value)
Category: scene

Ready: implemented in `lib/studio/motion/cues.ts`, held by `lib/studio/motion/cues.test.ts`.

## Recipe
The months-of-supply meter fills to its value (never to a zone edge), and the verdict word, zones and number come from one `marketVerdict` call (seller's at 4 or under, balanced 4 to 6, buyer's 6 or over; ads say "buyers have leverage").

## Use
List `meter_fill_verdict` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
