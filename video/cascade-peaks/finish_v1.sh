#!/usr/bin/env bash
# Post-render pipeline for Cascade Peaks v1:
#   1. Compress MP4 for IG/email (target <25MB)
#   2. Extract 13 scene thumbnails
#   3. Fire send_v1.py
# Run this after cascade_peaks_v1_raw.mp4 is complete.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
RAW="$OUT/cascade_peaks_v1_raw.mp4"
FINAL="$OUT/cascade_peaks_v1.mp4"

[ -f "$RAW" ] || { echo "Missing raw MP4: $RAW"; exit 1; }

echo "== Compressing raw MP4 =="
ffmpeg -y -i "$RAW" \
  -c:v libx264 -preset slow -crf 24 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -vf "scale=1080:1920:flags=lanczos" \
  -an \
  "$FINAL" 2>&1 | tail -5

ls -lh "$FINAL"

echo
echo "== Extracting scene thumbnails =="
# FPS=30, scene midpoints (in seconds):
#   open     f48   -> 1.60s
#   aubrey   f216  -> 7.20s
#   paulina  f460  -> 15.33s
#   bach     f720  -> 24.00s
#   broken   f975  -> 32.50s
#   south    f1225 -> 40.83s
#   middle   f1480 -> 49.33s
#   north    f1735 -> 57.83s
#   wash     f1995 -> 66.50s
#   jack     f2250 -> 75.00s
#   black    f2505 -> 83.50s
#   jeff     f2760 -> 92.00s
#   close    f2930 -> 97.67s
declare -A SCENES=(
  ["thumb_open.jpg"]=1.60
  ["thumb_aubrey.jpg"]=7.20
  ["thumb_paulina.jpg"]=15.33
  ["thumb_bachelor.jpg"]=24.00
  ["thumb_broken_top.jpg"]=32.50
  ["thumb_south.jpg"]=40.83
  ["thumb_middle.jpg"]=49.33
  ["thumb_north.jpg"]=57.83
  ["thumb_wash.jpg"]=66.50
  ["thumb_jack.jpg"]=75.00
  ["thumb_black.jpg"]=83.50
  ["thumb_jeff.jpg"]=92.00
  ["thumb_close.jpg"]=97.67
)

for name in "${!SCENES[@]}"; do
  ts="${SCENES[$name]}"
  # -ss before -i is fast-seek; accurate enough for JPEG thumbs.
  # Scale down to 720 wide for email payload.
  ffmpeg -y -ss "$ts" -i "$FINAL" \
    -vframes 1 -vf "scale=720:-1:flags=lanczos" -q:v 4 \
    "$OUT/$name" 2>/dev/null
  size=$(du -k "$OUT/$name" | cut -f1)
  echo "  $name @ ${ts}s  (${size} KB)"
done

echo
echo "== Firing send_v1.py =="
python3 "$HERE/send_v1.py"
