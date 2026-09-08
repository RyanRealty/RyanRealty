---
name: loop-status
description: Show the site queue as it stands right now, read from the work graph, without building anything. Use when Matt says "loop status", "queue status", "site queue status", "where is the loop", "what is the loop doing", "show me the queue", or "status of the site".
---

# /loop-status — the queue, read-only

Matt, 2026-09-07: "if I ask for the loop status I can see the queue." This skill
prints it and stops. It builds nothing, claims nothing, and never touches a node.

## What to run

```bash
npx tsx scripts/site-queue-status.ts
```

It reads `loop_work_nodes` (domain `public-ux`, version_gap `SITE-*`) and prints
one line per item: the item, its state, how long ago it last moved, and the one
sentence that matters for that state (what it waits on, who holds it, why it is
blocked, what its evidence says), plus which item the brief serves next.

## How to report it

Relay the table as a table, in this order: next served, then every item with its
state. Under it, three lines and nothing more:

1. **Live work:** items `in_progress` and who holds them (a local session id, or
   `cloud-grinder-<date-hour>` for the hourly routine "Site queue grinder",
   trigger `trig_01JTHasiFzPRDnkTiPzodMPV`, page
   https://claude.ai/code/routines/trig_01JTHasiFzPRDnkTiPzodMPV). If the routine's
   last fire matters, read it with `RemoteTrigger list_runs` and `get_run_log`;
   otherwise do not.
2. **Waiting on Matt:** any `blocked` item whose reason names a decision, quoted in
   one line. A dated measurement window is not waiting on Matt; say when it comes due.
3. **Where to read more:** the Current block of `docs/plans/CROSS_AGENT_HANDOFF.md`
   and the queue table in `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md`.

Do not editorialize, forecast, or propose new items here. Status is a reading of the
graph, not a plan. If Matt then says "run loop", that is `.claude/skills/site-queue/SKILL.md`.
