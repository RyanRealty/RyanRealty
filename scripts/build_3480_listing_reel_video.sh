#!/usr/bin/env bash
# Animated 9:16 listing Reel from reel-*.png (Ken Burns + swipe-left).
set -euo pipefail
DIR="out/listing/3480-sw-45th-redmond"
OUT="$DIR/3480-listing-reel.mp4"
N=$(ls "$DIR"/reel-*.png | wc -l | tr -d ' ')
FPS=30; SECS=4; DUR=0.6; D=$(echo "$FPS * $SECS / 1" | bc)
inputs=(); fc=""
for i in $(seq 1 "$N"); do
  f=$(printf "%s/reel-%02d.png" "$DIR" "$i"); inputs+=(-i "$f"); idx=$(( i - 1 ))
  if (( i % 2 == 0 )); then z="z='min(zoom+0.0009,1.11)'"; else z="z='if(lte(zoom,1.0),1.11,max(1.001,zoom-0.0009))'"; fi
  fc+="[${idx}:v]scale=1350:2400:force_original_aspect_ratio=increase,crop=1350:2400,zoompan=${z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${D}:s=1080x1920:fps=${FPS},setsar=1[v${idx}];"
done
step=$(echo "$SECS - $DUR" | bc); prev="[v0]"
for i in $(seq 1 $(( N - 1 ))); do
  off=$(echo "$step * $i" | bc)
  if (( i == N - 1 )); then out="[vout]"; else out="[x${i}]"; fi
  fc+="${prev}[v${i}]xfade=transition=slideleft:duration=${DUR}:offset=${off}${out};"; prev="${out}"
done
fc="${fc%;}"
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[vout]" \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 -preset medium -movflags +faststart "$OUT"
echo "Wrote $OUT"
