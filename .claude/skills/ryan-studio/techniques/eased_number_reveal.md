# Eased number reveal

Source: RULEBOOK 2b (calm eased entrances, 2026-10-09)
Category: type

Ready: implemented in `lib/studio/motion/reveal.ts` (the curves) and drawn by `lib/studio/motion/cues.ts` (`number` cue, `frameState`), held by `lib/studio/motion/reveal.test.ts`. The timeline renderer (`npm run studio:render`) records it only when the page actually drew the figure.

## Recipe
One hero number per beat, a `number` card in timeline.json bound to a brief.numbers row (`{ "kind": "number", "number": "<key>" }`). The number scales 0.92 to 1 and fades 0 to 1 over 12 frames on the brand ease (cubic-bezier .22,.61,.36,1), no overshoot. Then the HOLD DRIFT: once landed, the card rises a slow, linear 8 px across its whole hold, so no frame is ever frozen (video:check check 6, ffmpeg freezedetect, matters most on cream paper beats). Every held timeline card drifts the same way. Hold at least 2.5 s. The value is Geist (never Amboqia on a figure), the unit line is Amboqia, and the footer carries the scope and the as-of date from the figure's own trace. `figureLeaks` refuses any digit with no brief.numbers row. Remotion is gone; there is no `spring()` here.

## Use
List `eased_number_reveal` in brief.techniques and give a beat a number card.
