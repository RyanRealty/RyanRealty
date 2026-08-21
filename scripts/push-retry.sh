#!/usr/bin/env sh
# push-retry.sh — the `npm run push` entrypoint. Wraps push-with-gates.sh with
# bounded auto-recovery for exactly one failure: origin/main advanced while the
# gate chain ran (exit 7 from push-with-gates). With several agent sessions
# pushing all day this collision is routine; before this wrapper each one cost
# a manual fetch/rebase round-trip and a second full invocation.
#
# Recovery is conflict-safe and fully re-verified: fetch, rebase onto
# origin/main (abort + surface on any conflict — never resolve silently), then
# re-run push-with-gates so the gate chain certifies the NEW head. Nothing
# lands unverified. Any exit code other than 7 propagates immediately.
#
# The rebase target is origin/main because main is the only branch this repo
# ships (CLAUDE.md §8); pass-through args like --dry-run never reach the
# rebase path (they cannot produce exit 7).

MAX=3
attempt=1
while :; do
  sh scripts/push-with-gates.sh "$@"
  rc=$?
  [ "$rc" -eq 0 ] && exit 0
  [ "$rc" -ne 7 ] && exit "$rc"
  if [ "$attempt" -ge "$MAX" ]; then
    echo "✗ push: origin/main kept advancing across $MAX verified attempts — giving up. Re-run: npm run push" >&2
    exit 7
  fi
  attempt=$((attempt + 1))
  echo ""
  echo "push: origin/main moved during verification — fetch + rebase + full re-verify (attempt $attempt/$MAX)…"
  git fetch origin main || exit 7
  if ! git rebase origin/main; then
    git rebase --abort 2>/dev/null
    echo "✗ push: rebase onto origin/main conflicts — resolve manually, then npm run push." >&2
    exit 7
  fi
done
