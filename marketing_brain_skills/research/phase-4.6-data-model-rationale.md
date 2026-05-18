# Phase 4.6 Data Model Rationale

Source: `AUTONOMOUS_PIPELINE_BRIEF.md` Phase 4.6.
Drafted: 2026-05-16.
Status: awaiting Matt ratification before apply.

---

## Migration apply order

Apply these in strict numerical order. Later migrations reference tables or
columns from earlier ones.

| Order | File | Depends on |
|---|---|---|
| 1 | `20260516200000_marketing_brain_actions_upgrade.sql` | existing `marketing_brain_actions` table |
| 2 | `20260516200100_content_performance_upgrade.sql` | migration 1 (action_id FK) |
| 3 | `20260516200200_marketing_cost_ledger.sql` | migration 1 (action_id FK) |
| 4 | `20260516200300_producer_change_requests.sql` | none |
| 5 | `20260516200400_marketing_strategy.sql` | none (seed INSERT is WHERE NOT EXISTS) |
| 6 | `20260516200500_producer_execution_failures.sql` | migration 1 (action_id FK) |

---

## End-to-end data flow

```
run_brain (orchestrator, Opus)
  |
  | 1. Reads marketing_strategy (active row) for quarter targets
  | 2. Audits channels via marketing_channel_daily, content_performance
  | 3. Scores gaps: predicted_north_star_impact per action_type
  |
  v
marketing_brain_actions (one row per action)
  status=pending, priority_score set, predicted_north_star_impact set,
  cost_estimate_usd set, strategy_doc_section set
  |
  | content engine picks up pending rows ordered by priority_score DESC
  |
  v
producer SKILL.md (e.g. video_production_skills/listing_reveal)
  |
  | writes marketing_cost_ledger rows as it spends API quota
  | writes producer_execution_failures on any phase error
  | transitions action status: pending -> in_production -> ready
  |
  v
draft surface (out/ path, contact sheet URL)
  |
  | Matt reviews and says "ship it"
  |
  v
action status: ready -> approved -> executed
  |
  | publisher posts to platform, writes platform_post_id
  |
  v
content_performance (one row per platform snapshot)
  action_id FK, posted_at, metrics_48h, metrics_7d, metrics_30d set
  north_star_attributed_seller_leads updated by performance_loop
  asset_library_refs links which assets performed
  |
  | brain reads performance rows at next run_brain cycle
  | updates marketing_strategy.channel_targets based on results
  | updates asset.performance_score in asset_library
  v
marketing_strategy (quarter doc updated, or new draft for next quarter)
```

---

## Migration 1: marketing_brain_actions_upgrade

### What it adds

Ten new columns, two new indexes.

### Why each column exists

**priority_score** The brain ranks the pending queue by this. A listing that
expires in 3 days scores higher than evergreen content. The brain sets this at
action creation; the orchestrator reads it to decide dispatch order. The index
`idx_marketing_brain_actions_status_priority` makes the queue read a
single-column-scan.

**predicted_north_star_impact** The brain's estimate of how many qualified
seller leads this action will generate. After execution the brain compares
this against `north_star_attributed_seller_leads` from content_performance
and calibrates future predictions.

**comments** Review notes from Matt or the orchestrator during the
`needs_changes` loop. Each array element is a structured object so the
Catalog UI can thread the conversation.

Example payload:
```json
[
  {
    "author": "matt",
    "body": "Cut the price reveal to 3 seconds, it feels rushed.",
    "at": "2026-05-16T21:30:00Z"
  },
  {
    "author": "orchestrator",
    "body": "Updated beat 6 duration from 2.2s to 3.0s. Re-render queued.",
    "at": "2026-05-16T21:45:00Z"
  }
]
```

**scheduled_for** The column existed implicitly via `content_briefs.scheduled_for`
but was dropped during the rename migration. Re-adding it explicitly with an
index so the scheduler can efficiently query actions due in the next hour.

**cost_estimate_usd** The brain estimates API spend before committing to a
high-cost action (Kling v2.1 Master render, full Shutterstock license). Matt
can review cost before the action moves to `in_production`.

**failure_log** Mirror of `producer_execution_failures` at the action level.
The content engine writes a summary here after each failed phase so the
Catalog UI can show the action's health without a JOIN.

Example payload:
```json
[
  {
    "phase": "vo-synthesis",
    "error": "ElevenLabs 429: quota exhausted",
    "at": "2026-05-16T20:10:00Z",
    "retry": 1
  }
]
```

**assigned_approver** Defaults to `'matt'`. A future phase may route specific
action types to `'paul'` or `'rebecca'` (e.g. their own listing videos).

**killed_reason** Written when status transitions to `'killed'`. Preserves
the human-readable reason (e.g. "listing went pending before video rendered").

