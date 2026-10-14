# Subframe motion blur

Source: video-skills-research 2026-10-13 #2 (claude-motion-design)
Category: transition

Planned: not on the menu yet (video_gate refuses it). Home when built: lib/studio/motion/render.ts.

## Recipe
Render several subframes per output frame on a 180 degree shutter and average them, so fast moves blur like a camera's. Never blend across a hard cut. The motion stage is a pure function of t, so subframes are just extra seeks.

## Use
List `subframe_motion_blur` in brief.techniques once it is ready.
