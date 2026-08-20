#!/usr/bin/env sh
# push-with-gates.sh — the canonical push path (`npm run push`).
#
# Runs the local gate chain + eslint BEFORE `git push` opens the ssh
# connection to github.com, then stamps <git-dir>/rr-gates-marker so
# .husky/pre-push can verify in milliseconds. Rationale: git advertises refs
# and holds the connection open BEFORE running pre-push, so a long in-hook
# chain idles the connection out and the pack write dies with SIGPIPE
# (exit 141) — observed twice on 2026-07-17.
#
# Full local `next build` (SSG of hundreds of pages against live Supabase) is
# OFF by default. Vercel owns production generate. G46 `ci:commit-compiles`
# typechecks the committed tree; a prerender throw on a route we did not
# locally generate fails on Vercel and `deploy:verify` must go red (15m).
# PUSH_FULL_GENERATE=1 restores the old local SSG. Do not point package.json
# `"build"` at a compile-only Next flag — that output is not deployable.
#
# ISOLATED VERIFICATION when the working tree is DIRTY: the chain runs against
# the MATERIALIZED HEAD TREE in a persistent detached verify worktree, not the
# shared working tree. On a box running concurrent agent sessions, another
# session's uncommitted/untracked edits used to fail gates here (observed:
# ci:untracked-imports tripped by a sibling session's in-flight file) and
# the marker certified a tree gates never exactly saw. When `git status` is
# clean, isolate is skipped (that failure mode does not exist; G46 already
# typechecks HEAD). ci:untracked-imports always runs on the real working tree
# first — in isolate it is a no-op (no untracked files).
#
# Knobs:
#   PUSH_GATES_IN_PLACE=1     run chain in the shared working tree
#   PUSH_GATES_ISOLATE=1      force the verify worktree even when status is clean
#   PUSH_FULL_GENERATE=1      local `next build` + bundle budget (old chair wait)
#   PUSH_GATES_VERIFY_DIR     verify worktree location (default ~/.cache/ryanrealty-gates-verify)
#   PUSH_GATES_REFRESH_DEPS=1 force re-clone of node_modules into the verify tree
#   PUSH_GATES_CLEAN=1        nuke the verify worktree first (disk pressure / corrupt .next)
#   PUSH_GATES_LOCK_TRIES     verify-lock wait attempts (default 60)
#   PUSH_GATES_LOCK_SLEEP     seconds between attempts (default 30 → 30 min budget)
#   SKIP_LOCAL_GATES=1        (on git push itself) bypass the pre-push marker check
#
# Extra args pass through to git push: `npm run push -- --dry-run`.
#
# EXIT DISCIPLINE (hardened 2026-07-29). Exit 0 from this script means exactly
# one thing: `git push` ran and completed. EVERY other outcome — a failed gate,
# a failed lint, a failed build, a lock timeout, HEAD moving mid-verification,
# a rejected push, a signal — leaves commits sitting local and MUST exit
# non-zero. Three mechanisms enforce that, because a green `npm run push` over
# an aborted push is the worst failure this script can have (observed three
# times in one session on 2026-07-29: the abort banner printed and the caller
# still read exit 0):
#   1. `die` is the ONE abort path, and it refuses to abort with status 0.
#   2. PUSH_COMPLETED is set only by a completed `git push`. The EXIT trap
#      converts any status-0 exit without that flag into exit 1, which covers
#      paths nobody thought to guard: falling off the end, a swallowed status,
#      a trap resuming past the last command.
#   3. INT/TERM exit non-zero instead of running cleanup and RESUMING (a
#      resumed script runs on past the interrupted command and can reach a
#      normal exit 0 having pushed nothing).
#
# CALLER HAZARD, not fixable from in here: `npm run push | tail` reports
# tail's status, so an abort reads as exit 0 at the call site. Never pipe this
# script when you care about the verdict. The last line it prints is the
# verdict either way ("✓ git push OK" or a "✗ …" abort banner) — read that,
# not `$?` of a pipeline.

set -e
# pipefail so a command failing on the LEFT of a pipe cannot be laundered into
# success by a passing right-hand side. Guarded because POSIX sh (dash) has no
# such option; macOS /bin/sh is bash 3.2 and does.
( set -o pipefail ) 2>/dev/null && set -o pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
SHA=$(git rev-parse HEAD)

# ---------------------------------------------------------------------------
# Exit plumbing. Defined before anything can fail so no early abort escapes it.
# ---------------------------------------------------------------------------
PUSH_COMPLETED=0   # set to 1 ONLY by a completed git push
LOCK_HELD=""       # set ONLY once this process owns the verify lock

# die <status> <line>… — the single abort path. Prints the banner to stderr and
# exits non-zero, clamping a caller's 0 up to 1: "abort" and "success" must
# never share an exit status.
die() {
  rc=$1
  shift
  case "$rc" in '' | *[!0-9]*) rc=1 ;; esac
  [ "$rc" -eq 0 ] && rc=1
  echo "" >&2
  for line in "$@"; do
    echo "$line" >&2
  done
  exit "$rc"
}

