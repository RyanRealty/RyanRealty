# Eased number reveal

Source: RULEBOOK 2b (calm eased entrances, 2026-10-09)
Category: type

Planned: not on the menu yet (video_gate refuses it). Home when built: lib/studio/motion/cues.ts.

## Recipe
One hero number per beat. In the motion stage (`lib/studio/motion/cues.ts` frameState, a pure function of t): scale 0.92 to 1 and opacity 0 to 1 over 12 frames on the brand ease, then a slow drift (about 8 px up across the hold) so the frame never freezes. Hold at least 2.5 s. The number has a brief.numbers row and is a verified subject figure (`figureLeaks`). Remotion is gone; there is no `spring()` here.

## Use
List `eased_number_reveal` in brief.techniques once it is ready.
