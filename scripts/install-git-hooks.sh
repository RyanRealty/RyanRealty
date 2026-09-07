#!/bin/sh
# install-git-hooks.sh
#
# Legacy installer for .git/hooks/pre-commit (branch reminder). Prefer Husky
# (`core.hooksPath = .husky/_`). Kept so a fresh non-husky checkout still gets
# the reminder. The brain-audit block this hook used to run was removed
# 2026-09-07 with the rest of the producer-brief synthesis layer
# (scripts/audit-brain.mjs). Worktree / wt/* branches are ALLOWED —
# production still ships via main (see AGENTS.md → Worktrees).
#
#   bash scripts/install-git-hooks.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DEST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -d "$REPO_ROOT/.git" ] && [ ! -f "$REPO_ROOT/.git" ]; then
  echo "ERROR: not inside a git repo. Run from the Ryan Realty repo root."
  exit 1
fi

# Linked worktrees use a .git FILE; writing .git/hooks there is wrong — skip.
if [ -f "$REPO_ROOT/.git" ]; then
  echo "Linked worktree detected — hooks live in the primary repo via husky. Nothing to install."
  exit 0
fi

cat > "$HOOK_DEST" <<'HOOK_EOF'
#!/bin/sh
# Pre-commit hook for Ryan Realty repo (legacy path; husky is preferred).
# Remind when committing off main (worktrees allowed; do not strand work).

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "NOTE: committing on '$branch' (not main)."
  echo "Worktrees are allowed. Before you stop: merge to main + push, or record the"
  echo "branch in docs/plans/CROSS_AGENT_HANDOFF.md. Prefer names: wt/<topic>-YYYYMMDD"
  if ! echo "$branch" | grep -qE '^(wt/|claude/|cursor/)'; then
    echo "TIP: rename to wt/<topic>-YYYYMMDD so stranded branches are obvious."
  fi
fi
HOOK_EOF

chmod +x "$HOOK_DEST"
echo "Installed pre-commit hook at $HOOK_DEST"
