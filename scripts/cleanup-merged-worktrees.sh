#!/usr/bin/env bash
# cleanup-merged-worktrees.sh — remove finished Ryan Realty worktrees and clones.
#
# Matt's Mini fills up because every coding agent (Grok Build, Claude Code,
# Cursor, others) creates a new worktree or clone per task (~0.9–3 GB with
# node_modules) and nothing removes it after the PR merges. This script is
# the only remover. It is safe by construction: a checkout is deleted only
# when every check below holds.
#
# macOS (zsh/bash 3.2, BSD find/lsof) and Linux. No GNU-only flags.
#
# Usage:
#   scripts/cleanup-merged-worktrees.sh            # live remove
#   scripts/cleanup-merged-worktrees.sh --dry-run  # print only
#   scripts/cleanup-merged-worktrees.sh --hook     # live, never fail (git hooks)
#
# Env:
#   RR_CLEANUP_DRY_RUN=1       same as --dry-run
#   RR_CLEANUP_HOOK=0          skip --hook runs
#   RR_CLEANUP_REPO            primary checkout (default: this repo)
#   RR_CLEANUP_HOME            home to scan for sibling clones (default: $HOME)
#   RR_CLEANUP_RECENT_MINUTES  idle window, default 180
#   RR_CLEANUP_GH=0            do not call gh
#   RR_CLEANUP_GH_BIN          gh binary (tests inject a fake)
#   RR_CLEANUP_ORIGIN_FETCH=0  skip git fetch origin
#
# A path is removed only when ALL of these hold:
#   1. Its branch's PR is MERGED or CLOSED, or the branch is gone from origin
#      and every commit is already in origin/main by patch-id (git cherry).
#   2. git status is clean.
#   3. No unpushed commits (unless a MERGED PR explains them — squash) and
#      no stash created from this HEAD (clones: no stash at all).
#   4. No process has its cwd inside the checkout (including this shell).
#   5. Nothing outside node_modules, .next and .git changed in the last N min.
# Never removes the primary checkout, a checkout on main, a detached
# system tree (gates-verify), a foreign git remote, or a path another
# session is using.

set -eu

# Hooks export GIT_DIR for the checkout that fired them. Every `git -C` below
# would then ignore its path and operate on that one repo.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX

DRY_RUN=0
HOOK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|-n) DRY_RUN=1 ;;
    --hook) HOOK=1 ;;
    --help|-h)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *)
      echo "cleanup-merged-worktrees: unknown flag $1 (try --help)" >&2
      [ "$HOOK" = 1 ] && exit 0
      exit 2
      ;;
  esac
  shift
done

if [ "${RR_CLEANUP_DRY_RUN:-0}" = "1" ]; then
  DRY_RUN=1
fi
if [ "$HOOK" = 1 ] && [ "${RR_CLEANUP_HOOK:-1}" = "0" ]; then
  echo "cleanup-merged-worktrees: hook skipped (RR_CLEANUP_HOOK=0)"
  exit 0
fi

RECENT_MIN="${RR_CLEANUP_RECENT_MINUTES:-180}"
HOME_SCAN="${RR_CLEANUP_HOME:-$HOME}"
GH_BIN="${RR_CLEANUP_GH_BIN:-gh}"

# Resolve a directory to a physical path. `pwd -P` works on bash 3.2 and BSD.
resolve_dir() {
  (CDPATH= cd -- "$1" && pwd -P) 2>/dev/null || return 1
}

# Compare in physical paths: git reports worktree paths resolved, so a home
# reached through a symlink (macOS /var is /private/var) never contained them
# and every sibling clone was skipped as "not under RR_CLEANUP_HOME".
HOME_SCAN=$(resolve_dir "$HOME_SCAN" || printf '%s' "$HOME_SCAN")

die() {
  echo "cleanup-merged-worktrees: $*" >&2
  if [ "$HOOK" = 1 ]; then
    exit 0
  fi
  exit 1
}

# Locate the primary Ryan Realty checkout (the one with a real .git directory).
if [ -n "${RR_CLEANUP_REPO:-}" ]; then
  PRIMARY=$(resolve_dir "$RR_CLEANUP_REPO") || die "RR_CLEANUP_REPO is not a directory"
