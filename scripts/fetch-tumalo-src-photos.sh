#!/usr/bin/env bash
# fetch-tumalo-src-photos.sh — populate /tmp/tumalo-src/ with the listing
# photos that scripts/build_single_image_posts.py expects.
#
# Source: MLS PhotoURLs from 19496 Tumalo Reservoir Rd (current Active).
# Run once before ig-single-post on a fresh checkout.

set -euo pipefail

DEST=/tmp/tumalo-src
mkdir -p "$DEST"

# Parallel arrays — name + URL pairs (POSIX-friendly, no associative arrays)
NAMES=(
  HERO_PRIMARY.jpg
  AERIAL_DUSK_1.jpg
  AERIAL_DUSK_2.jpg
  AERIAL_1.jpg
  AERIAL_2.jpg
  GROUNDS_1.jpg
  GROUNDS_2.jpg
  LIVING.jpg
  KITCHEN.jpg
  PRIMARY_BR.jpg
)
URLS=(
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175825195222000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260307035352655634000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260307035353837808000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175719779563000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175720531554000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175744600559000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175746136817000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175725529629000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175728975287000000-o.jpg"
  "https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260304175741090616000000-o.jpg"
)

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  url="${URLS[$i]}"
  out="$DEST/$name"
  if [ -f "$out" ] && [ "$(wc -c < "$out" | tr -d ' ')" -gt 1000 ]; then
    echo "  cached: $name"
    continue
  fi
  echo "  fetching: $name"
  curl -sSL -o "$out" "$url"
done

echo "✓ /tmp/tumalo-src/ populated ($(ls "$DEST" | wc -l | tr -d ' ') files)"
