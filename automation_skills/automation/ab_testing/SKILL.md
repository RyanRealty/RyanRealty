---
name: ab_testing
description: Generates and tracks variant combinations for thumbnails, hooks, captions, and CTAs using epsilon-greedy allocation; declares winners after minimum sample thresholds are met.
---

# A/B Testing

## What it is

The `ab_testing` skill manages multi-variant tests across thumbnails (4 variants), hook lines
(3), captions (3), and CTAs (2). It uses epsilon-greedy allocation: 70% of impressions route to
the current best-known variant, 30% explore alternatives. It monitors the primary metric for each
test type, applies a minimum sample threshold of 1,000 impressions per variant before declaring a
winner, and has a relative-ranking fallback for the low-volume reality of real estate content.
Winners feed back to `repurpose_engine` copy templates and `thumbnail_generator`.

## Trigger

**Invoked by other skills (not a cron):**
```
POST /api/workers/ab-test
Header: Authorization: Bearer <CRON_SECRET>
Body: AbTestRequest (see Inputs)
```

**Winner check cron (every 4 hours):**
```
GET /api/cron/ab-test-check
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: 0 */4 * * *
```

## Inputs

```typescript
interface AbTestRequest {
  test_type: 'thumbnail' | 'hook' | 'caption' | 'cta';
  parent_id: uuid;           // thumbnail_job_id | content_job_id | post_queue_id
  variants: AbVariant[];
  post_queue_ids: uuid[];    // post_queue rows that will carry these variants
  metric: 'ctr' | 'completion_rate' | 'save_share_rate' | 'fub_click_rate';
  min_impressions: number;   // default 1000 per variant
  test_duration_hours: number;  // default 24 for thumbnails, 72 for copy tests
  fallback_rule: 'relative_ranking' | 'first_variant';  // if min_impressions not met
}

interface AbVariant {
  id: string;       // 'v1' | 'v2' | 'v3' | 'v4' for thumbnails; 'h1'|'h2'|'h3' for hooks
  url?: string;     // for thumbnails
  text?: string;    // for copy variants
  metadata?: jsonb; // any extra context
}
```

## Outputs

| Artifact | Destination |
|---|---|
| Test record | `ab_tests` table |
| Variant records | `ab_test_variants` table |
| Winner declaration | `ab_winners` table + callback to caller |
| Copy template update | `engagement_templates.performance_score` updated |
| Thumbnail winner | `thumbnail_jobs.winner_variant_id` via callback |

## Pipeline

### Step 1 — Create test record

```sql
INSERT INTO ab_tests
  (test_type, parent_id, metric, min_impressions_per_variant,
   test_duration_hours, fallback_rule, status, allocation_strategy,
   started_at, created_at)
VALUES
  ($test_type, $parent_id, $metric, $min_impressions,
   $test_duration_hours, $fallback_rule, 'running', 'epsilon_greedy',
   now(), now())
RETURNING id;
```

### Step 2 — Create variant records

```sql
INSERT INTO ab_test_variants
  (ab_test_id, variant_id, variant_type, url, text_content,
   allocation_weight, impressions, metric_value, created_at)
SELECT
  $ab_test_id, v.id, $test_type, v.url, v.text,
  1.0 / count(*) OVER (),   -- equal start
  0, 0, now()
FROM unnest($variants) AS v;
```

### Step 3 — Assign variants to posts

For each `post_queue_id` in the request, assign a variant using epsilon-greedy:
```typescript
function pickVariant(variants: AbTestVariant[], epsilon: number = 0.3): string {
  const rand = Math.random();
  if (rand < epsilon) {
    // Explore: uniform random among non-best variants
    const nonBest = variants.filter(v => !v.is_current_best);
    return nonBest[Math.floor(Math.random() * nonBest.length)]?.id ?? variants[0].id;
  } else {
    // Exploit: pick current best (or first if no data yet)
    return variants.sort((a, b) => b.metric_value - a.metric_value)[0].id;
  }
}
```

For thumbnail tests: update `post_queue.cover_url` to the assigned variant URL.
For hook/caption tests: update `post_queue.caption` to the assigned variant text.
For CTA tests: update `post_queue.platform_metadata.cta_variant`.

Record assignment:
```sql
INSERT INTO ab_test_assignments
  (ab_test_id, post_queue_id, variant_id, assigned_at)
VALUES ($ab_test_id, $post_queue_id, $variant_id, now());
```

### Step 4 — Metric collection (called by performance_loop)

Every time `performance_loop` runs its weekly analytics pull, it also updates active A/B tests:

