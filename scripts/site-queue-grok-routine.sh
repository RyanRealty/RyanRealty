#!/bin/bash
# Site queue grinder — headless Grok on Matt's Mac (Matt 2026-09-09: "I want a
# routine on both"). Twin of the Claude cloud routine
# trig_01JTHasiFzPRDnkTiPzodMPV, which fires every four hours at :05 UTC.
# launchd schedules in LOCAL time, so this one's 02/06/10/14/18/22 local lands
# an hour after each Claude fire during PDT (Claude 00:05Z = 17:05 PDT, Grok
# 18:05 PDT) — never simultaneous, and a worker starts six more times a day.
# The offset drifts when the clocks change; it does not matter, because the
# claim tool is what keeps them apart, not the schedule.
#
# They coordinate through nothing but the claim tool: same table, same caps,
# same optimistic write. A fire that finds three live workers prints one line
# and exits, which costs seconds.
#
# Installed as LaunchAgent com.ryanrealty.site-queue-grok.
# Pause it:   launchctl bootout gui/$(id -u)/com.ryanrealty.site-queue-grok
# Resume it:  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryanrealty.site-queue-grok.plist
# Run it now: bash scripts/site-queue-grok-routine.sh
set -u
cd /Users/matthewryan/RyanRealty || exit 1

GROK=/Users/matthewryan/.grok/bin/grok
LOG=tmp/site-queue-grok-routine.log
mkdir -p tmp

# A checkout that is behind claims work another worker already landed, so the
# fire starts from origin/main. Never reset or force: if the tree is dirty
# (a human mid-edit, another lane's worktree), fetch and carry on from HEAD.
git fetch --quiet origin main 2>>"$LOG"
if [ -z "$(git status --porcelain)" ] && [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
  git merge --ff-only origin/main >>"$LOG" 2>&1
fi

echo "──── $(date '+%Y-%m-%d %H:%M:%S') grok routine start ($(git rev-parse --short HEAD))" >> "$LOG"
"$GROK" -p "$(cat scripts/site-queue-routine-prompt.md)" \
  --permission-mode bypassPermissions \
  --output-format plain >> "$LOG" 2>&1
echo "──── $(date '+%Y-%m-%d %H:%M:%S') grok routine end (exit $?)" >> "$LOG"
