# Loopable edit seam

Source: Matt core recipe: loopable
Category: transition

Planned: not on the menu yet (video_gate refuses it). Home when built: lib/studio/motion/endcard.ts loop option over frame 0.

## Recipe
The last 0.3 s of the locked end card irises into the frame-0 composition, so a replay is seamless. `lib/studio/motion/endcard.ts` already has the `loop` option; it ships when the renderer lays frame 0 under the card. `video:check` check 13 measures it: SSIM of the last frame against frame 0 at least 0.85.

## Use
List `loop_seam_edit` in brief.techniques once it is ready.
