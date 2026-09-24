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
# the hooks are wired, the fonts are registered and Playwright's pinned browser
# is present, it prints nothing and costs well under a second. Claude Code adds
# this hook's stdout to the session context, so it prints one line at most and
# sends npm's output to a log file.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

LOG="${TMPDIR:-/tmp}/rr-session-start.log"
# Written after a successful `npm ci` here and in scripts/cloud-setup.sh, so a
# snapshot the setup script already installed is recognised as current.
MARKER=node_modules/.package-lock.sha256
notes=()

# 1. Node dependencies. `npm ci` also runs `prepare` (husky), which installs
#    the git hooks. PUPPETEER_SKIP_DOWNLOAD mirrors scripts/cloud-setup.sh.
want="$(sha256sum package-lock.json | cut -d' ' -f1)"
have="$(cat "$MARKER" 2>/dev/null || true)"
if [ "$want" != "$have" ]; then
  t0=$SECONDS
  if PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-audit --no-fund >"$LOG" 2>&1; then
    echo "$want" >"$MARKER"
    notes+=("installed node dependencies ($((SECONDS - t0))s)")
  else
    echo "session-start: npm ci FAILED, see $LOG. Run npm ci before tsx, tests or gates."
    exit 0
  fi
fi

# 2. Git hooks. .husky/_ is gitignored and core.hooksPath lives in .git/config,
#    so a restored snapshot can carry node_modules without either.
if [ "$(git config --get core.hooksPath)" != ".husky/_" ] || [ ! -f .husky/_/pre-push ]; then
  if npx --no-install husky >>"$LOG" 2>&1; then
    notes+=("installed git hooks")
  else
    notes+=("git hook install FAILED, see $LOG")
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
  notes+=("registered brand fonts")
fi

# 4. Playwright's pinned browser. The image's browser cache can lag the repo's
#    @playwright/test pin (2026-09-24: the pin wants build 1208, the image has
#    1194), and then a bare chromium.launch() fails. Say so here instead of
#    letting the first screenshot script find out; do not download mid-session.
PW_JSON=node_modules/playwright-core/browsers.json
PW_DIR="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
if [ -f "$PW_JSON" ]; then
  rev="$(node -p "require('./$PW_JSON').browsers.find((b) => b.name === 'chromium-headless-shell').revision" 2>/dev/null)"
  if [ -n "$rev" ] && [ ! -d "$PW_DIR/chromium_headless_shell-$rev" ]; then
    if [ -e "$PW_DIR/chromium" ]; then
      fix="launch with executablePath: '$PW_DIR/chromium'"
    else
      fix="run npm run setup:browsers"
    fi
    notes+=("Playwright's pinned Chromium $rev is not installed, so a bare chromium.launch() fails: $fix (docs/CLOUD_ENVIRONMENT_SETUP.md section 3)")
  fi
fi

if [ ${#notes[@]} -gt 0 ]; then
  msg="${notes[0]}"
  for n in "${notes[@]:1}"; do msg="$msg; $n"; done
  echo "session-start: $msg."
fi
exit 0
