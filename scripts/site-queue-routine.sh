#!/bin/bash
# Site queue grinder — headless on Matt's Mac, with a BUILDER CHAIN.
#
# Matt 2026-09-12: "we need alternatives for the grok build session, it can use
# grok build, or this cursor session, or if need be the claude session" and
# "i want to avoid apis". So one fire tries, in order, each builder that runs
# on a SUBSCRIPTION CLI already logged in on this machine, and moves to the
# next only when the CLI itself is unavailable (missing, not logged in, 402 /
# quota). Every API key is stripped before any CLI starts, so a fire can never
# bill console.x.ai, the Anthropic API, or a Cursor API key by falling back.
#
#   1. grok   — ~/.grok/bin/grok, builds as grok-4.5 (grok-4.6 is the judge)
#   2. cursor — cursor-agent -p (Cursor subscription; needs `cursor-agent login`
#               once, a browser step only Matt can do; skipped until then)
#   3. claude — claude -p, builds as opus so sonnet stays the round judge
#
# The judge is a separate chain (scripts/taste-evaluate.ts): it starts at the
# model that scored the current taste-table.json and never the builder's own
# family. The builder passes `--builder <model>` so that holds.
#
# Coordination with the Claude cloud routine and any live Cursor session is the
# claim tool alone (scripts/site-queue-status.ts): same table, same caps. A fire
# that finds the fleet full or the queue empty prints one line and exits in
# seconds, BEFORE any CLI boots.
#
# Installed as LaunchAgent com.ryanrealty.site-queue (~/Library/LaunchAgents).
#   Pause:   launchctl bootout gui/$(id -u)/com.ryanrealty.site-queue
#   Resume:  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryanrealty.site-queue.plist
#   Now:     bash scripts/site-queue-routine.sh            (full chain)
#            bash scripts/site-queue-routine.sh --builders claude
#            SITE_QUEUE_BUILDERS=cursor,claude bash scripts/site-queue-routine.sh
set -u
cd /Users/matthewryan/RyanRealty || exit 1

BUILDERS="${SITE_QUEUE_BUILDERS:-grok,cursor,claude}"
while [ $# -gt 0 ]; do
  case "$1" in
    --builders) BUILDERS="$2"; shift 2 ;;
    --builders=*) BUILDERS="${1#--builders=}"; shift ;;
    *) echo "site-queue-routine: unknown arg $1" >&2; exit 2 ;;
  esac
done

GROK=/Users/matthewryan/.grok/bin/grok
CURSOR_AGENT="$(command -v cursor-agent || echo /Users/matthewryan/.local/bin/cursor-agent)"
CLAUDE="$(command -v claude || echo /Users/matthewryan/.local/bin/claude)"
LOG=tmp/site-queue-routine.log
PROMPT_FILE=scripts/site-queue-routine-prompt.md
mkdir -p tmp
export HOME="${HOME:-/Users/matthewryan}"
export PATH="$HOME/.local/bin:$HOME/.grok/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Subscriptions only (Matt 2026-09-12). Each CLI falls back to its API key when
# no session is active — strip them all so a launchd fire cannot silently bill.
unset XAI_API_KEY ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CURSOR_API_KEY

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# A checkout that is behind claims work another worker already landed, so the
# fire starts from origin/main. Never reset or force: if the tree is dirty
# (a human mid-edit, another lane's worktree), fetch and carry on from HEAD.
git fetch --quiet origin main 2>>"$LOG"
if [ -z "$(git status --porcelain)" ] && [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
  git merge --ff-only origin/main >>"$LOG" 2>&1
fi
log "──── routine start ($(git rev-parse --short HEAD)) builders=$BUILDERS"

# STEP 0 — the cheapest check, in bash, before any model boots. The queue tool
# is the one source of truth for open items and live workers.
STATUS_JSON="$(npx tsx scripts/site-queue-status.ts --json 2>>"$LOG")"
if [ -z "$STATUS_JSON" ]; then
  log "site-queue-status --json returned nothing (env? Supabase?) — fire ends"
  exit 0
fi
GATE="$(printf '%s' "$STATUS_JSON" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const j = JSON.parse(s.slice(s.indexOf("{")))
    const open = (j.items ?? []).filter((i) => i.state === "open" && i.eligible !== false).length
    const live = Number(j.liveWorkers ?? 0), max = Number(j.maxWorkers ?? 3)
    if (live >= max) return console.log(`STOP fleet full (${live}/${max} live: ${(j.items ?? []).filter((i) => i.state === "in_progress" && !i.stale).map((i) => i.owner).join(", ")})`)
    if (open === 0) return console.log("STOP queue empty or fully blocked")
    console.log(`GO ${open} open, ${live}/${max} live`)
  })' 2>>"$LOG")"
log "$GATE"
case "$GATE" in STOP*) exit 0 ;; esac

PROMPT="$(cat "$PROMPT_FILE")"
STAMP="$(date '+%Y-%m-%d-%H')"

# Output that means "this CLI could not run at all". Checked only when the run
# ended fast or non-zero, so a long real session that merely mentions a 402 in
# its own log does not get re-run by the next builder.
UNAVAILABLE_RE='402|Payment Required|usage balance|balance exhausted|Authentication required|not logged in|Please run .*login|login first|rate limit|quota|usage limit|hit your limit|ENOENT|command not found'

run_builder() { # name model owner-prefix cmd...
  local name="$1" model="$2" owner="$3"; shift 3
  local t0 out rc dt
  local fire_prompt="THIS FIRE'S BUILDER: ${name} (${model}). Your owner name is \`${owner}-${STAMP}\`. When you run scripts/taste-evaluate.ts pass \`--builder ${model}\`. Never set or export an API key; the CLIs here run on subscriptions.

${PROMPT}"
  log "builder ${name} (${model}) start"
  t0=$(date +%s)
  out="$("$@" "$fire_prompt" 2>&1)"; rc=$?
  dt=$(( $(date +%s) - t0 ))
  printf '%s\n' "$out" >> "$LOG"
  log "builder ${name} end (exit ${rc}, ${dt}s)"
  if { [ "$rc" -ne 0 ] || [ "$dt" -lt 180 ]; } && printf '%s' "$out" | grep -Eiq "$UNAVAILABLE_RE"; then
    log "builder ${name} unavailable — $(printf '%s' "$out" | grep -Eio "$UNAVAILABLE_RE" | head -n 1) — next builder"
    return 1
  fi
  return 0
}

IFS=',' read -r -a CHAIN <<< "$BUILDERS"
for b in "${CHAIN[@]}"; do
  case "$b" in
    grok)
      [ -x "$GROK" ] || { log "builder grok: CLI missing at $GROK — next builder"; continue; }
      run_builder grok grok-4.5 grok-4.5 \
        "$GROK" --cwd /Users/matthewryan/RyanRealty -m grok-4.5 --permission-mode bypassPermissions --output-format plain -p && exit 0
      ;;
    cursor)
      [ -x "$CURSOR_AGENT" ] || { log "builder cursor: cursor-agent missing — next builder"; continue; }
      run_builder cursor cursor-agent cursor-agent \
        "$CURSOR_AGENT" -p --trust --force --output-format text && exit 0
      ;;
    claude)
      [ -x "$CLAUDE" ] || { log "builder claude: CLI missing — next builder"; continue; }
      run_builder claude claude-opus-5 claude-opus \
        "$CLAUDE" --model opus --dangerously-skip-permissions --output-format text -p && exit 0
      ;;
    *) log "builder $b: unknown — skipped" ;;
  esac
done
log "──── every builder unavailable (${BUILDERS}); fire ends — nothing claimed"
exit 1