else
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    PRIMARY=$(resolve_dir "$(git rev-parse --show-toplevel)")
  elif [ -d "$HOME_SCAN/RyanRealty/.git" ]; then
    PRIMARY=$(resolve_dir "$HOME_SCAN/RyanRealty")
  else
    die "cannot find the Ryan Realty repo (set RR_CLEANUP_REPO)"
  fi
fi

if ! git -C "$PRIMARY" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "$PRIMARY is not a git checkout"
fi

# Common git dir — linked worktrees share this. Avoid --path-format (older macOS git).
COMMON_DIR=$(git -C "$PRIMARY" rev-parse --git-common-dir)
case "$COMMON_DIR" in
  /*) ;;
  *) COMMON_DIR=$(resolve_dir "$PRIMARY/$COMMON_DIR") ;;
esac
if [ -d "$COMMON_DIR" ]; then
  COMMON_DIR=$(resolve_dir "$COMMON_DIR")
fi

ORIGIN_URL=$(git -C "$PRIMARY" remote get-url origin 2>/dev/null || true)
case "$ORIGIN_URL" in
  *RyanRealty*RyanRealty*|*RyanRealty/RyanRealty*) ;;
  *)
    # Tests point origin at a local bare repo; still require the folder to look like ours
    # unless RR_CLEANUP_ALLOW_ANY_ORIGIN=1.
    if [ "${RR_CLEANUP_ALLOW_ANY_ORIGIN:-0}" != "1" ]; then
      die "origin $ORIGIN_URL is not RyanRealty/RyanRealty (override RR_CLEANUP_ALLOW_ANY_ORIGIN=1 for fixtures)"
    fi
    ;;
esac

if [ "${RR_CLEANUP_ORIGIN_FETCH:-1}" != "0" ]; then
  git -C "$PRIMARY" fetch origin --prune >/dev/null 2>&1 || true
fi

if ! git -C "$PRIMARY" rev-parse --verify origin/main >/dev/null 2>&1; then
  die "origin/main is missing (fetch failed?)"
fi

SELF_CWD=$(resolve_dir "$PWD" 2>/dev/null || echo "$PWD")

if [ "$DRY_RUN" = 1 ]; then
  echo "cleanup-merged-worktrees: dry-run (primary $PRIMARY)"
else
  echo "cleanup-merged-worktrees: live (primary $PRIMARY)"
fi

# --- helpers ---------------------------------------------------------------

is_ryanrealty_repo() {
  dir="$1"
  url=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
  case "$url" in
    *RyanRealty*RyanRealty*|*RyanRealty/RyanRealty*) return 0 ;;
  esac
  if [ "${RR_CLEANUP_ALLOW_ANY_ORIGIN:-0}" = "1" ]; then
    # Fixture: same object store or same origin as PRIMARY.
    other=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
    [ -n "$other" ] && [ "$other" = "$ORIGIN_URL" ] && return 0
    # Linked worktree of PRIMARY has no extra remote check beyond common dir.
    common=$(git -C "$dir" rev-parse --git-common-dir 2>/dev/null || true)
    case "$common" in
      /*) ;;
      '') common="" ;;
      *) common=$(resolve_dir "$dir/$common" 2>/dev/null || echo "$dir/$common") ;;
    esac
    [ -n "$common" ] && [ "$(resolve_dir "$common" 2>/dev/null || echo "$common")" = "$COMMON_DIR" ] && return 0
  fi
  return 1
}

branch_of() {
  dir="$1"
  git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null || echo ""
}

head_of() {
  git -C "$1" rev-parse HEAD 2>/dev/null || echo ""
}

is_clean() {
  # Empty porcelain = clean (no staged, unstaged, or untracked).
  [ -z "$(git -C "$1" status --porcelain --untracked-files=normal 2>/dev/null)" ]
}

# Stashes created from this worktree's current HEAD. Shared-repo stashes from
# another worktree (first parent != this HEAD) are left alone — removing a
# linked worktree does not delete the shared stash reflog.
stash_from_this_head() {
  dir="$1"
  head=$(head_of "$dir")
  [ -n "$head" ] || return 1
  # Clone with its own .git: any stash would be destroyed by rm -rf.
  if [ -d "$dir/.git" ]; then
    list=$(git -C "$dir" stash list 2>/dev/null || true)
    [ -n "$list" ] && return 0
    return 1
  fi
  git -C "$dir" stash list --format='%P' 2>/dev/null | while IFS= read -r parents; do
    first=${parents%% *}
    if [ "$first" = "$head" ]; then
      echo yes
    fi
  done | grep -q yes
}

# Commits on HEAD that are on no origin ref.
unpushed_count() {
  git -C "$1" rev-list --count --not --remotes=origin HEAD 2>/dev/null || echo 0
}

# Commits on HEAD whose patch-id is not already in origin/main (`+` from git cherry).
unique_vs_main_count() {
  git -C "$1" cherry origin/main HEAD 2>/dev/null | grep -c '^+[ ]' || true
}

branch_on_origin() {
  branch="$1"
  [ -n "$branch" ] || return 1
  git -C "$PRIMARY" show-ref --verify --quiet "refs/remotes/origin/$branch"
}

# PR state: MERGED | CLOSED | OPEN | NONE
pr_state() {
  dir="$1"
  branch="$2"
  if [ "${RR_CLEANUP_GH:-1}" = "0" ]; then
    echo NONE
    return
  fi
  if ! command -v "$GH_BIN" >/dev/null 2>&1; then
    echo NONE
    return
  fi
  # --head wants the branch name. `gh` uses the checkout's origin.
  json=$(
    git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || true
    "$GH_BIN" pr list --head "$branch" --state all --json state --limit 5 2>/dev/null || true
  )
  case "$json" in
    *MERGED*) echo MERGED; return ;;
    *CLOSED*) echo CLOSED; return ;;
    *OPEN*) echo OPEN; return ;;
  esac
  echo NONE
}

# A process has this directory as cwd (or a subdirectory).
cwd_busy_reason() {
  dir="$1"
  case "$SELF_CWD" in
    "$dir"|"$dir"/*)
      echo "this shell cwd is inside it"
      return 0
      ;;
  esac
  if [ -d /proc ]; then
    for cwdlink in /proc/[0-9]*/cwd; do
      [ -L "$cwdlink" ] || continue
      pid=${cwdlink#/proc/}
      pid=${pid%/cwd}
      [ "$pid" = "$$" ] && continue
      target=$(readlink "$cwdlink" 2>/dev/null || true)
      case "$target" in
        "$dir"|"$dir"/*)
          echo "pid $pid cwd"
          return 0
          ;;
      esac
    done
  fi
  if command -v lsof >/dev/null 2>&1; then
    # -F n: each cwd path is a line `n/absolute`. Works on macOS and Linux.
    lsof_out=$(lsof -a -d cwd -F n 2>/dev/null || true)
    if printf '%s\n' "$lsof_out" | grep -E "^n${dir}(/|$)" >/dev/null 2>&1; then
      echo "lsof reports a cwd inside it"
      return 0
    fi
  fi
  return 1
}

# Files newer than RECENT_MIN minutes, ignoring node_modules / .next / .git.
recent_change_reason() {
  dir="$1"
  # BSD and GNU find both support -mmin and -prune.
  hit=$(
    find "$dir" \
      \( -name node_modules -o -name .next -o -name .git \) -prune -o \
      -type f -mmin -"$RECENT_MIN" -print 2>/dev/null | head -n 1
  )
  if [ -n "$hit" ]; then
    echo "changed in last ${RECENT_MIN}m (${hit#$dir/})"
    return 0
  fi
  return 1
}

matches_clone_pattern() {
  path="$1"
  base=$(basename "$path")
  parent=$(dirname "$path")
  case "$path" in
    "$HOME_SCAN"/RyanRealty-wt-*) return 0 ;;
    "$HOME_SCAN"/rr-*) return 0 ;;
    "$HOME_SCAN"/wt-*) return 0 ;;
    "$HOME_SCAN"/rr-grok-*) return 0 ;;
    "$HOME_SCAN"/.grok/worktrees/*) return 0 ;;
  esac
  # Also accept the documented sibling names even if HOME_SCAN was remapped
  # and the prefix is a test dir that still uses those basenames.
  case "$base" in
    RyanRealty-wt-*|rr-*|wt-*|rr-grok-*) return 0 ;;
  esac
  case "$parent" in
    */.grok/worktrees) return 0 ;;
  esac
  return 1
}

