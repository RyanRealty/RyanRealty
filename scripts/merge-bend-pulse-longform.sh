#!/usr/bin/env bash
# Merge Bend Policy Pulse parts 1–3 into one long-form MP4 for YouTube + blog embed.
# Same codecs across parts → stream copy (fast, no re-encode).
#
#   ./scripts/merge-bend-pulse-longform.sh
#
# Output: listing_video_v4/out/bend_pulse/bend_pulse_full.mp4
# After upload: set youtube.longForm in out/blog/bend-policy-pulse-electrification-2026/metadata.json

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/listing_video_v4/out/bend_pulse"
P1="$OUT_DIR/bend_pulse_part1.mp4"
P2="$OUT_DIR/bend_pulse_part2.mp4"
P3="$OUT_DIR/bend_pulse_part3.mp4"
DEST="$OUT_DIR/bend_pulse_full.mp4"

for f in "$P1" "$P2" "$P3"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing: $f (render parts first)" >&2
    exit 1
  fi
done

LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

{
  echo "file '$P1'"
  echo "file '$P2'"
  echo "file '$P3'"
} >"$LIST"

echo "Concatenating → $DEST"
ffmpeg -y -f concat -safe 0 -i "$LIST" -c copy "$DEST"

echo "Done. ffprobe duration:"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DEST"
