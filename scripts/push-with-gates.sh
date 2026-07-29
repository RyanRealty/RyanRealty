#!/usr/bin/env sh
# push-with-gates.sh — the canonical push path (`npm run push`).
#
# Runs the full local gate chain + production build BEFORE `git push` opens
# the ssh connection to github.com, then stamps <git-dir>/rr-gates-marker so
# .husky/pre-push can verify in milliseconds. Rationale: git advertises refs
# and holds the connection open BEFORE running pre-push, so a long in-hook
# chain idles the connection out and the pack write dies with SIGPIPE
# (exit 141) — observed twice on 2026-07-17.
#
# ISOLATED VERIFICATION (default): the chain + build run against the
# MATERIALIZED HEAD TREE in a persistent detached verify worktree, not the
# shared working tree. On a box running concurrent agent sessions, another
# session's uncommitted/untracked edits used to fail gates here (observed:
# ci:untracked-imports tripped by a sibling session's in-flight file) and
# the marker certified a tree gates never exactly saw. The verify worktree
# checks out exactly the commit being pushed, so:
#   - foreign working-tree state cannot fail or green-wash the chain
#   - the marker certifies precisely the pushed tree
# This is a throwaway/reusable VERIFICATION sandbox, not a development
# worktree — development worktrees are allowed (see AGENTS.md) but must not
# strand work; no code is authored here (same spirit as G46's
# `git archive | tar -x` materialization, just incremental + buildable).
#
# Knobs:
#   PUSH_GATES_IN_PLACE=1     run chain+build in the shared working tree (old behavior)
#   PUSH_GATES_VERIFY_DIR     verify worktree location (default ~/.cache/ryanrealty-gates-verify)
#   PUSH_GATES_REFRESH_DEPS=1 force re-clone of node_modules into the verify tree
#   PUSH_GATES_CLEAN=1        nuke the verify worktree first (disk pressure / corrupt .next)
#   SKIP_LOCAL_GATES=1        (on git push itself) bypass the pre-push marker check
#
# Extra args pass through to git push: `npm run push -- --dry-run`.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
SHA=$(git rev-parse HEAD)

# ---------------------------------------------------------------------------
# run_chain_and_build <dir> — the heavy work, parameterized by tree location.
# Build skip logic (doc-only pushes) is computed against the MAIN repo's
# upstream either way; the build itself runs in <dir>.
# ---------------------------------------------------------------------------
run_chain_and_build() {
  workdir="$1"

  echo "push: full ci:gates static chain (~120 gates) in $workdir…"
  ( cd "$workdir" && npm run ci:gates ) || {
    echo ""
    echo "✗ ci:gates FAILED — push aborted. Fix the failing gate first."
    exit 1
  }
  echo "✓ ci:gates OK"

  # Full ESLint pass (added 2026-07-17). CI's lint-and-build job runs
  # `npm run lint` and NOTHING local did — 179 errors accumulated unseen and
  # GitHub Actions CI was red on every push from Jun 24 to Jul 17 while local
  # hooks stayed green. Zero-error policy; warnings pass.
  echo "push: eslint (matches CI lint-and-build) in $workdir…"
  ( cd "$workdir" && npm run lint ) || {
    echo ""
    echo "✗ eslint FAILED — push aborted. This is the same lint CI runs; fix the errors."
    exit 1
  }
  echo "✓ eslint OK"

  # G47 — production build gate (Turbopack, matches Vercel). Doc/json-only
  # pushes skip it. A "use server" / RSC break passes tsc and ci:gates but
  # fails the Turbopack build Vercel runs, then silently never deploys
  # (see docs/plans/crm-golive-execution-2026-06-25.md).
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    CHANGED=$(git diff --name-only @{u}.."$SHA" 2>/dev/null)
  else
    CHANGED="__force_build__"   # no upstream tracking — build to be safe
  fi

  if [ -z "$CHANGED" ]; then
    echo "push: nothing ahead of upstream — skipping build."
  elif [ "$CHANGED" = "__force_build__" ] || printf '%s\n' "$CHANGED" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|css)$|(^|/)next\.config|(^|/)package\.json|(^|/)tsconfig'; then
    echo "push: production build (Turbopack, matches Vercel) in $workdir…"
    # Next's type-check phase OOMs at Node's default ~4GB heap at this repo's
    # size (SIGABRT mid "Running TypeScript", 2026-07-14). 8GB fits the Mac mini.
    ( cd "$workdir" && NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" npm run build ) || {
      echo ""
      echo "✗ next build FAILED — this commit would ERROR on Vercel and silently never deploy."
      exit 1
    }
    echo "✓ next build OK"
  else
    echo "push: only non-buildable files changed — skipping build."
  fi
}

