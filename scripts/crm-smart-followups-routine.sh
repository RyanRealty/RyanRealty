#!/bin/bash
# Daily smart-followups routine — runs headless Claude Code on Matt's plan
# (no API credits). Installed as LaunchAgent com.ryanrealty.crm-smart-followups.
set -u
cd /Users/matthewryan/RyanRealty
LOG=tmp/smart-followups-routine.log
mkdir -p tmp
echo "──── $(date '+%Y-%m-%d %H:%M:%S') routine start" >> "$LOG"
/Users/matthewryan/.local/bin/claude -p "$(cat scripts/crm-smart-followups-prompt.md)" \
  --dangerously-skip-permissions --output-format text >> "$LOG" 2>&1
echo "──── $(date '+%Y-%m-%d %H:%M:%S') routine end (exit $?)" >> "$LOG"
