#!/usr/bin/env bash
# cloud-setup.sh — bootstrap a Claude Code cloud environment (or any Linux box)
# to full parity with what the Mac mini used to do.
#
# Paste this into the "Setup script" field of the cloud environment at
# claude.ai/code, or run it directly on a fresh VM:
#
#     bash scripts/cloud-setup.sh
#
# BUDGET: the cloud environment allows roughly five minutes to build the
# environment cache before the session is killed. Everything here is either
# fast or backgrounded. Independent installs run in parallel and are joined
# with `wait`; the heaviest step (Playwright's Chromium) is optional and
# skipped unless CLOUD_SETUP_BROWSERS=1, because most sessions never drive a
# browser.
#
# MID-SESSION GAP (found 2026-09-15): `npm run setup:browsers` is just
# `npx playwright install --with-deps chromium` — it does NOT copy the brand
# fonts, because that only happens inside this script. A session that boots
# from `npm ci` + `npm run setup:browsers` alone (skipping this script
# entirely) never gets Amboqia/AzoSans registered, and `fc-list` proves it:
# `grep -ic amboqia` comes back 0. Chromium doesn't need the fonts to launch,
# so nothing fails loudly — a taste-pass render just looks wrong later. The
# one-command fix for a lane already mid-session (node_modules present,
# `npm ci` not worth repeating) is CLOUD_SETUP_SKIP_DEPS=1, which skips the
# apt and npm steps and leaves fonts + the optional browser install + the
# parity check:
#
#     CLOUD_SETUP_SKIP_DEPS=1 CLOUD_SETUP_BROWSERS=1 bash scripts/cloud-setup.sh
#
# That assumes fontconfig is already on the box (true for the environment's
# own snapshot, since the full run below installs it) — a session that has
# never run the full script needs that once first.
#
# NETWORK: the environment's access level must reach the package registries.
# "Trusted" covers npm/PyPI/apt. Driving the live site additionally needs
# ryan-realty.com on a Custom allowlist — driving the VM's own dev server on
# localhost needs nothing.
set -uo pipefail

log() { printf '\n=== %s\n' "$1"; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── system packages ─────────────────────────────────────────────────────────
# ffmpeg is required by the video pipeline (Remotion post-mix, whisper align).
# fontconfig lets the brand fonts register for headless Chromium text render.
# Skippable with CLOUD_SETUP_SKIP_DEPS=1 (mid-session fonts+browser lane —
# see MID-SESSION GAP above); the fast path assumes a prior full run already
# put these on the box.
log "system packages (ffmpeg, fontconfig)"
if [ "${CLOUD_SETUP_SKIP_DEPS:-0}" = "1" ]; then
  echo "  skipped (CLOUD_SETUP_SKIP_DEPS=1)"
else
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      ffmpeg fontconfig >/dev/null 2>&1 || echo "  ! apt install failed (non-fatal)"
  fi
fi
command -v ffmpeg >/dev/null 2>&1 && echo "  ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3)" || echo "  ! ffmpeg missing"

# ── brand fonts ─────────────────────────────────────────────────────────────
# Shipped in-repo, so this is a copy, not a download. Amboqia is the display
# and caption face; a render without it is a ship-blocker (CLAUDE.md captions
# rule 6), so failing loudly here is correct.
log "brand fonts"
FONT_SRC="$ROOT/design_system/ryan-realty/fonts"
FONT_DST="$HOME/.local/share/fonts"
if [ -d "$FONT_SRC" ]; then
  mkdir -p "$FONT_DST"
  cp -f "$FONT_SRC"/*.otf "$FONT_SRC"/*.ttf "$FONT_DST"/ 2>/dev/null || true
  fc-cache -f "$FONT_DST" >/dev/null 2>&1 || true
  echo "  installed: $(ls -1 "$FONT_DST" 2>/dev/null | wc -l | tr -d ' ') font files"
else
  echo "  ! $FONT_SRC not found — video renders will fall back to system fonts"
fi

# ── node dependencies ───────────────────────────────────────────────────────
# PUPPETEER_SKIP_DOWNLOAD mirrors the install:macos script: we manage browsers
# explicitly below rather than letting every package pull its own copy.
# Skippable with CLOUD_SETUP_SKIP_DEPS=1 — a session already mid-way through
# work has node_modules; paying `npm ci` again just to reach the font/browser
# steps below defeats the point of a one-command fix.
log "node dependencies"
if [ "${CLOUD_SETUP_SKIP_DEPS:-0}" = "1" ]; then
  echo "  skipped (CLOUD_SETUP_SKIP_DEPS=1)"
else
  export PUPPETEER_SKIP_DOWNLOAD=1
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund 2>&1 | tail -3
  else
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
fi

# ── browsers (optional, heaviest step) ──────────────────────────────────────
log "playwright chromium"
if [ "${CLOUD_SETUP_BROWSERS:-0}" = "1" ]; then
  npx playwright install --with-deps chromium 2>&1 | tail -3
else
  echo "  skipped (set CLOUD_SETUP_BROWSERS=1 to include, or run: npm run setup:browsers)"
fi

# ── verification ────────────────────────────────────────────────────────────
log "parity check"
node scripts/check-vm-parity.mjs || echo "  ! parity gate reported new violations"

log "ready"
echo "Node        $(node --version)"
echo "npm         $(npm --version)"
command -v ffmpeg >/dev/null 2>&1 && echo "ffmpeg      present" || echo "ffmpeg      MISSING"
echo
echo "Next:"
echo "  CLOUD_SETUP_SKIP_DEPS=1 CLOUD_SETUP_BROWSERS=1 bash scripts/cloud-setup.sh"
echo "                            # mid-session: browser AND fonts in one command"
echo "                            # (npm run setup:browsers alone gets you the browser, not the fonts)"
echo "  npm run auth:verify      # refresh authenticated third-party sessions"
echo "  npm run ci:gates         # full gate chain"