**strategy_doc_section** A string like `"§3.2 Instagram Reels cadence"` that
links the action back to the part of the strategy doc that triggered it.
Useful for auditing: if a strategy section is underperforming, Matt can filter
by this column to see all the actions it produced.

**needs_changes_at** Set when Matt reviews a draft and sends it back. The
orchestrator uses this as a retry trigger rather than polling all `ready` rows.

### Canonical query patterns

Queue read (orchestrator main loop):
```sql
SELECT *
FROM public.marketing_brain_actions
WHERE status = 'pending'
ORDER BY priority_score DESC NULLS LAST
LIMIT 5;
```

Scheduler read (actions due in next 30 minutes):
```sql
SELECT id, action_type, assigned_producer
FROM public.marketing_brain_actions
WHERE status = 'pending'
  AND scheduled_for BETWEEN now() AND now() + interval '30 minutes';
```

### Rollback

```sql
ALTER TABLE public.marketing_brain_actions
  DROP COLUMN IF EXISTS priority_score,
  DROP COLUMN IF EXISTS predicted_north_star_impact,
  DROP COLUMN IF EXISTS comments,
  DROP COLUMN IF EXISTS scheduled_for,
  DROP COLUMN IF EXISTS cost_estimate_usd,
  DROP COLUMN IF EXISTS failure_log,
  DROP COLUMN IF EXISTS assigned_approver,
  DROP COLUMN IF EXISTS killed_reason,
  DROP COLUMN IF EXISTS strategy_doc_section,
  DROP COLUMN IF EXISTS needs_changes_at;
DROP INDEX IF EXISTS idx_marketing_brain_actions_status_priority;
DROP INDEX IF EXISTS idx_marketing_brain_actions_scheduled;
```

---

## Migration 2: content_performance_upgrade

### What it adds

Nine new columns, two new indexes.

### Why each column exists

**action_id** The existing `brief_id` column references `marketing_brain_actions`
via the `content_briefs` view. The new `action_id` column references the
underlying table directly. Future code should use `action_id`; `brief_id` is
kept for backward compatibility with `performance_loop` code written before the
rename.

**post_external_id** Some platforms (LinkedIn, YouTube) issue a separate
external post ID at publish time that differs from the internal
`platform_post_id`. Keeping both avoids losing the platform-issued identifier.

**posted_at** Semantic alias for `published_at` used by new publisher code.
Keeping both to avoid a breaking rename; `posted_at` is the canonical field
for Phase 4.6+ code.

**metrics_48h / metrics_7d / metrics_30d** Snapshot JSONB columns for each
major measurement window. The performance_loop writes these at 48h, 7d, and
30d after post. This avoids needing to join multiple measured_at rows to get
the 7-day snapshot; the columns are queryable directly.

Example payload (metrics_7d):
```json
{
  "impressions": 12400,
  "reach": 9800,
  "views": 8200,
  "watch_time_seconds": 41000,
  "saves": 312,
  "shares": 87,
  "attributed_leads": 2,
  "pulled_at": "2026-05-23T09:15:00Z"
}
```

**north_star_attributed_seller_leads** Integer count of seller leads directly
traced to this post via FUB source attribution. This is the brain's primary
learning signal. Defaults to 0; updated by the performance_loop when a FUB
contact's first_source_url matches the post's platform URL.

**asset_library_refs** Array of `asset_library.id` UUIDs used in this post.
After enough data accumulates the brain can query which assets correlate with
high `north_star_attributed_seller_leads`.

Example payload:
```json
["3f2a1e9b-...", "a1b2c3d4-..."]
```

**pulled_at** Timestamp of the last performance_loop refresh. The scheduler
uses this to determine which rows need a new pull (e.g. any row where
`pulled_at < now() - interval '6 hours'` and `posted_at > now() - interval '30 days'`).

### Canonical query patterns

Performance digest (brain learning cycle):
```sql
SELECT
  a.action_type,
  a.assigned_producer,
  p.platform,
  p.metrics_7d,
  p.north_star_attributed_seller_leads
FROM public.content_performance p
JOIN public.marketing_brain_actions a ON a.id = p.action_id
WHERE p.posted_at > now() - interval '90 days'
ORDER BY p.north_star_attributed_seller_leads DESC;
```

Asset performance join:
```sql
SELECT a.id, a.geo_tags, a.subject_tags,
       avg(p.north_star_attributed_seller_leads) AS avg_leads
FROM public.content_performance p,
     unnest(p.asset_library_refs) AS ref_id
JOIN public.asset_library a ON a.id = ref_id::uuid
GROUP BY a.id, a.geo_tags, a.subject_tags
ORDER BY avg_leads DESC;
```

### Rollback

