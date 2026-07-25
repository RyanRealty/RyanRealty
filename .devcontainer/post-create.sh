#!/usr/bin/env bash
# post-create.sh — provision the multi-agent dev box.
#
# Runs once when a Codespace is created (or rebuilt). Two jobs:
#   1. Bring the repo to full working parity with the retired Mac mini
#      (ffmpeg, brand fonts, node deps) — delegated to scripts/cloud-setup.sh.
#   2. Install the coding agents so the LLM is a choice, not a lock-in.
#
# Every agent install is best-effort. One vendor's registry hiccup must not
# leave you without a working box — the summary at the end reports exactly what
# landed, so a partial install is visible rather than silent.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\n\033[1m=== %s\033[0m\n' "$1"; }

# ── 0. secrets ──────────────────────────────────────────────────────────────
# The repo carries 109 environment variables. Adding them as 109 individual
# Codespaces secrets is unmanageable, so a single secret named DOTENV_LOCAL
# holds the whole file and is materialized here.
#
# This also fixes a real portability problem: 41 scripts call
# readFileSync('.env.local') directly and THROW when the file is absent.
# Writing the file makes every one of them work unchanged, rather than
# rewriting 41 call sites.
#
# DOTENV_LOCAL may be raw file contents or base64 (base64 avoids newline
# mangling in the secrets UI — prefer it).
log "secrets"
if [ -n "${DOTENV_LOCAL:-}" ]; then
  if printf '%s' "$DOTENV_LOCAL" | base64 -d >/dev/null 2>&1; then
    printf '%s' "$DOTENV_LOCAL" | base64 -d > "$ROOT/.env.local"
  else
    printf '%s' "$DOTENV_LOCAL" > "$ROOT/.env.local"
  fi
  chmod 600 "$ROOT/.env.local"
  echo "  wrote .env.local ($(grep -c '=' "$ROOT/.env.local" 2>/dev/null || echo 0) variables)"
else
  echo "  DOTENV_LOCAL secret not set — scripts needing .env.local will fail."
  echo "  Generate the value locally with: npm run secrets:pack"
fi

# ── 1. repo parity ──────────────────────────────────────────────────────────
log "repo parity (ffmpeg, fonts, dependencies)"
bash scripts/cloud-setup.sh

# ── 2. coding agents ────────────────────────────────────────────────────────
# Versions verified against the registries 2026-07-25. Installed unpinned so a
# rebuild picks up current releases; pin here if a release ever breaks you.
log "coding agents"

npm_agents=(
  "@anthropic-ai/claude-code"   # claude
  "@openai/codex"               # codex
  "@google/gemini-cli"          # gemini
  "opencode-ai"                 # opencode
)

for pkg in "${npm_agents[@]}"; do
  printf '  installing %s ... ' "$pkg"
  if npm install -g "$pkg" >/dev/null 2>&1; then echo "ok"; else echo "FAILED (non-fatal)"; fi
done

printf '  installing aider-chat (pypi) ... '
if command -v pipx >/dev/null 2>&1; then
  pipx install aider-chat >/dev/null 2>&1 && echo "ok" || echo "FAILED (non-fatal)"
else
  python3 -m pip install --user --quiet aider-chat >/dev/null 2>&1 && echo "ok" || echo "FAILED (non-fatal)"
fi

# ── 3. report ───────────────────────────────────────────────────────────────
log "agents available"
check() {
  if command -v "$1" >/dev/null 2>&1; then
    printf '  \033[32m✓\033[0m %-10s %s\n' "$1" "$($1 --version 2>/dev/null | head -1)"
  else
    printf '  \033[31m✗\033[0m %-10s not installed\n' "$1"
  fi
}
for a in claude codex gemini opencode aider; do check "$a"; done

log "API keys detected"
# Presence only — never print a value.
for k in ANTHROPIC_API_KEY OPENAI_API_KEY XAI_API_KEY GEMINI_API_KEY GOOGLE_API_KEY REPLICATE_API_TOKEN; do
  if [ -n "${!k:-}" ]; then printf '  \033[32m✓\033[0m %s\n' "$k"; else printf '  \033[33m—\033[0m %s (add as a Codespaces secret to use that provider)\n' "$k"; fi
done

log "ready"
cat <<'EOF'
  npm run dev              start the Next dev server on :3000
  npm run ci:gates         full gate chain (175 gates)
  npm run auth:verify      refresh authenticated third-party sessions (SkySlope)
  npm run setup:browsers   install Chromium when a task needs to drive a browser

  Agents share this repo and its CLAUDE.md. Pick per task:
    claude     codex     gemini     opencode     aider
EOF
