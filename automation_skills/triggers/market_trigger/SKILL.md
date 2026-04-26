---
name: market_trigger
description: Nightly cron compares market_pulse_live stats vs prior 7 days; if any tracked metric moves >5% fires a data_viz_video and avatar_market_update with full data verification trace.
---

# Market Trigger

## What it is

The `market_trigger` runs nightly at 2am PT. It pulls the current 7-day window from
`market_pulse_live` for each tracked geography, compares each metric to the prior 7-day window,
and fires a `data_viz_video` and `avatar_market_update` job if any metric crosses its configured
threshold. Every comparison produces a verification trace (per CLAUDE.md mandate) before any
content is queued. De-duplication prevents re-firing on the same metric within 7 days unless
the change doubles.

All market data traces to Supabase `ryan-realty-platform` `market_pulse_live` table. No
LLM-recalled numbers. No hard-coded stats. Every figure in every video produced by this trigger
is verified against a fresh database query with full source documentation.

## Trigger

```
GET /api/cron/market-trigger
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: 0 9 * * *   (2am PT = 9am UTC, year-round safe)
```

## Inputs

Reads from `market_pulse_live` via Supabase service client:
```sql
-- Current 7-day snapshot per geography
SELECT
  geo_type, geo_slug,
  median_list_price, median_close_price, median_days_to_pending,
  active_count, months_of_supply, absorption_rate_pct,
  pending_to_active_ratio, median_sale_to_list,
  pct_sold_over_asking, price_reduction_share,
  computed_at
FROM market_pulse_live
WHERE geo_type IN ('city', 'region')
  AND geo_slug IN ('bend', 'redmond', 'sisters', 'sunriver', 'central-oregon')
ORDER BY geo_slug, computed_at DESC;
```

Prior 7-day snapshot: pulled from `market_trigger_snapshots` table (written on each run).

## Outputs

| Artifact | Destination |
|---|---|
| Trigger fire record | `automation_runs` row with full verification_trace |
| `data_viz_video` job | `content_jobs` row |
| `avatar_market_update` job | `content_jobs` row |
| Snapshot archive | `market_trigger_snapshots` row |
| De-dupe record | `market_trigger_cooldowns` row |

## Pipeline

### Step 1 — Pull current snapshot

```typescript
const supabase = createServiceClient();
const { data: currentSnapshot, error } = await supabase
  .from('market_pulse_live')
  .select('*')
  .in('geo_slug', TRIGGER_CONFIG.watched_geos)
  .order('computed_at', { ascending: false });

if (error) throw new Error(`market_pulse_live fetch failed: ${error.message}`);
```

Dedup to latest row per geo:
```typescript
const latestPerGeo = Object.fromEntries(
  currentSnapshot.map(row => [row.geo_slug, row])
);
```

### Step 2 — Pull prior snapshot (7 days ago)

```sql
SELECT * FROM market_trigger_snapshots
WHERE geo_slug = $geo_slug
  AND snapshot_at >= now() - interval '8 days'
  AND snapshot_at < now() - interval '6 days'
ORDER BY snapshot_at DESC
LIMIT 1;
```

If no prior snapshot exists (first run or gap): write current as baseline and exit.
No content fires without a comparison baseline.

### Step 3 — Compare metrics against per-metric thresholds

```typescript
const METRIC_THRESHOLDS: Record<string, number> = {
  median_close_price:     0.05,   // 5% move fires
  median_days_to_pending: 0.15,   // 15% move fires (higher = more volatile)
  active_count:           0.10,   // 10% inventory change fires
  months_of_supply:       0.10,   // 10% move fires
  absorption_rate_pct:    0.10,
  pending_to_active_ratio: 0.10,
  median_sale_to_list:    0.02,   // 2% = meaningful for sale-to-list
  pct_sold_over_asking:   0.10,
  price_reduction_share:  0.10,
};

interface MetricFire {
  metric: string;
  geo_slug: string;
  current_value: number;
  prior_value: number;
  pct_change: number;
  direction: 'up' | 'down';
}

function detectFires(
  current: MarketPulseRow,
  prior: MarketPulseRow,
  geoSlug: string
): MetricFire[] {
  const fires: MetricFire[] = [];
  for (const [metric, threshold] of Object.entries(METRIC_THRESHOLDS)) {
    const curr = current[metric] as number;
    const prev = prior[metric] as number;
    if (!curr || !prev || prev === 0) continue;
    const pctChange = Math.abs((curr - prev) / prev);
    if (pctChange >= threshold) {
      fires.push({
        metric, geo_slug: geoSlug,
        current_value: curr, prior_value: prev,
        pct_change: pctChange,
        direction: curr > prev ? 'up' : 'down',
      });
    }
  }
  return fires;
}
```