# ---------------------------------------------------------------------------
# do_push — git push with EXPLICIT exit-code propagation, loud either way.
# The final push must not rely on `set -e` falling off the end of the script:
# a signal trap (INT/TERM) fired mid-push resumes execution past the last
# command and exits 0, and any future line added after a bare `git push`
# silently absorbs its status. A rejected push reported as a green
# `npm run push` (observed 2026-07-29, non-fast-forward on main) means the
# commit never deploys while every log line says gates passed — so the
# verdict line and exit code are stated explicitly, never inherited.
# ---------------------------------------------------------------------------
do_push() {
  set +e
  git push "$@"
  push_rc=$?
  set -e
  if [ "$push_rc" -ne 0 ]; then
    echo "" >&2
    echo "✗ git push FAILED (exit $push_rc) — NOTHING landed on the remote." >&2
    echo "  Non-fast-forward? git fetch + rebase onto the remote branch, then re-run: npm run push" >&2
    exit "$push_rc"
  fi
  echo "✓ git push OK"
}

# ---------------------------------------------------------------------------
# In-place fallback (old behavior): chain sees the shared working tree.
# ---------------------------------------------------------------------------
if [ "$PUSH_GATES_IN_PLACE" = "1" ]; then
  echo "push: PUSH_GATES_IN_PLACE=1 — verifying the shared working tree (foreign session state CAN fail gates here)."
  run_chain_and_build "$REPO_ROOT"
  node scripts/stamp-gates-marker.mjs
  do_push "$@"
  exit 0
fi

# ---------------------------------------------------------------------------
# Isolated verification (default).
# ---------------------------------------------------------------------------
VERIFY_DIR="${PUSH_GATES_VERIFY_DIR:-$HOME/.cache/ryanrealty-gates-verify}"
LOCK="$VERIFY_DIR.lock"

# One verification at a time — two sessions sharing the verify tree would
# corrupt each other. mkdir is the atomic primitive; stale locks (dead pid)
# are stolen, live ones waited on for up to 30 min.
tries=0
until mkdir "$LOCK" 2>/dev/null; do
  otherpid=$(cat "$LOCK/pid" 2>/dev/null || echo "")
  if [ -n "$otherpid" ] && ! kill -0 "$otherpid" 2>/dev/null; then
    echo "push: stale verify lock (pid $otherpid is gone) — taking over."
    rm -rf "$LOCK"
    continue
  fi
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "✗ another push verification (pid ${otherpid:-unknown}) has held the lock 30+ min — aborting. Remove $LOCK if it is wedged."
    exit 4
  fi
  [ "$tries" -eq 1 ] && echo "push: another push verification is running (pid ${otherpid:-unknown}) — waiting…"
  sleep 30
done
echo "$$" > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM

[ "$PUSH_GATES_CLEAN" = "1" ] && { echo "push: PUSH_GATES_CLEAN=1 — removing verify worktree."; git worktree remove --force "$VERIFY_DIR" 2>/dev/null || rm -rf "$VERIFY_DIR"; }

git worktree prune
if [ ! -f "$VERIFY_DIR/.git" ]; then
  # First run (or post-clean): a linked worktree's .git is a FILE pointer.
  rm -rf "$VERIFY_DIR"
  echo "push: creating verify worktree at $VERIFY_DIR (one-time ~2.4GB checkout)…"
  git worktree add --detach "$VERIFY_DIR" "$SHA"
else
  git -C "$VERIFY_DIR" checkout -f --detach "$SHA"
  # Deterministic tree: drop everything the checkout didn't put there, keeping
  # the expensive persistent state (deps, build cache, env).
  git -C "$VERIFY_DIR" clean -fdx -e node_modules -e .next -e .env.local >/dev/null
fi

# Build-time env (untracked config, not code state — same values Vercel holds).
[ -f "$REPO_ROOT/.env.local" ] && cp -f "$REPO_ROOT/.env.local" "$VERIFY_DIR/.env.local"

# node_modules: APFS copy-on-write clone from the main checkout (a SYMLINK
# breaks the Turbopack build — see memory reference_worktree_node_modules_turbopack).
# Re-cloned only when the verify tree's package-lock.json stops matching the
# lockfile the current clone was made for.
LOCK_SNAPSHOT="$VERIFY_DIR/node_modules/.rr-lock-snapshot"
if [ "$PUSH_GATES_REFRESH_DEPS" = "1" ] || [ ! -d "$VERIFY_DIR/node_modules" ] || ! cmp -s "$VERIFY_DIR/package-lock.json" "$LOCK_SNAPSHOT"; then
  echo "push: cloning node_modules into verify tree (APFS clone)…"
  rm -rf "$VERIFY_DIR/node_modules"
  cp -Rc "$REPO_ROOT/node_modules" "$VERIFY_DIR/node_modules"
  cp -f "$VERIFY_DIR/package-lock.json" "$LOCK_SNAPSHOT"
fi

echo "push: verifying materialized tree of $SHA (foreign working-tree state cannot affect this run)…"
run_chain_and_build "$VERIFY_DIR"

# Certify exactly the verified commit's tree — NOT whatever HEAD is by now.
node scripts/stamp-gates-marker.mjs --commit "$SHA"

CUR=$(git rev-parse HEAD)
if [ "$CUR" != "$SHA" ]; then
  echo ""
  echo "✗ HEAD moved during verification ($SHA → $CUR) — another session committed."
  echo "  The verified tree is stamped; re-run npm run push to verify + push the new HEAD."
  exit 3
fi

do_push "$@"
