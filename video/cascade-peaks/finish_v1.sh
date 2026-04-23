#!/usr/bin/env bash
# Post-render pipeline for Cascade Peaks v1:
#   1. Compress MP4 for IG/email (target <25MB)
#   2. Extract 13 scene thumbnails
#   3. Fire send_v1.py
# Run this after cascade_peaks_v1_raw.mp4 is complete.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
FINAL="$OUT/cascade_peaks_v1.mp4"
RAW=""
for candidate in cascade_peaks_v1_raw.mp4 cascade_peaks_raw.mp4; do
  if [ -f "$OUT/$candidate" ]; then RAW="$OUT/$candidate"; break; fi
done
[ -n "$RAW" ] || {
  echo "Missing raw MP4 in $OUT (expected cascade_peaks_raw.mp4 from npm run build, or cascade_peaks_v1_raw.mp4)"
  exit 1
}

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
# FPS=30, scene midpoints (in seconds) — keep in sync with config.ts
# (OPENING_CARD_SEC, AUBREY_PAN_SEC, PER_PEAK_SEC, CLOSING_CARD_SEC).
declare -A SCENES=(
  ["thumb_open.jpg"]=1.60
  ["thumb_aubrey.jpg"]=10.70
  ["thumb_paulina.jpg"]=23.20
  ["thumb_bachelor.jpg"]=33.20
  ["thumb_broken_top.jpg"]=43.20
  ["thumb_south.jpg"]=53.20
  ["thumb_middle.jpg"]=63.20
  ["thumb_north.jpg"]=73.20
  ["thumb_wash.jpg"]=83.20
  ["thumb_jack.jpg"]=93.20
  ["thumb_black.jpg"]=103.20
  ["thumb_jeff.jpg"]=113.20
  ["thumb_close.jpg"]=119.80
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