### Step 4 — De-duplication check

For each fire candidate, check `market_trigger_cooldowns`:
```sql
SELECT id, threshold_used FROM market_trigger_cooldowns
WHERE metric = $metric
  AND geo_slug = $geo_slug
  AND fired_at > now() - interval '7 days';
```

If a cooldown row exists AND the new `pct_change < prior_threshold_used * 2`:
Skip this metric. Already covered.

If `pct_change >= prior_threshold_used * 2`: allow re-fire (2x the original move).

### Step 5 — Build verification trace (CLAUDE.md mandatory)

For every metric that passes the de-dupe check, build the verification trace before any content
job is created:
```typescript
const trace = {
  stat: `${metric} = ${current_value}`,
  source: `Supabase market_pulse_live`,
  geo: geo_slug,
  query_window: `computed_at: ${current.computed_at}`,
  table: 'market_pulse_live',
  filter: `geo_slug='${geo_slug}', geo_type='city'`,
  raw_value: current_value,
  prior_value: prior_value,
  pct_change: `${(pct_change * 100).toFixed(1)}%`,
  direction: direction,
  comparison_snapshot: prior.snapshot_at,
};
```

### Step 6 — Write automation_runs with verification_trace

```sql
INSERT INTO automation_runs
  (trigger_type, idempotency_key, payload, status, verification_trace, created_at)
VALUES
  ('market_change',
   md5($geo_slug || '::' || $metric || '::' || date_trunc('day', now())::text),
   $payload::jsonb,
   'running',
   $verification_trace::jsonb,
   now())
RETURNING id;
```

### Step 7 — Fire content jobs

For each confirmed fire (per geo, deduplicated to the single biggest-move metric per geo to
avoid flooding):
```sql
-- data_viz_video: market update video featuring the changed metric as headline
INSERT INTO content_jobs
  (run_id, job_type, priority, status, input_payload, created_at)
VALUES
  ($run_id, 'data_viz_video', 1, 'queued', $job_payload::jsonb, now());

-- avatar_market_update: weekly cadence talking-head update (if within weekly window)
INSERT INTO content_jobs
  (run_id, job_type, priority, status, input_payload, created_at)
VALUES
  ($run_id, 'avatar_market_update', 2, 'queued', $job_payload::jsonb, now());
```

`$job_payload` includes:
```json
{
  "headline_metric": "median_close_price",
  "headline_value": 487500,
  "headline_pct_change": 6.2,
  "direction": "up",
  "geo_slug": "bend",
  "geo_label": "Bend",
  "verification_trace": { ... },
  "market_classification": "seller",
  "months_of_supply": 3.1,
  "comparison_label": "vs last week"
}
```

Market classification MUST be derived from `months_of_supply`:
```typescript
function classifyMarket(mos: number): 'seller' | 'balanced' | 'buyer' {
  if (mos <= 4) return 'seller';
  if (mos <= 6) return 'balanced';
  return 'buyer';
}
```
A "seller's market" verdict is prohibited next to a months_of_supply >= 4.0. The narrative
follows the data, not the other way around.

### Step 8 — Write cooldown and snapshot

```sql
INSERT INTO market_trigger_cooldowns
  (metric, geo_slug, pct_change_observed, threshold_used,
   direction, fired_at, run_id)
VALUES
  ($metric, $geo_slug, $pct_change, $threshold_used,
   $direction, now(), $run_id);

INSERT INTO market_trigger_snapshots
  (geo_slug, geo_type, snapshot_data, snapshot_at)
SELECT
  geo_slug, geo_type, row_to_json(mpl)::jsonb, now()
FROM market_pulse_live mpl
WHERE geo_slug = $geo_slug;
```

### Step 9 — Update automation_runs to complete

```sql
UPDATE automation_runs
SET status = 'complete', completed_at = now(),
    output_summary = $summary::jsonb
WHERE id = $run_id;
```

## Database schema

