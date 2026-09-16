#!/usr/bin/env sh
# start-prod-server.sh — start a built `next start` server safely, detached,
# and wait for it to answer before handing back control.
#
# WHY (2026-09-15 cloud round). An ad hoc `npx next start -p 3401` collided
# with an earlier `next start` still holding 3401, logged EADDRINUSE into a
# file nobody read, and two Playwright probes measured the OLD build as if it
# were the new one. `scripts/run-runtime-gates.sh` already guards exactly this
# with three port-holder detectors (lsof, fuser, ss) and a stale-`.next`
# check; an ad hoc start had none of that. This script is that guard, usable
# on its own — `npm run push`'s `next build` step and CI's `ci:runtime-gates`
# start their own servers internally, but a cloud lane or a person checking a
# production build by hand had no safe entry point until now.
#
#   sh scripts/start-prod-server.sh                 # port 3000
#   PORT=3555 sh scripts/start-prod-server.sh       # somewhere else
#   FREE_PORT=1 PORT=3401 sh scripts/start-prod-server.sh   # kill the holder(s) first
#
# Build first: `npm run build` (or `npx next build`). This starts a server,
# it does not make one.
set -e

PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"
LOG="${LOG:-/tmp/rr-prod-${PORT}.log}"

# The staleness check, copied verbatim from run-runtime-gates.sh (2026-09-08):
# a build older than the newest commit cannot contain it, and a gate — or a
# server — measuring yesterday's bytes is a false negative wearing a green
# tick.
if [ ! -f .next/BUILD_ID ]; then
  echo "start-prod-server: no .next/BUILD_ID — run \`npm run build\` first." >&2
  exit 1
fi

BUILD_AT=$(date -r .next/BUILD_ID +%s 2>/dev/null || echo 0)
HEAD_AT=$(git log -1 --format=%ct 2>/dev/null || echo 0)
if [ "$BUILD_AT" -gt 0 ] && [ "$HEAD_AT" -gt 0 ] && [ "$BUILD_AT" -lt "$HEAD_AT" ]; then
  echo "start-prod-server: .next was built $(( (HEAD_AT - BUILD_AT) / 60 )) minute(s) BEFORE the HEAD commit." >&2
  echo "  A server started on this build would serve code that is not in this tree." >&2
  echo "  Delete the .next directory (by name — no rm -rf) and run \`npm run build\` again." >&2
  exit 1
fi

# THE PORT MUST BE FREE, AND THIS IS NOT PEDANTRY — same three detectors as
# run-runtime-gates.sh, because on this container `lsof -ti tcp:<port>`
# printed nothing while `fuser -n tcp <port>` printed the pid that was
# holding it. One detector is not enough.
port_holders() {
  lsof -ti "tcp:${PORT}" 2>/dev/null && return 0
  fuser -n tcp "${PORT}" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' && return 0
  ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -oE 'pid=[0-9]+' | cut -d= -f2
}

HOLDERS=$(port_holders | sort -u | tr '\n' ' ' | sed 's/ *$//')
if [ -n "$HOLDERS" ]; then
  echo "start-prod-server: port ${PORT} is already in use by pid(s): ${HOLDERS}" >&2
  for p in $HOLDERS; do ps -o pid,cmd -p "$p" --no-headers >&2 || true; done
  if [ "${FREE_PORT:-0}" != "1" ]; then
    echo "  Whatever answers there is NOT this build, and starting another server on" >&2
    echo "  it would measure the wrong process. Stop it, set PORT, or re-run with" >&2
    echo "  FREE_PORT=1 to kill exactly the pid(s) above and take the port." >&2
    exit 1
  fi
  echo "start-prod-server: FREE_PORT=1 — killing ${HOLDERS}." >&2
  kill $HOLDERS 2>/dev/null || true
  sleep 2
  HOLDERS=$(port_holders | sort -u | tr '\n' ' ' | sed 's/ *$//')
  if [ -n "$HOLDERS" ]; then
    echo "start-prod-server: port ${PORT} still held by pid(s): ${HOLDERS} after FREE_PORT=1 kill." >&2
    for p in $HOLDERS; do ps -o pid,cmd -p "$p" --no-headers >&2 || true; done
    exit 1
  fi
fi

NEXT_BIN="./node_modules/.bin/next"
if [ ! -x "$NEXT_BIN" ]; then
  NEXT_BIN="npx next"
fi

setsid nohup $NEXT_BIN start -p "$PORT" > "$LOG" 2>&1 < /dev/null &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true

# It must actually still be running before we spend the wait budget on it.
sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "start-prod-server: the server exited before it could serve. Log:" >&2
  cat "$LOG" >&2 || true
  exit 1
fi

if ! node scripts/wait-for-server.mjs "$BASE" "${START_PROD_WAIT:-120}"; then
  echo "----- server log ($LOG) -----" >&2
  cat "$LOG" >&2 || true
  exit 1
fi

echo "start-prod-server: up — pid ${SERVER_PID}, log ${LOG}, ${BASE}"
