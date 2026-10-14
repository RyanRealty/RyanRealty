# Loopable edit seam

Source: Matt core recipe: loopable
Category: transition

Ready: implemented in `lib/studio/timeline/seam.ts` with the end card's `loop` iris (`lib/studio/motion/endcard.ts`), the plate's held opening frame (`lib/video/plate.ts`) and the frame-0 echo of the type layer (`MotionPlan.loopEcho` in `lib/studio/motion/cues.ts`), held by `lib/studio/timeline/seam.test.ts`.

## Recipe
The last 0.3 s of the locked end card irises into the frame-0 composition, so a replay is seamless. The renderer lays the film's own frame 0 under the card (held from the card's first frame), draws every other card as it is at t = 0 once the iris starts, and runs the film to the first whole frame at or after the card's out, where the iris is closed: the last frame is the opening picture. `video:check` check 13 measures it: SSIM of the last frame against frame 0 at least 0.85.

## Use
List `loop_seam_edit` in brief.techniques (or set spec_rules.loopable true). The film needs the end card.
