---
name: marketing-brain-run
description: >
  Top-level marketing brain invocation. Runs the weekly cycle, dispatches all
  generated action items to their assigned producers in parallel, surfaces
  drafts for review. Use when Matt says "run the brain", "run the marketing brain",
  "marketing brain please", "what should we make this week", "/marketing-brain",
  "brain please", "brain run", "weekly brain", or any equivalent.
action_types: []
---

# Marketing Brain — Run

**Scope:** Single entry point for a full brain pass. Calls `runWeeklyCycle()`,
reads all pending action rows it generated, dispatches each to its assigned
producer in parallel, waits for all to surface drafts, then composes one
summary report for Matt. Nothing is committed or published without Matt's
explicit approval after he sees the summary.

**Status:** Canonical. Locked 2026-05-13.

---

## 1. When to use this skill

Matt says any of:
- "run the brain"
- "run the marketing brain"
- "marketing brain please"
- "what should we make this week"
- "/marketing-brain"
- "brain please" / "brain run" / "weekly brain"
- "give me the brain report"

For direct producer invocation (skipping the cycle), use
`marketing_brain_skills/produce/SKILL.md` instead.

---

## 2. Required reading before executing

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy | Every stat in every action row traces to a verified source |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Nothing is committed until Matt explicitly approves |
| `marketing_brain_skills/producers/REGISTRY.md` | Maps action_types to producers; read before dispatch |
| `marketing_brain_skills/weekly-cycle/SKILL.md` | Describes what `runWeeklyCycle()` does and what it returns |
| `marketing_brain_skills/generate-briefs/SKILL.md` | Describes the action rows that come out of the cycle |
| `automation_skills/content_engine/SKILL.md` | All `content:*` actions route through here, not directly to producers |

---

## 3. Procedure

### Step 0 — Record cycle start time

```typescript
const cycle_started_at = new Date().toISOString()
```

This timestamp gates which rows the brain dispatches — only rows created
after `cycle_started_at` are new from this run.

### Step 1 — Run the weekly cycle

Invoke the existing weekly-cycle route:

```sh
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-weekly-cycle?asOfDate=<yesterday>&dryRun=false&windowDays=7"
```

Or call `runWeeklyCycle({ asOfDate, dryRun: false })` directly from TypeScript
at `lib/marketing-brain/weekly-cycle.ts`.

**DryRun mode:** If Matt says "dry run" or "just show me what you'd make",
pass `dryRun=true`. The cycle generates action rows in memory and returns
the `WeeklyCycleReport` without writing to Supabase. Surface the would-be
action list to Matt and stop there — nothing dispatches in dry-run.

**Custom date:** If Matt specifies a date ("run the brain as of last Monday"),
parse the date and pass it as `asOfDate`. Defaults to yesterday UTC.

**WindowDays:** Defaults to 7. If Matt says "shorter lookback" or "just the
last 3 days", pass `windowDays=3`. Never exceed 90.

Wait for the cycle to complete. Log `WeeklyCycleReport.errors` — if any
channel returned `{ error: 'insufficient_data' }`, note it in the summary.

### Step 2 — Read new pending action rows

```sql
SELECT id, action_type, target, assigned_producer, payload, generation_reason, status
FROM public.marketing_brain_actions
WHERE status = 'pending'
  AND created_at >= '<cycle_started_at>'
ORDER BY created_at;
```

**If 0 rows:** The brain found nothing actionable this cycle. Surface the
`WeeklyCycleReport` channel summary to Matt and explain why (low anomaly
density, signals below threshold, maxBriefs already reached from prior runs).
Do not dispatch. Do not fabricate action items.

**If rows exist:** Proceed to dispatch.

### Step 3 — Partition by action category

Split rows into two groups:

**Group A — Content actions** (`action_type LIKE 'content:%'`):
Route through `automation_skills/content_engine/SKILL.md`. The content engine
is the universal content bus — no content producer is invoked directly.

**Group B — Non-content actions** (`action_type LIKE 'site:%'` or
`'ops:%'` or `'comms:%'` or `'analyze:%'`):
Dispatch directly to the producer at `assigned_producer`. Load that producer's
`SKILL.md` to understand the execution procedure.

### Step 4 — Dispatch in parallel

Spawn one subagent per action row. All subagents run in parallel.

For each **content action row** (Group A), spawn:
> Subagent: Load `automation_skills/content_engine/SKILL.md`.
> Action row id: `<id>`. Action type: `<action_type>`. Target: `<target>`.
> Payload: `<payload>`. Execute per content_engine procedure.
> UPDATE `marketing_brain_actions` row status as you proceed.
> Surface draft path when ready.

For each **non-content action row** (Group B), spawn:
> Subagent: Load `<assigned_producer>/SKILL.md`.
> Action row id: `<id>`. Action type: `<action_type>`. Target: `<target>`.
> Payload: `<payload>`. Execute per that producer's SKILL.md procedure.
> UPDATE `marketing_brain_actions` row status as you proceed.
> Surface output when ready.

**Concurrency note:** Spawn all subagents in a single message. Do not wait
for one to finish before starting the next. The brain's value is parallel
production, not sequential.

### Step 5 — Wait for all subagents

Each subagent must reach one of two terminal states:
- `ready` — draft surfaced, action row updated, path returned
- `killed` — unrecoverable failure, action row updated with error, diagnosis returned

