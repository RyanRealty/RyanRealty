---
name: marketing-brain-run
description: >
  Top-level marketing brain invocation. Files action rows from the weekly
  cycle. Does not dispatch producers. Media production is Studio
  (CLAUDE.md §4). Use when Matt says "run the brain", "run the marketing
  brain", "marketing brain please", "what should we make this week",
  "/marketing-brain", "brain please", "brain run", "weekly brain", or
  any equivalent.
action_types: []
---

# STOP. File a row. Run no producer.

Hourly SKILL.md producers are off (CLAUDE.md §5, 2026-08-18). This skill may
run the weekly cycle and insert `marketing_brain_actions` rows. It does not
dispatch producers. Do not spawn producer subagents. Do not load
`video_production_skills/**`. Do not treat `automation_skills/content_engine`
as a video factory.

**Media / social production is the Studio:** `lib/studio/`, `/admin/studio`.
The slate cron is off. Drafts land `ready`. Matt's §1 stamp plus
`/api/cron/publisher-sweep` → `/api/social/publish`.

CMA, newsletter, CRM, and the Facebook seller report stay as TypeScript
products. Voice: `marketing_brain_skills/brand-voice/VOICE.md`.

# Marketing Brain.  Run

**Scope:** Single entry point for a brain pass. Calls `runWeeklyCycle()` if
Matt asked for the weekly look, reads pending action rows, surfaces them.
Nothing is committed or published without Matt's explicit approval.

**Status:** Canonical. Locked 2026-09-05 to CLAUDE.md §5.

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

For a one-off media request, open Studio (`/admin/studio`). Do not route
through `marketing_brain_skills/produce/` as a factory.

---

## 2. Required reading before executing

| Reference | Why |
|---|---|
| `CLAUDE.md` §0. Data Accuracy | Every stat traces to a verified source |
| `CLAUDE.md` §4. Studio | Live media path |
| `CLAUDE.md` §5. Producer runtime retired | File a row, run no producer |
| `marketing_brain_skills/weekly-cycle/SKILL.md` | What `runWeeklyCycle()` does |
| `marketing_brain_skills/generate-briefs/SKILL.md` | How action rows are written |

---

## 3. Procedure

### Step 0. Record cycle start time

```typescript
const cycle_started_at = new Date().toISOString()
```

### Step 1. Run the weekly cycle (if Matt asked for a cycle)

```sh
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-weekly-cycle?asOfDate=<yesterday>&dryRun=false&windowDays=7"
```

Or call `runWeeklyCycle({ asOfDate, dryRun: false })` from TypeScript at
`lib/marketing-brain/weekly-cycle.ts`.

**DryRun mode:** If Matt says "dry run", pass `dryRun=true`. Surface the
would-be action list and stop. Nothing dispatches.

**Custom date:** If Matt specifies a date, pass it as `asOfDate`. Defaults
to yesterday UTC. `windowDays` defaults to 7. Never exceed 90.

### Step 2. Read new pending action rows

```sql
SELECT id, action_type, target, assigned_producer, payload, generation_reason, status
FROM public.marketing_brain_actions
WHERE status = 'pending'
  AND created_at >= '<cycle_started_at>'
ORDER BY created_at;
```

**If 0 rows:** Surface the cycle summary. Do not fabricate action items.

**If rows exist:** List them. Do not dispatch.

### Step 3. Do not dispatch producers

Content, site, ops, comms, and analyze rows stay `pending`. Inbox and
`/marketing/request` already file a row and stop. This skill does the same.

If a row is media (`content:*` video / reel / social motion): tell Matt the
live path is Studio (`/admin/studio`). Do not invoke a producer SKILL.md.

If a row is CMA / newsletter / CRM / Facebook seller report: those are
TypeScript products, not SKILL.md producers.

### Step 4. Compose the summary report

Surface ONE message to Matt:

```
Marketing Brain.  Run Complete
Cycle date: <as_of_date> | Generated: <iso_timestamp>

CYCLE STATS
  Channels diagnosed: <N>
  Action rows filed: <N> (pending; no producer ran)
  Voice failures: <N>
  Cycle errors: <error count>

ROWS FILED (not produced)

  [1] <action_type>.  <target>
      Reason: <generation_reason>
      Action row: <id>
      Next: Studio for media, or the matching TypeScript product

MEDIA
  Production is Studio (`/admin/studio`). Publish is publisher-sweep
  after Matt's §1 stamp. Do not load video_production_skills.

Reply:
  "open studio" / "kill [1]" / "leave pending"
```

Then STOP. Do not commit. Do not push. Do not move files from `out/` to
`public/`. Do not set `approved` or `executed`.

### Step 5. On rejection

When Matt says "kill [N]":
- UPDATE `status='killed'`, `executor_response={"kill_reason":"<Matt's words>"}`

When Matt says "redo" or "make the video":
- Open Studio. Do not reset the row into a producer dispatch.

---

## 4. Invocation variants

### Dry run

```
Matt: "run the brain dry"
Agent: cycle with dryRun=true; surface would-be rows; no dispatch.
```

### Specific date

```
Matt: "run the brain as of last Monday"
Agent: pass asOfDate=YYYY-MM-DD
```

### Force a video

```
Matt: "brain, I need a news clip about the wildfire risk story"
Agent: this is NOT a producer run. Open Studio (CLAUDE.md §4).
```

---

## 5. Error handling

| error | handling |
|---|---|
| Weekly cycle API returns 5xx | Retry once after 30s. If still failing, surface the error. Do not invent rows. |
| Zero action rows after cycle | Report to Matt. Do not fabricate rows. |
| Agent starts loading a producer SKILL.md | Stop. File-a-row rule outranks the old dispatch recipe. |

---

## 6. What is NOT a brain run

- "Make a listing video for 1234 NW Foo" → Studio (`/admin/studio`)
- "Update the home page copy" → site code, not a producer
- "Check the marketing dashboard" → `app/dashboard/marketing/page.tsx` (read-only)

---

## 7. See also

- `CLAUDE.md` §4. Studio
- `CLAUDE.md` §5. Producer runtime retired
- `marketing_brain_skills/inbox/SKILL.md`. Same rule: file a row, run no producer
- `automation_skills/content_engine/SKILL.md`. STOP stub for the retired video matrix
- `automation_skills/automation/publish/SKILL.md`. publisher-sweep
- `CLAUDE.md` §0. Data Accuracy