# --- collect candidates ----------------------------------------------------

LIST_FILE="${TMPDIR:-/tmp}/rr-cleanup-list-$$"
: > "$LIST_FILE"

add_candidate() {
  raw="$1"
  [ -d "$raw" ] || return 0
  resolved=$(resolve_dir "$raw") || return 0
  if awk -v p="$resolved" '$0==p { found=1 } END { exit !found }' "$LIST_FILE"; then
    return 0
  fi
  printf '%s\n' "$resolved" >> "$LIST_FILE"
}

# Linked worktrees of PRIMARY (includes PRIMARY itself).
porcelain=$(git -C "$PRIMARY" worktree list --porcelain 2>/dev/null || true)
printf '%s\n' "$porcelain" | while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    worktree\ *)
      add_candidate "${line#worktree }"
      ;;
  esac
done

# Sibling clones / extra worktrees matching the agent path patterns.
# Unmatched globs stay literal on bash 3.2 — `[ -d ]` filters them.
for pat in \
  "$HOME_SCAN"/RyanRealty-wt-* \
  "$HOME_SCAN"/rr-* \
  "$HOME_SCAN"/wt-* \
  "$HOME_SCAN"/rr-grok-* \
  "$HOME_SCAN"/.grok/worktrees/*; do
  [ -d "$pat" ] || continue
  add_candidate "$pat"
done

REMOVED=0
SKIPPED=0
KEPT=0
WOULD=0

keep() {
  echo "KEEP   $1  $2"
  KEPT=$((KEPT + 1))
}

skip() {
  echo "SKIP   $1  $2"
  SKIPPED=$((SKIPPED + 1))
}

remove_msg() {
  if [ "$DRY_RUN" = 1 ]; then
    echo "WOULD  $1  $2"
    WOULD=$((WOULD + 1))
  else
    echo "REMOVE $1  $2"
    REMOVED=$((REMOVED + 1))
  fi
}

# --- evaluate + act --------------------------------------------------------

# Do not use a pipe for the main loop — we need to mutate counters.
while IFS= read -r dir || [ -n "$dir" ]; do
  [ -n "$dir" ] || continue
  [ -d "$dir" ] || continue

  if [ "$dir" = "$PRIMARY" ]; then
    keep "$dir" "primary checkout"
    continue
  fi

  case "$dir" in
    *ryanrealty-gates-verify*)
      keep "$dir" "gates verify worktree"
      continue
      ;;
  esac

  if ! git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    skip "$dir" "not a git checkout"
    continue
  fi

  if ! is_ryanrealty_repo "$dir"; then
    skip "$dir" "origin is not RyanRealty/RyanRealty"
    continue
  fi

  kind=clone
  if [ -f "$dir/.git" ]; then
    kind=worktree
  elif [ -d "$dir/.git" ]; then
    kind=clone
  fi

  # A sibling full clone must match the documented path patterns.
  if [ "$kind" = clone ]; then
    common=$(git -C "$dir" rev-parse --git-common-dir 2>/dev/null || true)
    case "$common" in
      /*) ;;
      '') common="" ;;
      *) common=$(resolve_dir "$dir/$common" 2>/dev/null || echo "") ;;
    esac
    if [ -n "$common" ]; then
      common=$(resolve_dir "$common" 2>/dev/null || echo "$common")
    fi
    if [ -n "$common" ] && [ "$common" = "$COMMON_DIR" ]; then
      kind=worktree
    elif ! matches_clone_pattern "$dir"; then
      skip "$dir" "clone path does not match RyanRealty-wt-*/rr-*/wt-*/rr-grok-*/.grok/worktrees"
      continue
    fi
  fi

  branch=$(branch_of "$dir")
  if [ -z "$branch" ]; then
    skip "$dir" "detached HEAD"
    continue
  fi
  if [ "$branch" = main ]; then
    keep "$dir" "on main"
    continue
  fi

  if ! is_clean "$dir"; then
    skip "$dir" "dirty working tree"
    continue
  fi

  if stash_from_this_head "$dir"; then
    skip "$dir" "stash present"
    continue
  fi

  busy=$(cwd_busy_reason "$dir" || true)
  if [ -n "${busy:-}" ]; then
    skip "$dir" "$busy"
    continue
  fi

  recent=$(recent_change_reason "$dir" || true)
  if [ -n "${recent:-}" ]; then
    skip "$dir" "$recent"
    continue
  fi

  state=$(pr_state "$dir" "$branch")
  on_origin=0
  if branch_on_origin "$branch"; then
    on_origin=1
  fi
  unique=$(unique_vs_main_count "$dir")
  unique=${unique:-0}
  unpushed=$(unpushed_count "$dir")
  unpushed=${unpushed:-0}

  eligible=0
  reason=""
  case "$state" in
    MERGED)
      eligible=1
      reason="PR MERGED"
      ;;
    CLOSED)
      if [ "$unique" = "0" ]; then
        eligible=1
        reason="PR CLOSED and commits are in origin/main by patch-id"
      else
        skip "$dir" "PR CLOSED with $unique commit(s) not in origin/main (unpushed or abandoned work)"
        continue
      fi
      ;;
    OPEN)
      skip "$dir" "PR still open"
      continue
      ;;
    NONE)
      if [ "$on_origin" = 0 ] && [ "$unique" = "0" ]; then
        eligible=1
        reason="branch gone from origin; commits in origin/main by patch-id"
      else
        if [ "$on_origin" = 1 ]; then
          skip "$dir" "branch still on origin and no merged/closed PR"
        else
          skip "$dir" "branch gone from origin but $unique commit(s) not in origin/main by patch-id (need gh for squash-merge)"
        fi
        continue
      fi
      ;;
  esac

  if [ "$state" != MERGED ] && [ "$unpushed" != "0" ]; then
    skip "$dir" "unpushed commits ($unpushed)"
    continue
  fi

  if [ "$eligible" != 1 ]; then
    skip "$dir" "not eligible"
    continue
  fi

  detail="$reason; clean; idle ${RECENT_MIN}m; $kind"
  if [ "$DRY_RUN" = 1 ]; then
    remove_msg "$dir" "$detail"
    continue
  fi

  if [ "$kind" = worktree ]; then
    if git -C "$PRIMARY" worktree remove "$dir"; then
      git -C "$PRIMARY" worktree prune >/dev/null 2>&1 || true
      if git -C "$PRIMARY" show-ref --verify --quiet "refs/heads/$branch"; then
        git -C "$PRIMARY" branch -d "$branch" >/dev/null 2>&1 \
          || git -C "$PRIMARY" branch -D "$branch" >/dev/null 2>&1 \
          || true
      fi
      remove_msg "$dir" "$detail"
    else
      skip "$dir" "git worktree remove refused"
    fi
  else
    # Full clone: pattern match already passed. Extra belts: under HOME_SCAN,
    # not the primary, not a symlink, basename matches an agent prefix.
    case "$dir" in
      "$HOME_SCAN"/*) ;;
      *)
        skip "$dir" "clone is not under RR_CLEANUP_HOME"
        continue
        ;;
    esac
    if [ -L "$dir" ]; then
      skip "$dir" "refusing to remove a symlink"
      continue
    fi
    if ! matches_clone_pattern "$dir"; then
      skip "$dir" "clone path failed the pattern check at remove time"
      continue
    fi
    rm -rf -- "$dir"
    if [ -d "$dir" ]; then
      skip "$dir" "rm -rf left the directory"
    else
      remove_msg "$dir" "$detail"
    fi
  fi
done < "$LIST_FILE"
rm -f "$LIST_FILE"

echo "cleanup-merged-worktrees: removed $REMOVED  would $WOULD  skipped $SKIPPED  kept $KEPT"
exit 0