```typescript
// For each active ab_test, for each variant, aggregate metric from post_performance:
const metricQuery = {
  ctr: 'AVG(ctr)',
  completion_rate: 'AVG(completion_rate)',
  save_share_rate: 'AVG((saves + shares)::float / NULLIF(impressions, 0))',
  fub_click_rate: 'AVG(fub_clicks::float / NULLIF(impressions, 0))',
};

await supabase.rpc('update_ab_variant_metrics', {
  p_ab_test_id: test.id,
  p_metric_sql: metricQuery[test.metric],
});
```

```sql
-- Function: update_ab_variant_metrics
CREATE OR REPLACE FUNCTION update_ab_variant_metrics(
  p_ab_test_id uuid,
  p_metric_sql text
) RETURNS void AS $$
BEGIN
  UPDATE ab_test_variants atv
  SET metric_value = (
    SELECT AVG(pp.ctr)   -- parameterized in practice
    FROM ab_test_assignments ata
    JOIN post_performance pp ON pp.post_queue_id = ata.post_queue_id
    WHERE ata.ab_test_id = p_ab_test_id
      AND ata.variant_id = atv.variant_id
  ),
  impressions = (
    SELECT SUM(pp.impressions)
    FROM ab_test_assignments ata
    JOIN post_performance pp ON pp.post_queue_id = ata.post_queue_id
    WHERE ata.ab_test_id = p_ab_test_id
      AND ata.variant_id = atv.variant_id
  ),
  updated_at = now()
  WHERE atv.ab_test_id = p_ab_test_id;
END;
$$ LANGUAGE plpgsql;
```

### Step 5 — Winner check (every 4 hours via cron)

For each running test, check if winner conditions are met:

```typescript
async function checkWinner(test: AbTest): Promise<WinnerResult | null> {
  const variants = await getVariantsWithMetrics(test.id);

  // Case 1: All variants have min_impressions AND time elapsed
  const allMeetThreshold = variants.every(v => v.impressions >= test.min_impressions_per_variant);
  const timeExpired = Date.now() > new Date(test.started_at).getTime()
                      + test.test_duration_hours * 3600 * 1000;

  if (allMeetThreshold || timeExpired) {
    const winner = variants.sort((a, b) => b.metric_value - a.metric_value)[0];

    // For real estate low-volume reality: if impressions < 200 per variant after duration,
    // use relative ranking but mark confidence as 'low'
    const confidence = winner.impressions >= test.min_impressions_per_variant ? 'high' : 'low';

    return { winner_variant_id: winner.variant_id, confidence, sample_size: winner.impressions };
  }

  return null;
}
```

On winner declaration:
```sql
INSERT INTO ab_winners
  (ab_test_id, winner_variant_id, metric, metric_value,
   confidence, sample_size, declared_at)
VALUES
  ($test_id, $winner_id, $metric, $metric_value,
   $confidence, $sample_size, now());

UPDATE ab_tests SET status = 'complete', completed_at = now()
WHERE id = $test_id;
```

### Step 6 — Callback to caller

Fire callback based on `test_type`:

**Thumbnails:**
```
POST /api/workers/thumbnail-winner
Body: { thumbnail_job_id: parent_id, winner_variant_id, winner_url, confidence }
```

**Hook/Caption/CTA:**
Update `engagement_templates.performance_score` for the winning text variant.
Update `repurpose_engine` copy template defaults for future runs.

### Step 7 — Anti-engagement-bait check

Before declaring a winner, cross-check with `performance_loop` lead-capture data:
```typescript
// If test_type in ('caption', 'hook', 'cta'):
// Confirm winning variant also has FUB click rate >= median for the format.
// If a variant wins on saves/shares but has 0 FUB clicks: log warning, do NOT
// auto-promote it to default template. Flag for Matt's review.
const fubClickRate = await getFubClickRate(winner.variant_id);
if (fubClickRate === 0 && test.test_type !== 'thumbnail') {
  await flagForReview(winner, 'high_engagement_zero_leads');
}
```

## Database schema