```sql
CREATE TABLE IF NOT EXISTS market_trigger_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_slug      text NOT NULL,
  geo_type      text NOT NULL,
  snapshot_data jsonb NOT NULL,
  snapshot_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_trigger_snapshots_geo_time_idx
  ON market_trigger_snapshots (geo_slug, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS market_trigger_cooldowns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric                text NOT NULL,
  geo_slug              text NOT NULL,
  pct_change_observed   numeric(8,4) NOT NULL,
  threshold_used        numeric(8,4) NOT NULL,
  direction             text NOT NULL,   -- 'up' | 'down'
  fired_at              timestamptz NOT NULL DEFAULT now(),
  run_id                uuid REFERENCES automation_runs(id)
);
CREATE INDEX IF NOT EXISTS market_trigger_cooldowns_lookup_idx
  ON market_trigger_cooldowns (metric, geo_slug, fired_at DESC);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **CLAUDE.md data accuracy rule — primary enforcement point.** No content job fires without
  a written verification trace (Step 5). Every figure in the job payload must trace to a specific
  `market_pulse_live` row with `computed_at` timestamp and `geo_slug` filter documented.
- **Market classification matches data.** Seller/balanced/buyer label derived from
  `months_of_supply` via the `classifyMarket()` function. Hard failure if label contradicts data.
- **No LLM-recalled stats.** All values come from fresh Supabase query in this run. Prior-session
  numbers are never used.
- **Rule 4 — Reconcile narrative to data.** The `data_viz_video` job receives the metric value,
  the direction, the pct_change, and the verification trace as required inputs. The video
  composition reads from these — not from hard-coded values.
- **No fire without prior baseline.** Step 2 requires a prior snapshot. No first-run content.

## Error handling + observability

- **`market_pulse_live` fetch error:** abort run, write `automation_runs.status = 'failed'`,
  send Resend alert to Matt. Do not fire content with stale data.
- **Partial geo failure:** if 3 of 5 geos return data, process the 3 and log the 2 failures.
  Do not hold back good data.
- **Content job queue failure:** automation_runs records the fire; job can be manually
  re-queued via `/api/workers/requeue?job_type=data_viz_video&run_id=...`.

Structured log:
```json
{ "skill": "market_trigger", "geos_checked": 5, "fires": 2,
  "metrics_fired": ["median_close_price::bend", "active_count::redmond"],
  "cooldowns_applied": 1, "ms": 2140 }
```

## Configuration

```typescript
export const MARKET_TRIGGER_CONFIG = {
  watched_geos: ['bend', 'redmond', 'sisters', 'sunriver', 'central-oregon'],

  metric_thresholds: {
    median_close_price:      0.05,
    median_days_to_pending:  0.15,
    active_count:            0.10,
    months_of_supply:        0.10,
    absorption_rate_pct:     0.10,
    pending_to_active_ratio: 0.10,
    median_sale_to_list:     0.02,
    pct_sold_over_asking:    0.10,
    price_reduction_share:   0.10,
  },

  // Re-fire multiplier: re-fire if change >= prior_threshold * this value
  refire_multiplier: 2.0,

  // Cooldown window (days)
  cooldown_days: 7,

  // Max content jobs fired per run (prevent flooding)
  max_fires_per_run: 3,

  // Per-geo: only fire on the single largest-magnitude change
  one_fire_per_geo: true,
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | market_pulse_live read + automation_runs write |
| `CRON_SECRET` | Cron auth |
| `ALERT_EMAIL` | Matt's email for failure alerts |

## Manual override / kill switch

**Kill trigger:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'market_trigger_enabled';
```

**Kill one geo:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'market_trigger_geo_redmond_enabled';
```

**Reset a cooldown (allow re-fire sooner):**
```sql
DELETE FROM market_trigger_cooldowns
WHERE metric = 'median_close_price' AND geo_slug = 'bend';
```

**Force-fire a specific metric (for testing or manual campaign):**
```
POST /api/workers/market-trigger-force
Header: Authorization: Bearer <CRON_SECRET>
Body: { metric: 'median_close_price', geo_slug: 'bend', skip_cooldown: true }
```

## See also

- `automation_skills/automation/post_scheduler/SKILL.md` — posts the resulting videos
- `automation_skills/automation/repurpose_engine/SKILL.md` — makes 8 variants of market video
- `video_production_skills/data_viz_video/SKILL.md` — video composition for market metrics
- `video_production_skills/avatar_market_update/SKILL.md` — talking-head market update
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — accuracy and voice rules
- CLAUDE.md — data accuracy verification mandate (root rule)
