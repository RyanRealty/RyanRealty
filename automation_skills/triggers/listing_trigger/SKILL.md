---
name: listing_trigger
description: New listing INSERT in Supabase fires a full content suite — video, 8 platform variants, scheduled posts, and thumbnail generation.
---

# Listing Trigger

## What it is

When a new listing lands in the `listings` table (via MLS sync or agent CRM webhook), this skill
fires a content pipeline: listing reveal video, earth zoom opener, 8 platform variants via
`repurpose_engine`, post scheduling via `post_scheduler`, and thumbnail queuing via
`thumbnail_generator`. It is the entry point for every new-listing content campaign. Idempotency
is enforced by hashing MLS# + status so re-syncs never double-fire.

## Trigger

Three paths — whichever fires first wins. All paths write to `automation_runs` before doing any
content work.

**Path A — Supabase Realtime (primary)**
```
Channel: realtime:public:listings
Event: INSERT
Filter: status=eq.Active
```
Handled in: `supabase/functions/listing-trigger/index.ts` (Supabase Edge Function)

**Path B — MLS/CRM webhook (secondary)**
```
POST /api/webhooks/listing-new
Header: x-webhook-secret: <WEBHOOK_SECRET>
Body: { mls_number, status, list_price, city, address, ... }
```
Route: `app/api/webhooks/listing-new/route.ts`

**Path C — Polling cron (safety net, every 15 min)**
```
GET /api/cron/listing-watch
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron schedule: */15 * * * *   (vercel.json)
```
Polls `listings` WHERE `inserted_at > now() - interval '20 minutes'` AND status = 'Active'
AND NOT EXISTS matching `automation_runs` row.

## Inputs

| Field | Type | Source |
|---|---|---|
| `mls_number` | text | `listings.mls_number` |
| `status` | text | `listings.status` |
| `list_price` | numeric | `listings.list_price` |
| `address` | text | `listings.address` |
| `city` | text | `listings.city` |
| `bedrooms` | integer | `listings.bedrooms` |
| `bathrooms` | numeric | `listings.bathrooms` |
| `sqft` | integer | `listings.sqft` |
| `photo_urls` | text[] | `listings.photo_urls` |
| `listing_id` | uuid | `listings.id` |

## Outputs

| Artifact | Destination |
|---|---|
| `automation_runs` row | Supabase — status tracking + idempotency |
| Content suite job | `content_jobs` table row per content type |
| `post_queue` rows (8) | Supabase — consumed by `post_scheduler` |
| Thumbnail generation job | `thumbnail_jobs` table row |

## Pipeline

1. **Receive event** from Realtime, webhook, or cron poll.

2. **Compute idempotency key**
   ```sql
   SELECT id FROM automation_runs
   WHERE trigger_type = 'listing_new'
     AND idempotency_key = md5(mls_number || '::' || status)
     AND created_at > now() - interval '7 days';
   ```
   If row exists: exit immediately (HTTP 200, body `{skipped: true}`).

3. **Write automation_runs row** (status = 'running')
   ```sql
   INSERT INTO automation_runs
     (trigger_type, idempotency_key, payload, status, created_at)
   VALUES
     ('listing_new', md5($mls_number || '::' || $status),
      $payload::jsonb, 'running', now())
   RETURNING id;
   ```

4. **Validate listing data** — confirm `photo_urls` has at least 12 entries. If fewer than 12,
   set `automation_runs.status = 'waiting_photos'` and halt. Cron will retry when count >= 12.

5. **Fire listing_reveal job**
   ```sql
   INSERT INTO content_jobs (listing_id, job_type, priority, status, created_at)
   VALUES ($listing_id, 'listing_reveal', 1, 'queued', now());
   ```
   Worker at `app/api/workers/content-job/route.ts` picks this up within 60 seconds.

6. **Fire earth_zoom job**
   ```sql
   INSERT INTO content_jobs (listing_id, job_type, priority, status, created_at)
   VALUES ($listing_id, 'earth_zoom', 2, 'queued', now());
   ```

7. **After both video jobs complete** (polled via `content_jobs.status = 'complete'`), invoke
   `repurpose_engine` with master video path + metadata:
   ```
   POST /api/workers/repurpose
   Body: { listing_id, master_video_url, copy_block, metadata }
   ```
   `repurpose_engine` writes 8 rows to `post_queue` directly (see `repurpose_engine` SKILL.md).

8. **Queue thumbnails**
   ```sql
   INSERT INTO thumbnail_jobs (listing_id, source_video_url, brief, status, created_at)
   VALUES ($listing_id, $master_video_url, $thumbnail_brief::jsonb, 'queued', now());
   ```

9. **Human review gate (first 30 days of any new listing format)**
   All `post_queue` rows for this listing start with `review_status = 'pending_human_review'`.
   After 30 days of a format running clean, auto-approve is unlocked per format via
   `automation_config.auto_approve_after_days`. See ANTI_SLOP_MANIFESTO rule 8.

10. **Update automation_runs**
    ```sql
    UPDATE automation_runs
    SET status = 'complete', completed_at = now(),
        output_summary = $summary::jsonb
    WHERE id = $run_id;
    ```

## Database schema