```sql
ALTER TABLE public.content_performance
  DROP COLUMN IF EXISTS action_id,
  DROP COLUMN IF EXISTS post_external_id,
  DROP COLUMN IF EXISTS posted_at,
  DROP COLUMN IF EXISTS metrics_48h,
  DROP COLUMN IF EXISTS metrics_7d,
  DROP COLUMN IF EXISTS metrics_30d,
  DROP COLUMN IF EXISTS north_star_attributed_seller_leads,
  DROP COLUMN IF EXISTS asset_library_refs,
  DROP COLUMN IF EXISTS pulled_at;
DROP INDEX IF EXISTS idx_cp_platform_posted;
DROP INDEX IF EXISTS idx_cp_action_id;
```

---

## Migration 3: marketing_cost_ledger

### What it adds

New table with two indexes.

### Why it exists

The autonomous pipeline spends real money on every action. Without a ledger
the brain cannot answer "how much did Q3 content spend?" or "is Replicate
cost trending up?" The ledger is append-only (producers only INSERT; never
UPDATE or DELETE). The `marketing_brain_actions.cost_estimate_usd` column
is the pre-spend estimate; this table is the actuals.

### Example payload (metadata column)

Anthropic tokens row:
```json
{
  "model": "claude-opus-4-7",
  "input_tokens": 14200,
  "output_tokens": 3100,
  "cache_read_tokens": 8900,
  "action_phase": "storyboard"
}
```

Replicate row:
```json
{
  "model": "kling-v2.1-master",
  "prediction_id": "abc123xyz",
  "duration_sec": 8,
  "resolution": "1080x1920"
}
```

### Canonical query patterns

Weekly cost by type:
```sql
SELECT cost_type,
       sum(amount_usd)     AS total_usd,
       count(*)            AS calls
FROM public.marketing_cost_ledger
WHERE recorded_at > now() - interval '7 days'
GROUP BY cost_type
ORDER BY total_usd DESC;
```

Cost per action:
```sql
SELECT action_id,
       sum(amount_usd) AS total_usd
FROM public.marketing_cost_ledger
GROUP BY action_id
ORDER BY total_usd DESC
LIMIT 20;
```

### Rollback

```sql
DROP TABLE IF EXISTS public.marketing_cost_ledger;
```

---

## Migration 4: producer_change_requests

### What it adds

New table with two indexes.

### Why it exists

The Phase 10.5 Catalog UI lets Matt browse all producers and file change
requests without writing a prompt. The orchestrator watches for `pending` rows
and dispatches a skill-author subagent. This decouples the human change
request from the agent execution timing.

### Example payload (metadata column)

```json
{
  "current_skill_path": "video_production_skills/listing_reveal/SKILL.md",
  "target_line_range": "§4 Recipe, steps 3-5",
  "example_output_path": "out/school-house-rd-v7/school_house_rd.mp4"
}
```

### Canonical query patterns

Catalog UI: open requests for a producer:
```sql
SELECT *
FROM public.producer_change_requests
WHERE producer_slug = 'listing_reveal'
  AND status NOT IN ('approved', 'rejected')
ORDER BY requested_at DESC;
```

Orchestrator: pending requests to dispatch:
```sql
SELECT *
FROM public.producer_change_requests
WHERE status = 'pending'
ORDER BY requested_at ASC
LIMIT 10;
```

### Rollback

```sql
DROP TABLE IF EXISTS public.producer_change_requests;
```

---

## Migration 5: marketing_strategy

### What it adds

New table with one index plus a seed INSERT for Q3 2026.

### Why it exists

Without a persistent strategy row the brain has no authoritative record of
what quarter it is optimizing for, what the north_star_target is, or which
channel weighting applies. The `strategy_doc_section` column on
`marketing_brain_actions` references the active strategy row's doc; this
table is the source that makes that reference meaningful.

### Example payload (channel_targets column)

```json
{
  "ig_reels": {
    "posts_per_week": 5,
    "north_star_weight": 0.35
  },
  "yt_shorts": {
    "posts_per_week": 3,
    "north_star_weight": 0.20
  },
  "fb_reels": {
    "posts_per_week": 3,
    "north_star_weight": 0.15
  },
  "email": {
    "sends_per_month": 2,
    "north_star_weight": 0.20
  },
  "blog": {
    "posts_per_month": 4,
    "north_star_weight": 0.10
  }
}
```

### Seed INSERT idempotency

The INSERT uses `WHERE NOT EXISTS` on `(quarter, generated_by)` rather than
`ON CONFLICT DO NOTHING` because there is no unique constraint on those
columns (multiple draft strategies for the same quarter are allowed). The
WHERE NOT EXISTS guard makes the seed idempotent if the migration is re-run.

### Canonical query patterns

