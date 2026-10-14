# Subframe motion blur

Source: video-skills-research 2026-10-13 #2 (claude-motion-design)

## Recipe
Render 4 subframes per output frame on a 180 degree shutter and blend: `ffmpeg -i frames_120fps/%05d.png -vf "tmix=frames=2:weights='1 1',fps=30" -c:v libx264 -crf 16 out.mp4`. Never blend across a hard cut (split at cuts first). 540p draft before master.

## Use
List `subframe_motion_blur` in brief.techniques. Mandatory spec_rules still apply.
