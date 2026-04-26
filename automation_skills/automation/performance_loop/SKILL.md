---
name: performance_loop
description: Weekly cron pulls platform analytics for all posts in the last 7 days, scores them by weighted formula, tags by format, updates format_performance table, and shifts next week's content mix toward proven winners.
---

# Performance Loop

## What it is

The `performance_loop` runs every Sunday at 6am PT. It pulls IG Insights, TikTok Analytics,
YouTube Studio metrics, and LinkedIn analytics for every post published in the last 7 days,
scores each post on a weighted formula, and writes to `format_performance`. It then computes
the last-30/60/90 day P50/P90 by format type and produces next week's recommended content mix.
The mix shifts toward proven formats (40% top-quartile, 30% second, 20% experimentation, 10%
retest of bottom) but never optimizes for engagement bait over lead capture. Every mix decision
is logged.

## Trigger

```
GET /api/cron/performance-loop
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: 0 6 * * 0   (every Sunday 6am UTC — adjust for PT offset in cron config)
```

PT is UTC-7 (PDT) or UTC-8 (PST). Run at `0 13 * * 0` UTC to hit 6am PT reliably year-round.

Also manually invokable:
```
GET /api/cron/performance-loop?force=true&since=2026-04-01T00:00:00Z
```

## Inputs

Reads from `post_queue` (published posts) joined to `post_performance`, for the trailing 7 days:
```sql
SELECT pq.id, pq.platform, pq.format_tag, pq.topic_tags, pq.published_at,
       pp.reach, pp.impressions, pp.saves, pp.shares, pp.comments,
       pp.follows, pp.ctr, pp.completion_rate
FROM post_queue pq
JOIN post_performance pp ON pp.post_queue_id = pq.id
WHERE pq.published_at >= now() - interval '7 days'
  AND pq.status = 'published';
```

Also reads `ab_test_variants` and `ab_test_assignments` to update A/B metrics (see `ab_testing`
SKILL step 4).

## Outputs

| Artifact | Destination |
|---|---|
| Updated per-post scores | `post_performance.score` updated |
| Format aggregates | `format_performance` rows upserted (30/60/90 day P50/P90) |
| Mix recommendation | `content_mix_log` row inserted |
| A/B metric updates | `ab_test_variants.metric_value` + `impressions` updated |
| Weekly digest | Resend email to Matt with top performers + mix recommendation |

## Pipeline

### Step 1 — Pull fresh metrics from each platform

For every `post_queue.platform_post_id` published in the last 7 days, pull analytics:

