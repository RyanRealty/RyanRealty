# Imagine seamless loop (Loop role)

Source: round4 seasonal loop; @imagine 2026-09-08

## Recipe
Use the Loop image role. Prompt: `Light snow drifting past ponderosa trunks, camera locked off, 35mm, overcast flat light, subtle handheld breathing.` Verify seam: `ffmpeg -i clip.mp4 -vf "select='eq(n,0)+eq(n,N-1)'" -vsync 0 seam_%d.png` and compare.

## Use
List `imagine_seamless_loop` in brief.techniques. Mandatory spec_rules still apply.
