# Contact-sheet self review

Source: video-skills-research #5 (claude-motion)

## Recipe
One frame per beat midpoint from timeline.json: `ffmpeg -i out.mp4 -vf "select='eq(n,F1)+eq(n,F2)...',tile=4x3" sheet.png`. Check collisions, clipping, holds, end card text before delivery.

## Use
List `contact_sheet_review` in brief.techniques. Mandatory spec_rules still apply.