Active strategy for orchestrator:
```sql
SELECT *
FROM public.marketing_strategy
WHERE status = 'active'
ORDER BY generated_at DESC
LIMIT 1;
```

Full history chain:
```sql
SELECT id, quarter, status, generated_at, generated_by
FROM public.marketing_strategy
ORDER BY generated_at DESC;
```

### Rollback

```sql
DELETE FROM public.marketing_strategy WHERE generated_by = 'phase-5b-orchestrator';
DROP TABLE IF EXISTS public.marketing_strategy;
```

---

## Migration 6: producer_execution_failures

### What it adds

New table with two indexes.

### Why it exists

`marketing_brain_actions.failure_log` is a JSONB summary for quick reads.
This table is the normalized audit trail: one row per failure event, with the
full error stack. The content engine writes here on every caught exception.
The orchestrator reads `retry_count` to decide whether to retry or kill. The
Catalog UI surfaces unresolved failures grouped by producer.

### Example payload (full row)

```
producer_slug:    'video_production_skills/listing_reveal'
phase:            'remotion-render'
error_message:    'Chrome OOM: concurrency exceeded'
error_stack:      '...'
occurred_at:      2026-05-16T22:05:00Z
retry_count:      1
resolved_at:      null
resolution_note:  null
```

### Canonical query patterns

Orchestrator retry check:
```sql
SELECT id, producer_slug, phase, retry_count
FROM public.producer_execution_failures
WHERE action_id = $1
  AND resolved_at IS NULL
ORDER BY occurred_at DESC
LIMIT 1;
```

Weekly failure digest by producer:
```sql
SELECT producer_slug,
       count(*) FILTER (WHERE resolved_at IS NULL) AS unresolved,
       count(*)                                    AS total,
       max(occurred_at)                            AS last_failure
FROM public.producer_execution_failures
WHERE occurred_at > now() - interval '7 days'
GROUP BY producer_slug
ORDER BY unresolved DESC;
```

### Rollback

```sql
DROP TABLE IF EXISTS public.producer_execution_failures;
```

---

## Asset library manifest schema upgrade

### New fields added to schema.json and AssetRecord JSDoc

| Field | Type | Purpose |
|---|---|---|
| `tags` | `string[]` | General-purpose freeform tags beyond geo/subject. Example: `["hero-candidate", "aerial-only"]`. |
| `performance_score` | `number or null` | 0..1 score derived from content_performance rows. Updated by the performance_loop after sufficient data accumulates. |
| `surface` | `string enum` | Primary platform surface the asset targets. 25 values covering every Ryan Realty distribution channel. |
| `asset_type` | `string enum` | Structural type (image, video, document, audio, model3d, floor_plan, overlay). More granular than the legacy `type` field. |
| `fingerprint` | `string` | SHA-256 hex of the raw file bytes. Enables content-addressed deduplication: a second register() call for a byte-identical file returns the existing asset. |
| `last_used_at` | `string or null` | Already existed in the JS code but was absent from schema.json. Now formally documented. |
| `originated_from_action_id` | `string or null` | Links a producer-generated asset back to the brain action that commissioned it. null for external sources. |

### Backward compatibility

All new fields are optional in schema.json (`required` array is unchanged).
Existing manifest rows remain valid with the new fields absent; they read as
`undefined` in JS and `null` in Postgres. No existing row is mutated beyond
what the producer code explicitly sets on future register() calls.

The `register()` function in `lib/asset-library.mjs` does not yet compute
`fingerprint` automatically; a follow-on PR should add
`createHash('sha256').update(buf).digest('hex')` at registration time using
the `createHash` import that is already present in the module.

---

## JSONB column summary

| Table | Column | Example payload location |
|---|---|---|
| `marketing_brain_actions` | `comments` | Migration 1 rationale section |
| `marketing_brain_actions` | `failure_log` | Migration 1 rationale section |
| `content_performance` | `metrics_7d` | Migration 2 rationale section |
| `content_performance` | `asset_library_refs` | Migration 2 rationale section |
| `marketing_cost_ledger` | `metadata` | Migration 3 rationale section |
| `producer_change_requests` | `metadata` | Migration 4 rationale section |
| `marketing_strategy` | `channel_targets` | Migration 5 rationale section |

---

## What is NOT in these migrations

The following are intentionally deferred to a later phase:

- `asset_library` Postgres table (exists from existing migrations; schema.json
  is the JSON Schema equivalent).
- RLS policies on the two ALTER migrations (the existing tables already have
  their policies; the new columns inherit them automatically).
- `marketing_strategy` unique constraint on `(quarter, status='active')` -- this
  is enforced at the application level by the orchestrator for now, pending a
  decision on whether multiple active strategies per quarter will ever be needed.