**Instagram:**
```typescript
// Per post: GET /v22.0/{media-id}/insights
const igMetrics = await fetch(
  `https://graph.facebook.com/v22.0/${platform_post_id}/insights` +
  `?metric=reach,impressions,saved,shares,comments,follows&period=lifetime`,
  { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
).then(r => r.json());
```

**TikTok:**
```typescript
// POST https://open.tiktokapis.com/v2/video/query/
const tikTokMetrics = await fetch('https://open.tiktokapis.com/v2/video/query/', {
  method: 'POST',
  headers: { Authorization: `Bearer ${TIKTOK_ACCESS_TOKEN}` },
  body: JSON.stringify({
    filters: { video_ids: [platform_post_id] },
    fields: ['view_count', 'like_count', 'share_count', 'comment_count',
             'average_time_watched', 'full_video_watched_rate'],
  }),
}).then(r => r.json());
```

**YouTube:**
```typescript
// GET https://youtubeanalytics.googleapis.com/v2/reports
const ytMetrics = await fetch(
  `https://youtubeanalytics.googleapis.com/v2/reports` +
  `?ids=channel==MINE&startDate=7daysAgo&endDate=today` +
  `&metrics=views,averageViewDuration,averageViewPercentage,shares,comments` +
  `&filters=video==${platform_post_id}`,
  { headers: { Authorization: `Bearer ${YOUTUBE_ACCESS_TOKEN}` } }
).then(r => r.json());
```

**LinkedIn:**
```typescript
// GET https://api.linkedin.com/v2/organizationalEntityShareStatistics
const liMetrics = await fetch(
  `https://api.linkedin.com/v2/organizationalEntityShareStatistics` +
  `?q=organizationalEntity&organizationalEntity=urn:li:ugcPost:${platform_post_id}`,
  { headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` } }
).then(r => r.json());
```

Update `post_performance` with fresh values:
```sql
UPDATE post_performance
SET reach = $reach, impressions = $impressions, saves = $saves,
    shares = $shares, comments = $comments, follows = $follows,
    ctr = $ctr, completion_rate = $completion_rate,
    last_pulled_at = now(), updated_at = now()
WHERE post_queue_id = $post_queue_id;
```

### Step 2 — Score each post

Weighted formula (documented for Matt's audit):
```
score = (reach / max_reach_this_period) * 0.30
      + (saves  / max_saves_this_period) * 0.25
      + (shares / max_shares_this_period) * 0.25
      + (comments / max_comments_this_period) * 0.15
      + (follows / max_follows_this_period) * 0.05
```

Normalized per-platform percentile: each metric is divided by the maximum value for that
metric on that platform in the trailing 30 days (stored in `platform_metric_baselines`).

```typescript
function computeScore(post: PostMetrics, baselines: PlatformBaselines): number {
  const normalize = (val: number, max: number) => max > 0 ? Math.min(val / max, 1.0) : 0;
  return (
    normalize(post.reach, baselines.max_reach)       * 0.30 +
    normalize(post.saves, baselines.max_saves)       * 0.25 +
    normalize(post.shares, baselines.max_shares)     * 0.25 +
    normalize(post.comments, baselines.max_comments) * 0.15 +
    normalize(post.follows, baselines.max_follows)   * 0.05
  );
}
```

```sql
UPDATE post_performance SET score = $score, updated_at = now()
WHERE post_queue_id = $post_queue_id;
```

### Step 3 — Anti-engagement-bait de-ranking

Before format aggregation, apply the FUB-capture check:
```typescript
for (const post of scoredPosts) {
  // Pull FUB clicks attributed to this post
  const fubClicks = await getFubClicksForPost(post.post_queue_id);
  if (post.score > SCORE_HIGH_THRESHOLD && fubClicks === 0) {
    // High engagement score but zero lead capture:
    // De-rank by 40% of score — still counts, but doesn't dominate the mix
    post.adjusted_score = post.score * 0.6;
    post.deranked_reason = 'high_engagement_zero_fub';
    await logDerank(post);
  } else {
    post.adjusted_score = post.score;
  }
}
```

FUB click attribution: check `engagement_inbox` for FUB pushes referencing this post's
`post_queue_id` in `post_queue_id` column, within 72 hours of publish.

### Step 4 — Aggregate format_performance

```sql
INSERT INTO format_performance
  (format_tag, platform, period_days, p50_score, p90_score,
   post_count, avg_reach, avg_saves, avg_shares, avg_fub_clicks,
   computed_at)
SELECT
  pq.format_tag,
  pq.platform,
  30 AS period_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pp.score) AS p50_score,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pp.score) AS p90_score,
  COUNT(*) AS post_count,
  AVG(pp.reach)  AS avg_reach,
  AVG(pp.saves)  AS avg_saves,
  AVG(pp.shares) AS avg_shares,
  0              AS avg_fub_clicks,   -- updated below
  now()          AS computed_at
FROM post_queue pq
JOIN post_performance pp ON pp.post_queue_id = pq.id
WHERE pq.published_at >= now() - interval '30 days'
  AND pq.status = 'published'
  AND pq.format_tag IS NOT NULL
GROUP BY pq.format_tag, pq.platform
ON CONFLICT (format_tag, platform, period_days, computed_at::date)
DO UPDATE SET
  p50_score = EXCLUDED.p50_score,
  p90_score = EXCLUDED.p90_score,
  post_count = EXCLUDED.post_count,
  avg_reach  = EXCLUDED.avg_reach,
  avg_saves  = EXCLUDED.avg_saves,
  avg_shares = EXCLUDED.avg_shares,
  computed_at = EXCLUDED.computed_at;
-- Run same query for period_days = 60 and 90
```

### Step 5 — Compute next week's content mix

```typescript
// Get top formats by adjusted_score P50 for last 30 days
const formatRankings = await getFormatRankings();  // from format_performance

// Mix formula: 40 / 30 / 20 / 10
const topQuartileCut = Math.ceil(formatRankings.length * 0.25);
const mix = {
  top_quartile:  { formats: formatRankings.slice(0, topQuartileCut), share: 0.40 },
  second_tier:   { formats: formatRankings.slice(topQuartileCut, topQuartileCut*2), share: 0.30 },
  experimentation: { formats: ['new_format_attempt', 'trend_content'], share: 0.20 },
  retest_bottom: { formats: formatRankings.slice(-2), share: 0.10 },
};
```

Log the mix decision:
```sql
INSERT INTO content_mix_log
  (week_of, mix_json, ranking_basis, computed_at, approved_by)
VALUES
  (date_trunc('week', now() + interval '7 days'),
   $mix::jsonb, 'format_performance_30d', now(), 'system');
```

Matt can override via `/admin/content-mix` (UI spec only — not built here).

### Step 6 — Update A/B test metrics

For all running `ab_tests`:
```sql
SELECT * FROM ab_tests WHERE status = 'running';
```
For each: call `update_ab_variant_metrics()` RPC (defined in `ab_testing/SKILL.md`).

### Step 7 — Send weekly digest to Matt

```typescript
// Resend email with:
// - Top 3 posts of the week (by adjusted_score)
// - Format mix recommendation for next week
// - Any deranked posts (high engagement, zero FUB) flagged for review
// - A/B test winner declarations from the past week
await resend.emails.send({
  from: 'automation@ryan-realty.com',
  to: process.env.ALERT_EMAIL,
  subject: `Ryan Realty | Weekly Performance Loop — ${weekOf}`,
  react: PerformanceDigestEmail({ topPosts, mix, deranked, abWinners }),
});
```

## Database schema

```sql
CREATE TABLE IF NOT EXISTS format_performance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format_tag    text NOT NULL,
  platform      text NOT NULL,
  period_days   integer NOT NULL,   -- 30 | 60 | 90
  p50_score     numeric(8,6),
  p90_score     numeric(8,6),
  post_count    integer NOT NULL DEFAULT 0,
  avg_reach     numeric(12,2),
  avg_saves     numeric(10,2),
  avg_shares    numeric(10,2),
  avg_fub_clicks numeric(10,2),
  computed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS format_performance_unique_idx
  ON format_performance (format_tag, platform, period_days, (computed_at::date));
CREATE INDEX IF NOT EXISTS format_performance_lookup_idx
  ON format_performance (format_tag, platform, period_days, computed_at DESC);

CREATE TABLE IF NOT EXISTS content_mix_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of         date NOT NULL,
  mix_json        jsonb NOT NULL,
  ranking_basis   text NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  approved_by     text NOT NULL DEFAULT 'system',
  override_notes  text
);
CREATE UNIQUE INDEX IF NOT EXISTS content_mix_log_week_idx
  ON content_mix_log (week_of);

CREATE TABLE IF NOT EXISTS platform_metric_baselines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    text NOT NULL,
  metric_name text NOT NULL,
  max_value   numeric(14,4) NOT NULL DEFAULT 1,
  period_days integer NOT NULL DEFAULT 30,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_baselines_unique_idx
  ON platform_metric_baselines (platform, metric_name, period_days);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 5 — No engagement-bait optimization.** Step 3 de-ranks any high-score post with zero
  FUB lead capture. The system optimizes for lead generation, not vanity engagement.
- **Full audit log.** `content_mix_log` is append-only and never deleted. Matt can see exactly
  what drove every format mix decision.
- **No auto-apply of mix.** The `content_mix_log` is a recommendation. `social_calendar` reads
  it on Monday when building the next week's calendar. Matt's manual override at
  `/admin/content-mix` always wins.
- **No stat used without source.** All performance numbers come from fresh API pulls in Step 1,
  not from cache. The `last_pulled_at` timestamp on `post_performance` is the source trace.

## Error handling + observability

- **Platform API failure:** if one platform fails, continue with others. Log partial failure
  to `automation_runs`. Digest email notes which platform metrics are stale.
- **Zero posts in window:** if no posts published in 7 days, skip scoring steps, still send
  digest noting zero activity.
- **Baseline bootstrap:** on first run, `platform_metric_baselines.max_value = 1` prevents
  division by zero. Baselines update after first real pull.

Structured log per run:
```json
{ "skill": "performance_loop", "week_of": "2026-04-26",
  "posts_scored": 21, "formats_aggregated": 6, "ab_tests_updated": 3,
  "deranked_count": 1, "digest_sent": true, "ms": 8420 }
```

## Configuration

```typescript
export const PERFORMANCE_LOOP_CONFIG = {
  // Score weights (must sum to 1.0)
  score_weights: {
    reach: 0.30, saves: 0.25, shares: 0.25, comments: 0.15, follows: 0.05,
  },

  // Content mix allocation (must sum to 1.0)
  mix_allocation: {
    top_quartile: 0.40, second_tier: 0.30, experimentation: 0.20, retest_bottom: 0.10,
  },

  // FUB-zero de-rank multiplier
  fub_zero_derank_factor: 0.60,

  // Score threshold above which FUB check is triggered
  score_high_threshold: 0.70,

  // Lookback windows for format aggregation (days)
  aggregation_windows: [30, 60, 90],

  // Baseline update frequency (days)
  baseline_update_days: 7,
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `META_ACCESS_TOKEN` | IG + FB Insights API |
| `TIKTOK_ACCESS_TOKEN` | TikTok Analytics API |
| `YOUTUBE_ACCESS_TOKEN` | YouTube Analytics API |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn Analytics API |
| `RESEND_API_KEY` | Weekly digest email |
| `ALERT_EMAIL` | Matt's email |
| `CRON_SECRET` | Cron auth |

## Manual override / kill switch

**Kill performance loop:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'performance_loop_enabled';
```

**Override mix recommendation:**
```
PATCH /api/admin/content-mix
Body: { week_of: '2026-05-03', override_mix: {...}, override_notes: '...' }
```
Writes to `content_mix_log.override_notes` and sets `approved_by = 'matt'`.

**Re-run for a specific week:**
```
GET /api/cron/performance-loop?force=true&since=2026-04-20T00:00:00Z
```

## See also

- `automation_skills/automation/post_scheduler/SKILL.md` — `post_performance` table
- `automation_skills/automation/ab_testing/SKILL.md` — metrics fed into ab_test_variants
- `automation_skills/automation/engagement_bot/SKILL.md` — FUB click attribution
- `video_production_skills/social_calendar/SKILL.md` — reads content_mix_log on Mondays
