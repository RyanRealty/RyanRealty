# Loopable edit seam

Source: Matt core recipe: loopable

## Recipe
Last 0.5 s of the end card crossfades into the frame-0 composition: `ffmpeg -i v.mp4 -filter_complex "[0]split[a][b];[b]trim=0:0.5,setpts=PTS-STARTPTS[h];[a][h]xfade=transition=fade:duration=0.5:offset=<len-0.5>"`. Record timeline.loop_seam.

## Use
List `loop_seam_edit` in brief.techniques. Mandatory spec_rules still apply.
