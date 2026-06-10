#!/bin/bash
# Drives the Gmail backfill by looping the sync route until every mailbox
# reports done. Each invocation processes up to 8 pages (~800 messages) per
# mailbox. Safe to interrupt — the cursor only advances on completed windows
# and dedupe keys make overlaps free.
set -u
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
BASE="http://localhost:3000/api/cron/crm-gmail-sync"

for round in $(seq 1 200); do
  out=$(curl -s -m 280 -H "Authorization: Bearer $SECRET" "$BASE?pages=8")
  echo "[round $round] $(date +%H:%M:%S) $out" | head -c 600
  echo ""
  all_done=$(echo "$out" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  rs=d.get('results',[])
  print('yes' if rs and all(r.get('done') for r in rs) else 'no')
except Exception:
  print('no')")
  if [ "$all_done" = "yes" ]; then
    echo "ALL MAILBOXES DONE after $round rounds"
    exit 0
  fi
  sleep 2
done
echo "round cap reached — re-run to continue"
