#!/usr/bin/env bash
# install-cleanup-launchd.sh — one-time load of the Mini hourly cleanup job.
#
# Matt runs this once on the Mac Mini from the primary checkout:
#
#   bash scripts/install-cleanup-launchd.sh
#
# It copies scripts/launchd/com.ryanrealty.cleanup-merged-worktrees.plist into
# ~/Library/LaunchAgents with this checkout's absolute paths and bootstraps
# the agent. Hooks and `npm run ship` already call the same script; launchd
# is what cleans leftovers when no session is pulling main.
#
# Unload:
#   launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ryanrealty.cleanup-merged-worktrees.plist
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/cleanup-merged-worktrees.sh"
TEMPLATE="$ROOT/scripts/launchd/com.ryanrealty.cleanup-merged-worktrees.plist"
LABEL=com.ryanrealty.cleanup-merged-worktrees
DEST_DIR="${HOME}/Library/LaunchAgents"
DEST="$DEST_DIR/${LABEL}.plist"

if [ ! -f "$SCRIPT" ]; then
  echo "install-cleanup-launchd: missing $SCRIPT" >&2
  exit 1
fi
if [ ! -f "$TEMPLATE" ]; then
  echo "install-cleanup-launchd: missing $TEMPLATE" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
# BSD sed: -i requires a suffix. Write via temp so we stay portable.
tmp="${DEST}.tmp"
sed -e "s|__RR_CLEANUP_SCRIPT__|${SCRIPT}|g" \
    -e "s|__RR_CLEANUP_REPO__|${ROOT}|g" \
    "$TEMPLATE" > "$tmp"
mv "$tmp" "$DEST"

uid="$(id -u)"
domain="gui/${uid}"
# Prefer modern bootstrap; fall back to load for older macOS.
if launchctl print "${domain}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "$domain" "$DEST" >/dev/null 2>&1 || true
fi
if launchctl bootstrap "$domain" "$DEST" 2>/dev/null; then
  echo "install-cleanup-launchd: loaded ${DEST} (hourly)"
elif launchctl load -w "$DEST" 2>/dev/null; then
  echo "install-cleanup-launchd: loaded ${DEST} via launchctl load (hourly)"
else
  echo "install-cleanup-launchd: wrote ${DEST}. Load it on the Mini with:"
  echo "  launchctl bootstrap gui/\$(id -u) ${DEST}"
  exit 0
fi

echo "install-cleanup-launchd: log → /tmp/rr-cleanup-merged-worktrees.log"
echo "install-cleanup-launchd: dry-run now: $SCRIPT --dry-run"
