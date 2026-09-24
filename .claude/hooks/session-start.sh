#!/usr/bin/env bash
# session-start.sh: make a Claude Code cloud session ready before the first
# prompt runs. Registered as the SessionStart hook in .claude/settings.json.
#
# WHY (2026-09-24): a cloud session booted with no node_modules, no brand fonts
# and no git hooks, although the environment's setup script
# (scripts/cloud-setup.sh) is meant to provide all three. Everything downstream
# broke quietly: the CLAUDE.md session boot (`npx tsx scripts/loop-brief.ts`)
# had no tsx, and with core.hooksPath unset git ran no hooks at all, so commits
# skipped the commit-msg approval gate and pushes skipped the gates-marker
# check. husky only installs .husky/_ during `npm ci`. This hook does not depend
# on the setup script having run.
#
# Remote sessions only. Idempotent: when node_modules matches package-lock.json,
# the hooks are wired and the fonts are registered, it prints nothing and costs
# about a second. Claude Code adds this hook's stdout to the session context,
# so it prints one line at most and sends npm's output to a log file.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

LOG="${TMPDIR:-/tmp}/rr-session-start.log"
# Written after a successful `npm ci` here and in scripts/cloud-setup.sh, so a
# snapshot the setup script already installed is recognised as current.
MARKER=node_modules/.package-lock.sha256
did=()

# 1. Node dependencies. `npm ci` also runs `prepare` (husky), which installs
#    the git hooks. PUPPETEER_SKIP_DOWNLOAD mirrors scripts/cloud-setup.sh.
want="$(sha256sum package-lock.json | cut -d' ' -f1)"
have="$(cat "$MARKER" 2>/dev/null || true)"
if [ "$want" != "$have" ]; then
  t0=$SECONDS
  if PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-audit --no-fund >"$LOG" 2>&1; then
    echo "$want" >"$MARKER"
    did+=("installed node dependencies ($((SECONDS - t0))s)")
  else
    echo "session-start: npm ci FAILED, see $LOG. Run npm ci before tsx, tests or gates."
    exit 0
  fi
fi

# 2. Git hooks. .husky/_ is gitignored and core.hooksPath lives in .git/config,
#    so a restored snapshot can carry node_modules without either.
if [ "$(git config --get core.hooksPath)" != ".husky/_" ] || [ ! -f .husky/_/pre-push ]; then
  if npx --no-install husky >>"$LOG" 2>&1; then
    did+=("installed git hooks")
  else
    did+=("git hook install FAILED, see $LOG")
  fi
fi

# 3. Brand fonts (Amboqia, AzoSans) for headless Chromium renders; the same
#    copy scripts/cloud-setup.sh makes. Count with `grep -c`, not `grep -q`:
#    -q exits on the first match, fc-list takes SIGPIPE, and under pipefail
#    the check reads as "missing" on every run.
FONT_SRC=design_system/ryan-realty/fonts
FONT_DST="$HOME/.local/share/fonts"
if [ -d "$FONT_SRC" ] && [ "$(fc-list 2>/dev/null | grep -ci amboqia)" = "0" ]; then
  mkdir -p "$FONT_DST"
  cp -f "$FONT_SRC"/*.otf "$FONT_SRC"/*.ttf "$FONT_DST"/ 2>/dev/null
  fc-cache -f "$FONT_DST" >/dev/null 2>&1
  did+=("registered brand fonts")
fi

if [ ${#did[@]} -gt 0 ]; then
  msg="${did[0]}"
  for d in "${did[@]:1}"; do msg="$msg; $d"; done
  echo "session-start: $msg."
fi
exit 0
