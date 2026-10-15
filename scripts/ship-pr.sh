#!/bin/sh
# ship-pr.sh — land a finished unit. `npm run ship`.
# Local gates, push this branch, open a pull request if missing, merge commit.
# Never updates main with git push. A conflict stops. No rebase onto main.
set -eu
cd "$(git rev-parse --show-toplevel)"

case "${NODE_OPTIONS:-}" in
  *max-old-space-size*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192" ;;
esac

if [ "$#" -gt 0 ]; then
  echo "ship: takes no arguments. It pushes this branch and merges its pull request." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ship: commit or stash first. Refusing a dirty tree." >&2
  exit 1
fi

branch=$(git symbolic-ref --quiet --short HEAD || true)
case "$branch" in
  ''|main)
    echo "ship: run this from the feature branch, not main." >&2
    exit 1
    ;;
esac

echo "ship: gates and push $branch"
sh scripts/push-retry.sh

head=$(git rev-parse HEAD)
git fetch origin main
old_main=$(git rev-parse origin/main)

open=$(gh pr view --json state --jq '.state' 2>/dev/null || true)
case "$open" in
  OPEN) ;;
  '')
    title=$(git log -1 --format=%s)
    gh pr create --base main --head "$branch" --title "$title" \
      --body "Landed by npm run ship after local gates."
    open=OPEN
    ;;
  MERGED)
    if ! git merge-base --is-ancestor "$head" origin/main; then
      echo "ship: the old pull request is merged and this commit is not on main. Stopping." >&2
      exit 1
    fi
    echo "ship: pull request already merged."
    ;;
  *)
    echo "ship: pull request state is $open. Stopping." >&2
    exit 1
    ;;
esac

if [ "$open" = "OPEN" ]; then
  i=0
  remote_head=""
  while [ "$i" -lt 15 ]; do
    remote_head=$(gh pr view --json headRefOid --jq '.headRefOid' 2>/dev/null || true)
    if [ "$remote_head" = "$head" ]; then
      break
    fi
    i=$((i + 1))
    sleep 2
  done
  if [ "$remote_head" != "$head" ]; then
    echo "ship: GitHub has ${remote_head:-nothing} and this commit is $head. Stopping." >&2
    exit 1
  fi
  i=0
  mergeable=UNKNOWN
  status=UNKNOWN
  while [ "$i" -lt 5 ]; do
    mergeable=$(gh pr view --json mergeable --jq '.mergeable')
    status=$(gh pr view --json mergeStateStatus --jq '.mergeStateStatus')
    echo "ship: mergeable=$mergeable status=$status"
    case "$mergeable" in
      UNKNOWN) i=$((i + 1)); sleep 2; continue ;;
    esac
    break
  done
  case "$mergeable" in
    CONFLICTING)
      echo "ship: the branch conflicts with main. Stopping. No rebase." >&2
      exit 2
      ;;
  esac
  case "$status" in
    DIRTY)
      echo "ship: GitHub reports the pull request dirty. Stopping. No rebase." >&2
      exit 2
      ;;
    BLOCKED|DRAFT)
      echo "ship: pull request is $status. Stopping." >&2
      exit 2
      ;;
  esac
  # One production build at a time: wait while another is building, so two
  # builds never prerender against the database together
  # (scripts/lib/production-build-gate.mjs). Never fails the ship.
  node scripts/wait-for-production-build.mjs || true
  gh pr merge --merge --match-head-commit "$head"
  git fetch origin main
fi

echo "ship: origin/main is $(git rev-parse --short origin/main)"

# Finished worktrees (this one included, after the 3-hour idle window) can go.
# Never fail the ship. The hook form exits 0 even when a candidate is skipped.
if [ -f scripts/cleanup-merged-worktrees.sh ]; then
  sh scripts/cleanup-merged-worktrees.sh --hook || true
fi

kind=$(node --input-type=module -e '
import { listChangedFiles, classifyProductDiff, isVercelSkippable } from "./scripts/lib/product-diff.mjs"
const files = listChangedFiles({ prev: process.argv[1], head: "origin/main" })
const result = classifyProductDiff(files, { skippable: isVercelSkippable, prev: process.argv[1], head: "origin/main" })
console.log(result.status)
for (const f of result.blockers.slice(0, 15)) console.log(f)
' "$old_main")
echo "$kind"
first=$(printf '%s\n' "$kind" | head -n 1)
case "$first" in
  skip|empty)
    echo "ship: no production app change in this land. Vercel skips the build."
    ;;
  *)
    echo "ship: app changed. Waiting for production."
    # Production records the merge commit. The branch tip is an ancestor of it.
    npm run deploy:verify -- "$(git rev-parse origin/main)"
    ;;
esac
