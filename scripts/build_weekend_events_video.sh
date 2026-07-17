#!/usr/bin/env bash
# Animated swipe/Ken Burns MP4 from the weekend-events carousel PNGs.
# Each slide: slow zoom (Ken Burns), 3s; swipe-left transition between slides (0.5s).
# Output: 1080x1350 portrait h264, faststart.
set -euo pipefail

DIR="out/carousel/weekend-events-2026-07-17"
OUT="$DIR/weekend-events-animated.mp4"
N=$(ls "$DIR"/slide-*.png | wc -l | tr -d ' ')
FPS=30
SECS=3                 # seconds per slide
DUR=0.5                # transition duration
D=$(( FPS * SECS ))    # frames per slide

# Build inputs + per-slide zoompan labels
inputs=()
fc=""
for i in $(seq 1 "$N"); do
  f=$(printf "%s/slide-%02d.png" "$DIR" "$i")
  # single-frame input (NO -loop/-t): zoompan d=D accumulates zoom over D frames from one still
  inputs+=(-i "$f")
  idx=$(( i - 1 ))
  # alternate zoom direction for variety
  if (( i % 2 == 0 )); then
    z="z='min(zoom+0.0009,1.12)'"
  else
    z="z='if(lte(zoom,1.0),1.12,max(1.001,zoom-0.0009))'"
  fi
  fc+="[${idx}:v]scale=1350:1688:force_original_aspect_ratio=increase,crop=1350:1688,zoompan=${z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${D}:s=1080x1350:fps=${FPS},setsar=1[v${idx}];"
done

# xfade (slideleft) chain
step=$(echo "$SECS - $DUR" | bc)
prev="[v0]"
for i in $(seq 1 $(( N - 1 ))); do
  off=$(echo "$step * $i" | bc)
  if (( i == N - 1 )); then
    out="[vout]"
  else
    out="[x${i}]"
  fi
  fc+="${prev}[v${i}]xfade=transition=slideleft:duration=${DUR}:offset=${off}${out};"
  prev="${out}"
done
fc="${fc%;}"

ffmpeg -y -loglevel error "${inputs[@]}" \
  -filter_complex "$fc" -map "[vout]" \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 -preset medium \
  -movflags +faststart "$OUT"

echo "Wrote $OUT"