Do NOT set any action row to `approved` or `executed` during this skill.
Those transitions happen only after Matt's explicit approval.

**Partial failure is acceptable.** If 2 of 7 producers fail, surface all 7
in the report (5 drafts + 2 failures with diagnosis). Do not block the
report on failed producers.

### Step 6 — Compose the summary report

Surface ONE message to Matt containing everything:

```
Marketing Brain — Run Complete
Cycle date: <as_of_date> | Generated: <iso_timestamp>

CYCLE STATS
  Channels diagnosed: <N> (<M> with errors — see below)
  Action rows generated: <N>
  Voice failures: <N> (rows in 'pending' with voice violation — review these)
  Cycle errors: <error count>

DRAFTS READY (<N> of <total>)

  [1] <action_type> — <target>
      Producer: <assigned_producer>
      Draft: <path or preview URL>
      [Video: Duration <Xs> · Size <N> MB · Scorecard <N>/100]
      [Flyer/Carousel: Slides <N> · citations.json at <path>]
      Reason: <generation_reason from action row>
      Action row: <id>

  [2] ...

FAILURES (<N>)

  [6] <action_type> — <target>
      Producer: <assigned_producer>
      Failure: <one-line diagnosis>
      Recovery: <suggested fix or ask>
      Action row: <id>

CHANNEL GAPS (channels with insufficient_data)
  <channel_name>: <error> — <what this likely means>

VOICE FAILURES (briefs generated but blocked by voice validation)
  <topic> — violations: <§6.X rule cited>
  [These sit as 'pending' in marketing_brain_actions. Review and edit or kill.]

VERIFICATION TRACES
  All figures in content drafts trace to citations.json next to each draft.
  Full WeeklyCycleReport at: [path or inline if small]

Reply to each draft individually:
  "ship [1]" / "kill [1]" / "redo [1] with <change>"
Or reply "ship all" to approve every ready draft at once.
```

Then STOP. Do not commit. Do not push. Do not move any file from `out/`
to `public/`. Wait for Matt's explicit approval signal.

### Step 7 — On approval

When Matt says "ship [N]" / "ship all" / "approved" / "go":

1. For each approved action row:
   - Content: move render from `out/` to `public/v5_library/` (or appropriate path)
   - Site: merge the PR or apply the edit
   - Ops: execute the API call
   - UPDATE `status='approved'` then `status='executed'`, set `approved_by='matt'`, `approved_at=now()`

2. `git add` the specific approved files (not `git add -A`)
3. Commit with message citing the action_type(s) and target(s)
4. Push to `origin/main` immediately

### Step 8 — On rejection

When Matt says "kill [N]" or "redo [N] with <change>":

- **Kill:** UPDATE `status='killed'`, `executor_response={"kill_reason":"<Matt's words>"}`
- **Redo:** Capture Matt's change instruction. Invoke the producer again with the
  updated payload. This is a new subagent — do not mutate the existing action row;
  instead UPDATE it with the amended payload and reset `status='pending'` for
  the re-run, or INSERT a new row if the change is substantial.

---

## 4. Invocation variants

### Dry run

```
Matt: "run the brain dry"
Agent: runs cycle with dryRun=true; surfaces would-be action list with
       generation_reason for each; no Supabase writes; no dispatch.
```

### Specific date

```
Matt: "run the brain as of last Monday"
Agent: calculates last Monday's date; passes asOfDate=YYYY-MM-DD
```

### Specific deliverable only

```
Matt: "run the brain but only make the listing video for 220189422"
Agent: runs cycle (or skips if Matt says "skip the cycle"), then
       dispatches ONLY the action row matching that target.
       All other rows stay in 'pending'.
```

### Force-generate a specific action type

```
Matt: "brain, I need a news clip about the wildfire risk story"
Agent: this is NOT a brain run — route to marketing_brain_skills/produce/SKILL.md.
```

---

## 5. Error handling

| error | handling |
|---|---|
| Weekly cycle API returns 5xx | Retry once after 30s. If still failing, surface the error to Matt with the HTTP status and response body. Do NOT proceed to dispatch. |
| Zero action rows after cycle | Report to Matt. Do not fabricate rows. Offer to run a dry-run with extended windowDays to see what signals exist. |
| Producer subagent times out (>30 min) | Mark that action row `status='killed'` with `executor_response={"kill_reason":"timeout"}`. Include in summary under FAILURES. |
| Supabase write fails on status update | Log the error. Continue with other subagents. Include in summary under FAILURES. |
| All producers fail | Surface the full failure report. Offer to retry individual producers. Do not commit. |

---

## 6. What is NOT a brain run

- "Make a listing video for 1234 NW Foo" → `marketing_brain_skills/produce/SKILL.md`
- "Update the home page copy" → `marketing_brain_skills/produce/SKILL.md`
- "Run the weekly cycle but don't dispatch anything" → dry-run mode (above)
- "Check the marketing dashboard" → `app/dashboard/marketing/page.tsx` (read-only)

---

## 7. See also

- `marketing_brain_skills/produce/SKILL.md` — direct producer invocation (bypasses cycle)
- `marketing_brain_skills/producers/REGISTRY.md` — producer lookup table
- `marketing_brain_skills/weekly-cycle/SKILL.md` — what the cycle does and returns
- `marketing_brain_skills/generate-briefs/SKILL.md` — how action rows are generated
- `automation_skills/content_engine/SKILL.md` — content action dispatch bus
- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