on_exit() {
  rc=$?
  if [ -n "$LOCK_HELD" ]; then
    rm -rf "$LOCK_HELD" 2>/dev/null || true
  fi
  if [ "$PUSH_COMPLETED" != "1" ] && [ "$rc" -eq 0 ]; then
    echo "" >&2
    echo "✗ push-with-gates reached exit 0 without completing git push — NOTHING landed on the remote." >&2
    echo "  Exiting 1 instead. Your commits are still local. Re-run: npm run push" >&2
    exit 1
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'die 130 "✗ interrupted (SIGINT) — push aborted. NOTHING landed on the remote."' INT
trap 'die 143 "✗ terminated (SIGTERM) — push aborted. NOTHING landed on the remote."' TERM

# ---------------------------------------------------------------------------
# run_chain_and_build <dir> — the heavy work, parameterized by tree location.
# Build skip logic (doc-only pushes) is computed against the MAIN repo's
# upstream either way; the build itself runs in <dir>.
# ---------------------------------------------------------------------------
run_chain_and_build() {
  workdir="$1"

  echo "push: ci:gates static chain in $workdir…"
  ( cd "$workdir" && npm run ci:gates ) || die 1 \
    "✗ ci:gates FAILED — push aborted. Fix the failing gate first." \
    "  NOTHING landed on the remote. Your commits are still local."
  echo "✓ ci:gates OK"

  # Full ESLint pass (added 2026-07-17). CI's lint-and-build job runs
  # `npm run lint` and NOTHING local did — 179 errors accumulated unseen and
  # GitHub Actions CI was red on every push from Jun 24 to Jul 17 while local
  # hooks stayed green. Zero-error policy; warnings pass.
  echo "push: eslint (matches CI lint-and-build) in $workdir…"
  ( cd "$workdir" && npm run lint -- --cache --cache-location .eslintcache ) || die 1 \
    "✗ eslint FAILED — push aborted. This is the same lint CI runs, fix the errors." \
    "  NOTHING landed on the remote. Your commits are still local."
  echo "✓ eslint OK"

  # Local full generate is the chair wait. Default: skip. Vercel SSGs.
  # PUSH_FULL_GENERATE=1 restores the old Turbopack SSG + bundle budget.
  if [ "$PUSH_FULL_GENERATE" = "1" ]; then
    echo "push: production build (Turbopack; PUSH_FULL_GENERATE=1) in $workdir…"
    ( cd "$workdir" && NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" npm run build ) || die 1 \
      "✗ next build FAILED — this commit would ERROR on Vercel and silently never deploy." \
      "  NOTHING landed on the remote. Your commits are still local."
    echo "✓ next build OK"
    echo "push: bundle budget (matches CI) in $workdir…"
    ( cd "$workdir" && npm run ci:bundle-budget ) || {
      echo ""
      echo "✗ bundle budget FAILED — investigate the growth, or re-baseline if intentional."
      exit 1
    }
    echo "✓ bundle budget OK"
  else
    echo "push: skipping full next generate (Vercel owns SSG). PUSH_FULL_GENERATE=1 to force locally."
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
  # Worktree branches are named wt/* but must land on the tracked upstream
  # (origin/main). `push.default=current` would mint origin/wt/* instead
  # (observed 2026-08-19: dbd671c7). `git push @{u}` is parsed as a remote
  # name and fails. Extra args still pass through.
  if [ "$#" -eq 0 ]; then
    git -c push.default=upstream push
  else
    git push "$@"
  fi
  push_rc=$?
  set -e
  if [ "$push_rc" -ne 0 ]; then
    die "$push_rc" \
      "✗ git push FAILED (exit $push_rc) — NOTHING landed on the remote." \
      "  Non-fast-forward? git fetch + rebase onto the remote branch, then re-run: npm run push"
  fi
  # The ONLY place this flag is set. Everything else exits non-zero.
  PUSH_COMPLETED=1
  echo "✓ git push OK"
}

# ci:untracked-imports greps git ls-files --others. Isolate is a clean HEAD
# checkout, so the gate is a no-op there. Run it on the real working tree first.
# The file check keeps the push-with-gates fixture (stub package.json, no
# gate scripts) from dying on a missing npm script.
if [ -f "$REPO_ROOT/scripts/check-untracked-imports.mjs" ]; then
  echo "push: ci:untracked-imports on the working tree…"
  ( cd "$REPO_ROOT" && npm run ci:untracked-imports ) || die 1 \
    "✗ ci:untracked-imports FAILED — a tracked file imports an untracked source file." \
    "  NOTHING landed on the remote. Your commits are still local."
  echo "✓ ci:untracked-imports OK"
fi

# In-place when explicit, or when the working tree is clean (isolate exists so
# a sibling's untracked file cannot fail YOUR push). PUSH_GATES_ISOLATE=1
# restores isolate even on a clean tree.
IN_PLACE=0
if [ "$PUSH_GATES_IN_PLACE" = "1" ]; then
  IN_PLACE=1
elif [ "$PUSH_GATES_ISOLATE" = "1" ]; then
  IN_PLACE=0
elif [ -z "$(git status --porcelain --untracked-files=no)" ]; then
  IN_PLACE=1
fi

if [ "$IN_PLACE" = "1" ]; then
  if [ "$PUSH_GATES_IN_PLACE" = "1" ]; then
    echo "push: PUSH_GATES_IN_PLACE=1 — verifying the shared working tree (foreign session state CAN fail gates here)."
  else
    echo "push: working tree clean — verifying in place (isolate is for dirty sibling files)."
  fi
  run_chain_and_build "$REPO_ROOT"
  node scripts/stamp-gates-marker.mjs || die 1 \
    "✗ could not stamp the pre-push gates marker — push aborted." \
    "  NOTHING landed on the remote."
  do_push "$@"
  exit 0
fi

# ---------------------------------------------------------------------------
# Isolated verification (default).
# ---------------------------------------------------------------------------
VERIFY_DIR="${PUSH_GATES_VERIFY_DIR:-$HOME/.cache/ryanrealty-gates-verify}"
LOCK="$VERIFY_DIR.lock"
# Wait budget: 60 tries x 30s = 30 min. Overridable so the timeout abort is
# reachable in a test without a 30-minute wall clock.
LOCK_TRIES_MAX="${PUSH_GATES_LOCK_TRIES:-60}"
LOCK_SLEEP="${PUSH_GATES_LOCK_SLEEP:-30}"

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
  if [ "$tries" -ge "$LOCK_TRIES_MAX" ]; then
    die 4 \
      "✗ another push verification (pid ${otherpid:-unknown}) has held the lock $((LOCK_TRIES_MAX * LOCK_SLEEP / 60))+ min — aborting. Remove $LOCK if it is wedged." \
      "  NOTHING landed on the remote. Your commits are still local."
  fi
  [ "$tries" -eq 1 ] && echo "push: another push verification is running (pid ${otherpid:-unknown}) — waiting…"
  sleep "$LOCK_SLEEP"
done
echo "$$" > "$LOCK/pid"
# From here the EXIT trap owns cleanup. Assigned only AFTER mkdir won the race,
# so an abort while waiting can never delete the winner's lock.
LOCK_HELD="$LOCK"

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
  git -C "$VERIFY_DIR" clean -fdx -e node_modules -e .next -e .env.local -e .eslintcache >/dev/null
fi

# Build-time env (untracked config, not code state — same values Vercel holds).
[ -f "$REPO_ROOT/.env.local" ] && cp -f "$REPO_ROOT/.env.local" "$VERIFY_DIR/.env.local"

# node_modules: APFS copy-on-write clone from the main checkout (a SYMLINK
# breaks the Turbopack build — see memory reference_worktree_node_modules_turbopack).
# Re-cloned only when the verify tree's package-lock.json stops matching the
# lockfile the current clone was made for.
LOCK_SNAPSHOT="$VERIFY_DIR/node_modules/.rr-lock-snapshot"
if [ "$PUSH_GATES_REFRESH_DEPS" = "1" ] || [ ! -d "$VERIFY_DIR/node_modules" ] || ! cmp -s "$VERIFY_DIR/package-lock.json" "$LOCK_SNAPSHOT"; then
  echo "push: cloning node_modules into verify tree…"
  rm -rf "$VERIFY_DIR/node_modules"
  # macOS APFS clone (`cp -c`) is not portable. Linux uses reflink when the
  # filesystem supports it; otherwise a plain archive copy.
  if cp -Rc "$REPO_ROOT/node_modules" "$VERIFY_DIR/node_modules" 2>/dev/null; then
    :
  elif cp -a --reflink=auto "$REPO_ROOT/node_modules" "$VERIFY_DIR/node_modules" 2>/dev/null; then
    :
  else
    cp -a "$REPO_ROOT/node_modules" "$VERIFY_DIR/node_modules"
  fi
  cp -f "$VERIFY_DIR/package-lock.json" "$LOCK_SNAPSHOT"
fi

echo "push: verifying materialized tree of $SHA (foreign working-tree state cannot affect this run)…"
run_chain_and_build "$VERIFY_DIR"

# Certify exactly the verified commit's tree — NOT whatever HEAD is by now.
node scripts/stamp-gates-marker.mjs --commit "$SHA" || die 1 \
  "✗ could not stamp the pre-push gates marker — push aborted." \
  "  NOTHING landed on the remote."

CUR=$(git rev-parse HEAD)
if [ "$CUR" != "$SHA" ]; then
  die 3 \
    "✗ HEAD moved during verification ($SHA → $CUR) — another session committed." \
    "  The verified tree is stamped. Re-run npm run push to verify + push the new HEAD." \
    "  NOTHING landed on the remote."
fi

do_push "$@"
