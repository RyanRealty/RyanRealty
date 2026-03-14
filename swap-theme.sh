#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  swap-theme.sh — One-command shadcn/ui preset theme swap
#
#  Usage:
#    ./swap-theme.sh <preset-code>              # swap theme, keep brand blue on --primary and --chart-5 (DEFAULT)
#    ./swap-theme.sh <preset-code> --full-swap   # swap EVERYTHING including brand colors
# ============================================================

PRESET_CODE="${1:?Error: Provide a preset code. Usage: ./swap-theme.sh <preset-code> [--full-swap]}"
MODE="${2:-}"

# --- Locate main CSS file ---
CSS_FILE=""
for f in app/globals.css src/index.css src/app.css styles/globals.css src/styles/globals.css; do
  [ -f "$f" ] && CSS_FILE="$f" && break
done

if [ -z "$CSS_FILE" ]; then
  echo "ERROR: Could not find main CSS file."
  exit 1
fi
echo "Found CSS file: $CSS_FILE"

# --- Extract brand colors (default: always keep them) ---
BRAND_PRIMARY=""
BRAND_PRIMARY_FG=""
BRAND_CHART5=""

if [ "$MODE" != "--full-swap" ]; then
  echo "Extracting current brand colors..."
  BRAND_PRIMARY=$(grep -oP '(?<=--primary:\s).*?(?=;)' "$CSS_FILE" | head -1)
  BRAND_PRIMARY_FG=$(grep -oP '(?<=--primary-foreground:\s).*?(?=;)' "$CSS_FILE" | head -1)
  BRAND_CHART5=$(grep -oP '(?<=--chart-5:\s).*?(?=;)' "$CSS_FILE" | head -1)
  echo "  --primary: $BRAND_PRIMARY"
  echo "  --primary-foreground: $BRAND_PRIMARY_FG"
  echo "  --chart-5: $BRAND_CHART5"
fi

# --- Backup ---
BACKUP="${CSS_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CSS_FILE" "$BACKUP"
echo "Backed up to: $BACKUP"

# --- Apply new preset ---
echo "Applying preset: $PRESET_CODE ..."
npx shadcn@latest init --preset "$PRESET_CODE" --force

# --- Restore brand colors (unless --full-swap) ---
if [ "$MODE" != "--full-swap" ] && [ -n "$BRAND_PRIMARY" ]; then
  echo "Restoring brand colors..."
  sed -i "s|--primary: .*\;|--primary: ${BRAND_PRIMARY};|g" "$CSS_FILE"
  sed -i "s|--primary-foreground: .*\;|--primary-foreground: ${BRAND_PRIMARY_FG};|g" "$CSS_FILE"
  sed -i "s|--chart-5: .*\;|--chart-5: ${BRAND_CHART5};|g" "$CSS_FILE"
  echo "Brand colors restored."
fi

# --- Check for component updates ---
echo "Checking for component updates..."
npx shadcn@latest diff 2>/dev/null || true

echo ""
echo "============================================"
echo "  Theme swapped to preset: $PRESET_CODE"
if [ "$MODE" != "--full-swap" ]; then
  echo "  Brand blue preserved on --primary and --chart-5"
fi
echo "  CSS backup: $BACKUP"
echo "  Run 'npm run dev' to preview."
echo "============================================"
