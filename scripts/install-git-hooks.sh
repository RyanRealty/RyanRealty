#!/bin/sh
# install-git-hooks.sh
#
# Installs the pre-commit hook that runs scripts/audit-brain.mjs whenever brain
# spec files (REGISTRY.md, vercel.json, SKILL.md files, publish route, etc.)
# are staged for commit.
#
# Run once per fresh checkout (or after a `git init` clone):
#   bash scripts/install-git-hooks.sh
#
# Locked 2026-05-17.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DEST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "ERROR: not inside a git repo. Run from the Ryan Realty repo root."
  exit 1
fi

cat > "$HOOK_DEST" <<'HOOK_EOF'
#!/bin/sh
# Pre-commit hook for Ryan Realty repo.
# 1. Enforce single-branch (main only) policy.
# 2. Auto-run audit-brain.mjs when brain spec files are in the staged change set.

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "ERROR: Commits are only allowed on 'main'. You are on '$branch'."
  exit 1
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
