#!/usr/bin/env bash
# Design-system compliance checker.
# Scans .tsx files for banned Tailwind classes and legacy CSS variables.
# Run: npm run lint:design-tokens
# Exit code 1 if violations found, 0 if clean.

set -euo pipefail

ERRORS=0

echo "Checking design-system compliance..."

# 1. Tailwind color classes (bg-zinc-*, text-gray-*, border-emerald-*, etc.)
COLORS=$(grep -rEn '\b(bg|text|border|ring|divide|from|to|via)-(zinc|gray|slate|stone|neutral|emerald|green|red|amber|yellow|blue|rose|violet|purple|pink|orange|teal|cyan|sky|lime|fuchsia|indigo)-[0-9]' app/ components/ --include='*.tsx' 2>/dev/null || true)
if [ -n "$COLORS" ]; then
  echo ""
  echo "ERROR: Tailwind color classes found (use CSS variables instead):"
  echo "$COLORS"
  ERRORS=$((ERRORS + 1))
fi

# 2. Tailwind shadow classes (shadow-sm, shadow-md, shadow-lg, shadow-xl, shadow-2xl)
SHADOWS=$(grep -rEn '\bshadow-(sm|md|lg|xl|2xl)\b' app/ components/ --include='*.tsx' 2>/dev/null | grep -v 'shadow-\[var(' || true)
if [ -n "$SHADOWS" ]; then
  echo ""
  echo "ERROR: Tailwind shadow classes found (use CSS variable shadow tokens instead):"
  echo "$SHADOWS"
  ERRORS=$((ERRORS + 1))
fi

# 3. Tailwind rounded classes (rounded-sm, -md, -lg, -xl, -2xl, -3xl)
ROUNDED=$(grep -rEn '\brounded-(sm|md|lg|xl|2xl|3xl)\b' app/ components/ --include='*.tsx' 2>/dev/null | grep -v 'rounded-\[var(' || true)
if [ -n "$ROUNDED" ]; then
  echo ""
  echo "ERROR: Tailwind rounded classes found (use CSS variable radius tokens instead):"
  echo "$ROUNDED"
  ERRORS=$((ERRORS + 1))
fi

# 4. Legacy CSS variable aliases (--brand-navy, --brand-cream, --accent, --brand-primary)
LEGACY=$(grep -rEn 'var\(--(brand-navy|brand-cream|brand-primary)\b' app/ components/ --include='*.tsx' 2>/dev/null || true)
# Also check for --accent (but not --color-cta which is correct)
ACCENT=$(grep -rEn 'var\(--accent\)' app/ components/ --include='*.tsx' 2>/dev/null || true)
LEGACY_ALL="${LEGACY}${ACCENT}"
if [ -n "$LEGACY_ALL" ]; then
  echo ""
  echo "ERROR: Legacy CSS variable aliases found (use semantic tokens instead):"
  echo "$LEGACY_ALL"
  ERRORS=$((ERRORS + 1))
fi

# 5. Hardcoded hex colors in className attributes
HEX=$(grep -rEn '(bg|text|border)-\[#[0-9a-fA-F]' app/ components/ --include='*.tsx' 2>/dev/null || true)
if [ -n "$HEX" ]; then
  echo ""
  echo "ERROR: Hardcoded hex colors found (use CSS variables instead):"
  echo "$HEX"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Found $ERRORS design-system violation categories. Fix them before committing."
  exit 1
else
  echo "All clear — no design-system violations found."
  exit 0
fi