```sql
CREATE TABLE IF NOT EXISTS ab_tests (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type                  text NOT NULL,
    -- 'thumbnail' | 'hook' | 'caption' | 'cta'
  parent_id                  uuid NOT NULL,
  metric                     text NOT NULL,
    -- 'ctr' | 'completion_rate' | 'save_share_rate' | 'fub_click_rate'
  min_impressions_per_variant integer NOT NULL DEFAULT 1000,
  test_duration_hours        integer NOT NULL DEFAULT 24,
  fallback_rule              text NOT NULL DEFAULT 'relative_ranking',
  allocation_strategy        text NOT NULL DEFAULT 'epsilon_greedy',
  epsilon                    numeric(4,3) NOT NULL DEFAULT 0.3,
  status                     text NOT NULL DEFAULT 'running',
    -- 'running' | 'complete' | 'cancelled'
  started_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ab_tests_status_idx
  ON ab_tests (status, started_at)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS ab_test_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id       uuid REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id       text NOT NULL,        -- 'v1' | 'v2' | 'h1' | 'h2' | etc.
  variant_type     text NOT NULL,
  url              text,
  text_content     text,
  metadata         jsonb,
  allocation_weight numeric(6,4) NOT NULL DEFAULT 0.25,
  impressions      bigint NOT NULL DEFAULT 0,
  metric_value     numeric(10,6) NOT NULL DEFAULT 0,
  is_current_best  boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ab_test_variants_test_idx
  ON ab_test_variants (ab_test_id, metric_value DESC);

CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id    uuid REFERENCES ab_tests(id) ON DELETE CASCADE,
  post_queue_id uuid REFERENCES post_queue(id) ON DELETE CASCADE,
  variant_id    text NOT NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ab_test_assignments_post_idx
  ON ab_test_assignments (ab_test_id, post_queue_id);

CREATE TABLE IF NOT EXISTS ab_winners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id        uuid REFERENCES ab_tests(id) ON DELETE CASCADE,
  winner_variant_id text NOT NULL,
  metric            text NOT NULL,
  metric_value      numeric(10,6),
  confidence        text NOT NULL,   -- 'high' | 'low'
  sample_size       bigint,
  declared_at       timestamptz NOT NULL DEFAULT now(),
  promoted_to_default boolean NOT NULL DEFAULT false,
    -- true when winner becomes the new default in copy templates
  override_reason   text            -- set if Matt overrides programmatic winner
);
CREATE INDEX IF NOT EXISTS ab_winners_test_idx
  ON ab_winners (ab_test_id);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 5 — No engagement-bait optimization.** Step 7 checks that winners drive lead capture,
  not just vanity engagement. A format that wins on saves but has zero FUB clicks is flagged,
  not promoted.
- **Rule 8 — Low-confidence winners marked.** When `confidence = 'low'` (insufficient data),
  `ab_winners.confidence = 'low'` is stored. `repurpose_engine` and `thumbnail_generator` treat
  low-confidence winners as tentative — they do not become permanent defaults until a second test
  confirms the finding.
- **No time-of-day bias.** Variant assignment shuffles post order so platform-slot timing is
  randomized across variants. Same day-of-week, different time slots.
- **Audit log.** Every winner declaration is a permanent row in `ab_winners`. Matt can always
  audit why a default was changed.

## Error handling + observability

- **No metrics after 72 hours:** test moves to `status = 'fallback'`, winner determined by
  highest relative `metric_value` regardless of `impressions`. Logged with `confidence = 'low'`.
- **Tie (within 2% relative difference):** `v1` wins (lowest-index variant), logged as tie.
- **Cron failure:** if winner-check cron misses a run, the next run catches up (checks all
  running tests, not just new ones).

Structured log:
```json
{ "skill": "ab_testing", "test_id": "...", "test_type": "thumbnail",
  "winner": "v3", "confidence": "high", "sample_size": 2140,
  "metric_value": 0.0842, "ms": 340 }
```

## Configuration

```typescript
export const AB_TESTING_CONFIG = {
  // Epsilon for exploration (0.3 = 30% random, 70% best)
  epsilon: 0.3,

  // Default min impressions before winner is declared
  default_min_impressions: 1000,

  // Fallback threshold — if impressions never reach min, use relative ranking after this many hours
  absolute_fallback_hours: 72,

  // Tie threshold — if top 2 variants are within this margin, call it a tie
  tie_margin_pct: 0.02,

  // Test durations by type (hours)
  default_durations: {
    thumbnail: 24,
    hook: 72,
    caption: 72,
    cta: 72,
  },

  // Require FUB click rate check before promoting copy winner
  require_fub_check_for_copy: true,
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `CRON_SECRET` | API route auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Database writes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |

## Manual override / kill switch

**Cancel a running test:**
```sql
UPDATE ab_tests SET status = 'cancelled', completed_at = now()
WHERE id = '<test-id>';
```

**Override winner manually:**
```
PATCH /api/admin/ab-winner
Body: { ab_test_id, winner_variant_id, override_reason }
```
This writes to `ab_winners.override_reason` and sets `winner_variant_id` to Matt's choice.

**Disable A/B testing entirely (use v1/h1 always):**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'ab_testing_enabled';
```

## See also

- `automation_skills/automation/thumbnail_generator/SKILL.md` — primary caller for thumbnails
- `automation_skills/automation/repurpose_engine/SKILL.md` — caller for hook/caption/CTA tests
- `automation_skills/automation/performance_loop/SKILL.md` — provides metric data
- `automation_skills/automation/post_scheduler/SKILL.md` — posts the variants
