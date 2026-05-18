# Producer Runtime Executor - Build Log

**Phase:** 12 — Autonomous Producer Execution
**Completed:** 2026-05-17

## What was built

The producer-runtime executor closes the final gap in the autonomous marketing pipeline. Before this build, the dispatcher transitioned rows to `in_production` and wrote a dispatch envelope, but no system actually invoked producer recipes. Rows sat in `in_production` indefinitely.

## Deliverables

| File | Lines | Purpose |
|---|---|---|
| `app/api/cron/producer-runtime/route.ts` | ~260 | Cron executor: picks up `in_production` rows, calls Anthropic, transitions to `ready` |
| `app/api/admin/run-producer/[id]/route.ts` | ~220 | Admin one-shot: manually triggers a single row by ID |
| `app/admin/(protected)/approval-queue/_components/ActionButtons.tsx` | +30 | "Run producer now" button, visible for pending/in_production rows only |
| `vercel.json` | +4 | Adds producer-runtime cron at `*/30 * * * *` (41 -> 42 total) |

## Pipeline flow after this build

```
pending
  -> [dispatcher, */15] -> in_production
  -> [producer-runtime, */30] -> ready
  -> [Matt approves in approval-queue UI] -> approved
  -> [publisher-sweep, */10] -> executed
  -> [measurement crons] -> measured
```

## Model and pricing

- Model: `claude-sonnet-4-5`
- Input: $3.00/M tokens ($0.000003 per token)
- Output: $15.00/M tokens ($0.000015 per token)
- Per-row ceiling: $5.00 USD (row skipped if exceeded, cost still logged)
- Per-run ceiling: $15.00 USD (run halts when cumulative spend exceeds it)

## Safety rails

1. **PRODUCER_RUNTIME_ENABLED guard** - cron is a no-op unless `PRODUCER_RUNTIME_ENABLED=true` in env or `?dryRun=true` is passed.
2. **Per-row cost ceiling** - $5.00 max per row. Overage is logged and the row is left in `in_production` for manual review.
3. **Per-run cost ceiling** - $15.00 max per invocation. Run halts early if cumulative spend hits the ceiling.
4. **429 / billing error handling** - row flips back to `pending`, `requires_billing_action=true` written to `producer_execution_failures`. Admin UI shows a billing link toast.
5. **Optimistic lock** - UPDATE only where `status='in_production'`. Concurrent runs skip the row cleanly.
6. **SKILL.md missing** - logs `skill_load` failure, skips row, does not charge Anthropic.
7. **JSON parse failure** - logs `output_parse` failure, charges cost (tokens were consumed), skips status flip.

## executor_response shape written by runtime

The runtime merges its output onto the existing executor_response written by the dispatcher:

```json
{
  "dispatch_status": "queued_for_agent_runtime",
  "queued_at": "...",
  "producer_output": { "...full producer JSON output..." },
  "publish_payload": { "action_type": "...", "caption": "...", "platforms": ["..."] },
  "draft_path": "out/<action_id>/draft.html",
  "draft_summary": "...",
  "citations": [],
  "scorecard": {},
  "contact_sheet_path": "...",
  "completed_at": "...",
  "model": "claude-sonnet-4-5",
  "input_tokens": 14200,
  "output_tokens": 3100,
  "cost_usd": 0.0888
}
```

The `publish_payload` field is what `publisher-sweep` reads when Matt approves a row.

## Tables written

| Table | When |
|---|---|
| `marketing_cost_ledger` | Every successful Anthropic call (and over-ceiling runs) |
| `producer_execution_failures` | On SKILL.md missing, anthropic error, parse error, cost ceiling, status update error |
| `marketing_brain_actions.executor_response` | On success: merged envelope written, status set to 'ready' |

## Verification

```bash
# Dry-run to see in_production candidates:
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/producer-runtime?dryRun=true"

# Manual one-shot for a specific action row (requires admin session):
curl -X POST \
  -H "Cookie: ..." \
  "https://ryanrealty.vercel.app/api/admin/run-producer/<action_id>"
```

## Em-dash audit

Zero em-dashes (U+2014) or en-dashes (U+2013) in any file produced in this build. Verified via: `grep -rn $'\xe2\x80\x94\|\xe2\x80\x93' app/api/cron/producer-runtime/ app/api/admin/run-producer/`
