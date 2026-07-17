#!/usr/bin/env sh
# push-with-gates.sh — the canonical push path (`npm run push`).
#
# Runs the full local gate chain + production build BEFORE `git push` opens
# the ssh connection to github.com. Rationale: git advertises refs and holds
# the connection open BEFORE running pre-push, so the old in-hook 10-minute
# chain idled the connection out and the pack write died with SIGPIPE
# (exit 141) even with every gate green — observed twice on 2026-07-17.
#
# On success this stamps <git-dir>/rr-gates-marker (tree-hash + timestamp);
# .husky/pre-push only verifies the marker (milliseconds), so the connection
# never idles. Extra args pass through to git push: `npm run push -- --dry-run`.
#
# Escape hatch (unchanged): SKIP_LOCAL_GATES=1 git push

set -e

echo "push: full ci:gates static chain (~120 gates)…"
npm run ci:gates || {
  echo ""
  echo "✗ ci:gates FAILED — push aborted. Fix the failing gate first."
  exit 1
}
echo "✓ ci:gates OK"

# G47 — production build gate (Turbopack, matches Vercel). Same skip logic the
# pre-push hook used: doc/json-only pushes stay fast. A "use server" / RSC
# break passes tsc and ci:gates but fails the Turbopack build Vercel runs,
# then silently never deploys (see docs/plans/crm-golive-execution-2026-06-25.md).
if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
  CHANGED=$(git diff --name-only @{u}..HEAD 2>/dev/null)
else
  CHANGED="__force_build__"   # no upstream tracking — build to be safe
fi

if [ -z "$CHANGED" ]; then
  echo "push: nothing ahead of upstream — skipping build."
elif [ "$CHANGED" = "__force_build__" ] || printf '%s\n' "$CHANGED" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|css)$|(^|/)next\.config|(^|/)package\.json|(^|/)tsconfig'; then
  echo "push: production build (Turbopack, matches Vercel)…"
  # Next's type-check phase OOMs at Node's default ~4GB heap at this repo's
  # size (SIGABRT mid "Running TypeScript", 2026-07-14). 8GB fits the Mac mini.
  NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
  export NODE_OPTIONS
  npm run build || {
    echo ""
    echo "✗ next build FAILED — this commit would ERROR on Vercel and silently never deploy."
    exit 1
  }
  echo "✓ next build OK"
else
  echo "push: only non-buildable files changed — skipping build."
fi

node scripts/stamp-gates-marker.mjs

exec git push "$@"