```sql
-- New tables required by this skill

CREATE TABLE IF NOT EXISTS automation_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type    text NOT NULL,           -- 'listing_new' | 'market_change' | 'trend_scan'
  idempotency_key text NOT NULL,
  payload         jsonb,
  status          text NOT NULL DEFAULT 'running',
                                           -- 'running' | 'complete' | 'failed' | 'skipped'
                                           -- | 'waiting_photos'
  error_message   text,
  output_summary  jsonb,
  verification_trace jsonb,               -- per-figure trace (CLAUDE.md requirement)
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  retries         integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS automation_runs_trigger_type_idx
  ON automation_runs (trigger_type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_idempotency_idx
  ON automation_runs (trigger_type, idempotency_key)
  WHERE status != 'skipped';

CREATE TABLE IF NOT EXISTS content_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid REFERENCES listings(id) ON DELETE CASCADE,
  run_id      uuid REFERENCES automation_runs(id),
  job_type    text NOT NULL,   -- 'listing_reveal' | 'earth_zoom' | 'repurpose' | 'data_viz_video'
  priority    integer NOT NULL DEFAULT 5,
  status      text NOT NULL DEFAULT 'queued',
                               -- 'queued' | 'running' | 'complete' | 'failed'
  input_payload  jsonb,
  output_payload jsonb,
  error_message  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  completed_at timestamptz,
  retries     integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS content_jobs_status_priority_idx
  ON content_jobs (status, priority, created_at)
  WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS thumbnail_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid REFERENCES listings(id) ON DELETE CASCADE,
  run_id            uuid REFERENCES automation_runs(id),
  source_video_url  text NOT NULL,
  brief             jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'queued',
  variants          jsonb,   -- array of {variant_id, url, prompt} after generation
  winner_variant_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 1 — No banned words** in any generated caption or VO copy: `stunning`, `nestled`,
  `boasts`, `gorgeous`, `breathtaking`, `must-see`. Enforced at `repurpose_engine` copy step.
- **Rule 7 — No unverified stats.** Listing price, bedrooms, bathrooms, sqft must match the
  `listings` row exactly. No interpolation.
- **Rule 8 — Human review gate.** All new listing formats require Matt's approval for the first
  30 days. `post_queue.review_status = 'pending_human_review'` blocks publish until approved
  at `/admin/post-queue`.
- **Rule 10 — Thumbnail accuracy.** Thumbnail brief pulled from actual listing data. No fake
  headlines, no AI-generated faces of Matt or any real person.

## Error handling + observability

**Retry policy:**
- Steps 1-4 (idempotency + validation): no retry, fail fast with clear error.
- Steps 5-8 (job creation): 3 retries with 30-second exponential backoff.
- If `content_jobs` worker fails after 3 retries: set `status = 'failed'`, write error to
  `automation_runs.error_message`, log to Sentry (`SENTRY_DSN`).

**Dead-letter:**
- `content_jobs` rows with `status = 'failed'` AND `retries >= 3` are the dead-letter queue.
- Cron at `/api/cron/dlq-review` (daily 6am PT) emails Matt a summary via Resend.

**Logging:**
- Every pipeline step writes a structured log line to stdout (Vercel captures these):
  ```json
  { "skill": "listing_trigger", "step": 5, "listing_id": "...", "status": "ok", "ms": 42 }
  ```
- Sentry breadcrumbs at each major step for distributed traces.

**Alerts:**
- `automation_runs` rows stuck in `running` for > 30 minutes: Sentry alert fires.

## Configuration

```typescript
// automation_skills/triggers/listing_trigger/config.ts
export const LISTING_TRIGGER_CONFIG = {
  // Minimum photos before firing content pipeline
  min_photos_required: 12,

  // How long (days) a new listing FORMAT requires human review before auto-approve
  auto_approve_after_days: 30,

  // Polling interval for the safety-net cron (minutes)
  cron_lookback_minutes: 20,

  // Cities this trigger watches (must match listings.city values)
  watched_cities: ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Prineville'],

  // Property types that trigger content (matches listings.property_type)
  watched_property_types: ['A'],   // 'A' = SFR per ORMLS convention
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for writes |
| `CRON_SECRET` | Bearer token for `/api/cron/*` routes |
| `WEBHOOK_SECRET` | HMAC secret for `/api/webhooks/listing-new` |
| `SENTRY_DSN` | Error tracking |

## Manual override / kill switch

**Kill switch (immediate halt):**
```sql
INSERT INTO automation_config (key, value, updated_at)
VALUES ('listing_trigger_enabled', 'false', now())
ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = now();
```
All three trigger paths check this flag on entry. False = exit immediately, no logging noise.

**Per-listing override:**
Matt can set `listings.automation_enabled = false` on any row to suppress the trigger for
that listing specifically.

**Admin dashboard override:**
`/admin/post-queue` shows all `pending_human_review` posts. Matt approves or rejects
individually. Rejected posts set `post_queue.review_status = 'rejected'` and never publish.

## See also

- `automation_skills/automation/repurpose_engine/SKILL.md` — 8-variant generation
- `automation_skills/automation/post_scheduler/SKILL.md` — drains `post_queue`
- `automation_skills/automation/thumbnail_generator/SKILL.md` — generates + A/B tests thumbnails
- `automation_skills/automation/ab_testing/SKILL.md` — thumbnail and copy variant testing
- `video_production_skills/listing_reveal/SKILL.md` — listing reveal video composition
- `video_production_skills/earth_zoom/SKILL.md` — earth zoom opener composition
- `video_production_skills/social_calendar/SKILL.md` — weekly calendar context
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — content quality rules
