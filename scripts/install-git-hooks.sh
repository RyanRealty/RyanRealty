#!/bin/sh
# install-git-hooks.sh
#
# Legacy installer for .git/hooks/pre-commit (brain audit). Prefer Husky
# (`core.hooksPath = .husky/_`). Kept so a fresh non-husky checkout still gets
# the brain audit. Worktree / wt/* branches are ALLOWED — production still
# ships via main (see AGENTS.md → Worktrees).
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
# 1. Remind when committing off main (worktrees allowed; do not strand work).
# 2. Auto-run audit-brain.mjs when brain spec files are staged.

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "NOTE: committing on '$branch' (not main)."
  echo "Worktrees are allowed. Before you stop: merge to main + push, or record the"
  echo "branch in docs/plans/CROSS_AGENT_HANDOFF.md. Prefer names: wt/<topic>-YYYYMMDD"
  if ! echo "$branch" | grep -qE '^(wt/|claude/|cursor/)'; then
    echo "TIP: rename to wt/<topic>-YYYYMMDD so stranded branches are obvious."
  fi
fi

brain_files_touched=$(git diff --cached --name-only | grep -E '(marketing_brain_skills/|social_media_skills/.*SKILL\.md|video_production_skills/.*SKILL\.md|automation_skills/content_engine/SKILL\.md|vercel\.json|lib/punctuation-guard\.ts|lib/marketing-brain/|app/api/social/publish/route\.ts|app/api/cron/(producer-dispatcher|producer-runtime|publisher-sweep|seller-lead-attribution|strategy-revision-check|loop-health-check)/route\.ts|app/admin/.*producers|app/admin/.*approval-queue|app/admin/.*kpi-dashboard|scripts/(validate-producer|audit-brain|loop-health-check|brain-activity-report)\.mjs|supabase/migrations/20260516200)' || true)

if [ -n "$brain_files_touched" ]; then
  echo ""
  echo "Brain spec files in staged change set. Running audit-brain..."
  echo "----"
  if ! node scripts/audit-brain.mjs; then
    echo ""
    echo "----"
    echo "ABORTED: audit-brain.mjs failed. Fix the issues above before committing."
    echo "Bypass (NOT RECOMMENDED): git commit --no-verify"
    exit 1
  fi
  echo "----"
  echo "audit-brain clean. Proceeding with commit."
fi
HOOK_EOF

chmod +x "$HOOK_DEST"
echo "Installed pre-commit hook at $HOOK_DEST"
echo "On next commit, if any brain spec file is staged, audit-brain.mjs will run automatically."
