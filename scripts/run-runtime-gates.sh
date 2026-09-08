#!/usr/bin/env sh
# run-runtime-gates.sh — start the built server once, run the gates that can
# only be measured against a running one, then stop it.
#
# WHY THIS IS NOT `start-server-and-test` (2026-09-08). The first cut of
# `ci:runtime-gates` was exactly that wrapper, and it could never start: its
# waiter is `wait-on`, which is axios-based and sends `User-Agent: axios/1.x`,
# which the middleware bot screen's BAD_BOT_RE matches, so every probe came back
# 403 and the wrapper retried to a mute "Timed out waiting for:
# http://127.0.0.1:3000". That is the SAME failure CI carried on every pull
# request from 2026-07-25 to 2026-08-02 and already root-caused in
# scripts/wait-for-server.mjs — a gate command that reintroduces a bug the repo
# has written down is worse than no gate command, because it reads as green
# tooling. So this uses the same explicit start / wait / run split the CI job
# uses, and the same waiter, which sends a real User-Agent.
#
# It also refuses a STALE build. A lane in this session ran the tap-target gate
# against a .next whose BUILD_ID predated the fix commit by 13 minutes and read
# the pass as proof. A gate measuring yesterday's bytes is a false negative
# wearing a green tick, so the staleness check is part of the gate.
#
#   npm run ci:runtime-gates              # route-smoke, page-payload, tap-targets
#   PORT=3010 npm run ci:runtime-gates    # somewhere else
#
# Build first: `npm run build`. This starts a server, it does not make one.
set -e

PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"
LOG="${RUNTIME_GATES_LOG:-/tmp/runtime-gates-server.log}"

if [ ! -f .next/BUILD_ID ]; then
  echo "runtime-gates: no .next/BUILD_ID — run \`npm run build\` first." >&2
  exit 1
fi

# The staleness check. A build older than the newest commit cannot contain it.
BUILD_AT=$(date -r .next/BUILD_ID +%s 2>/dev/null || echo 0)
HEAD_AT=$(git log -1 --format=%ct 2>/dev/null || echo 0)
if [ "$BUILD_AT" -gt 0 ] && [ "$HEAD_AT" -gt 0 ] && [ "$BUILD_AT" -lt "$HEAD_AT" ]; then
  echo "runtime-gates: .next was built $(( (HEAD_AT - BUILD_AT) / 60 )) minute(s) BEFORE the HEAD commit." >&2
  echo "  A pass here would measure code that is not in this tree." >&2
  echo "  Delete the .next directory and run \`npm run build\` again." >&2
  exit 1
fi

# THE PORT MUST BE FREE, AND THIS IS NOT PEDANTRY. A stale `next start` from an
# earlier run held 3000 on 2026-09-08; the new server died with EADDRINUSE into a
# log nobody read, the waiter got its 200 from the OLD process, and the gates —
# and a hand curl checking two just-built fixes — measured the previous build and
# reported it as the new one. A gate that silently grades someone else's server
# is worse than a gate that fails.
# THREE DETECTORS, BECAUSE ONE IS NOT ENOUGH. On this container `lsof -ti
# tcp:3000` printed nothing while `fuser -n tcp 3000` printed the pid that was
# holding it, so an lsof-only guard would have waved through the exact case it
# exists to catch — twice, which is how this line got written.
port_holders() {
  lsof -ti "tcp:${PORT}" 2>/dev/null && return 0
  fuser -n tcp "${PORT}" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' && return 0
  ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -oE 'pid=[0-9]+' | cut -d= -f2
}

HOLDERS=$(port_holders | sort -u | tr '\n' ' ' | sed 's/ *$//')
if [ -n "$HOLDERS" ]; then
  echo "runtime-gates: port ${PORT} is already in use by pid(s): ${HOLDERS}" >&2
  echo "  Whatever answers there is NOT the build in this tree, and measuring it" >&2
  echo "  would report another server's result as this one's. Stop it, or set PORT." >&2
  for p in $HOLDERS; do ps -o pid,cmd -p "$p" --no-headers >&2 || true; done
  exit 1
fi

npm run start:ci > "$LOG" 2>&1 &
SERVER_PID=$!

# And it must actually be OUR server that came up. Without this, a race that
# loses the bind still reaches the waiter, which happily 200s off the winner.
sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "runtime-gates: the server exited before it could serve. Log:" >&2
  cat "$LOG" >&2 || true
  exit 1
fi

stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  # `npm run start:ci` spawns next-server as a child, so the npm pid alone
  # leaves the port held. Kill by PORT rather than by process group: a negative
  # pid signals this shell's own group too, which on a CI runner takes the
  # runner down (.github/workflows/ci.yml records that outage).
  PORT_PIDS=$(port_holders 2>/dev/null | sort -u | tr '\n' ' ')
  [ -n "$PORT_PIDS" ] && kill $PORT_PIDS 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap stop_server EXIT INT TERM

if ! node scripts/wait-for-server.mjs "$BASE" "${RUNTIME_GATES_WAIT:-180}"; then
  echo "----- server log -----" >&2
  cat "$LOG" >&2 || true
  exit 1
fi

npm run ci:route-smoke
npm run ci:page-payload
npm run ci:tap-targets

echo "runtime-gates OK — route-smoke, page-payload and tap-targets all measured against $BASE"
