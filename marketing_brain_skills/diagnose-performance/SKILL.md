---
name: marketing-brain-diagnose-performance
description: Compute WoW/MoM deltas, z-score anomalies, channel rankings, and structured InsightSummary output from marketing_channel_daily. Use when running the weekly marketing brain cycle, when investigating a channel dip, when generating briefs, or when producing the dashboard's signal layer. Reads from public.marketing_channel_daily. Writes to public.marketing_decisions only for flagged anomalies. Core logic in lib/marketing-brain/diagnose.ts. Manual trigger at /api/marketing-brain/diagnose.
---

# marketing-brain: diagnose-performance

The marketing brain's reasoning layer. Reads the metric history written by `snapshot-channels` and produces structured signal: deltas, anomalies, channel rankings, and recommended-action tags. The downstream `generate-briefs` skill consumes these outputs to decide what content to create or kill.

---

## When to use this skill

- The weekly brain cycle needs fresh signal before generating content briefs.
- A channel's metrics look off and you need to quantify how far outside normal they are.
- You want to know which channel drove the most qualified seller leads this week.
- The dashboard needs a signal summary to display to Matt.
- You are writing or debugging `lib/marketing-brain/diagnose.ts`.

---

## Diagnostic primitives

### computeDelta(channel, metric, scope, scopeId, asOfDate)

Returns a `DeltaReport` with three comparison windows:

| Field | Window | Description |
|---|---|---|
| `wow` | current 7d vs prior 7d | Week-over-week change |
| `mom` | current 30d vs prior 30d | Month-over-month change |
| `trend_vs_baseline` | current 7d vs trailing 4-week mean x7 | Trend against the rolling baseline |

Each window contains:
- `current` and `prior` sums
- `absolute_change`
- `percent_change` (null when prior is zero)
- `significance` (see thresholds below)

Also returns `trailing_30_mean` and `trailing_30_std` for the caller to use in further analysis.

### detectAnomalies(channel, scope, scopeId, asOfDate)

Z-scores every metric present for the channel/scope in the trailing 30 days. Returns two types:

**Anomaly** (|z| > 2.0):
```
{ channel, metric, scope, scope_id, z_score, current_value, baseline_mean, baseline_std, insufficient_data: false }
```

**InsufficientDataFlag** (fewer than 14 non-zero days):
```
{ channel, metric, scope, scope_id, insufficient_data: true, non_zero_days: number }
```

The z-score uses the non-zero distribution, not all 30 days. Metrics that simply do not fire every day (e.g. lead events on a slow day) are not penalized for the zero days.

### rankChannels(metric, windowDays, asOfDate)

Sums a metric per channel across the window and returns channels ordered by total descending:

```
{ channel, total, rank }[]
```

Useful for: "which channel drove the most `lead_events` in the last 7 days?"

### generateInsightSummary(channel, asOfDate)

Top-level function. Discovers all metrics present for the channel in the past 7 days, calls `computeDelta` and `detectAnomalies` in parallel, ranks the 3-5 most significant deltas, and returns:

```
{
  channel,
  as_of_date,
  headline,           // one-sentence machine-generated signal summary
  deltas,             // DeltaReport[] for the top 3-5 metrics
  anomalies,          // AnomalyResult[] for all metrics
  recommended_actions // RecommendedAction[]
}
```

---

## Statistical thresholds (locked)

| Threshold | Value | Description |
|---|---|---|
| `ANOMALY_Z_THRESHOLD` | 2.0 | |z| must exceed this to qualify as an anomaly |
| `MIN_NON_ZERO_DAYS` | 14 | Fewer non-zero days in trailing 30 -> skip z-score, emit `insufficient_data: true` |
| `SIGNIFICANCE_STABLE_PCT` | 5% | |%change| below this is 'stable' |
| `SIGNIFICANCE_EXTREME_PCT` | 20% | |%change| above this AND outside 2-sigma band -> 'spike' or 'crash' |

**Significance classification:**

```
|%change| < 5%                                    -> 'stable'
5% <= |%change| <= 20%                            -> 'rising' or 'falling'
|%change| > 20% AND |absolute_change| > 2 * std   -> 'spike' or 'crash'
|%change| > 20% but inside 2-sigma band           -> 'rising' or 'falling' (not spike/crash)
prior = 0, current > 0                            -> 'spike'
prior = 0, current = 0                            -> 'stable'
```

**Mean reversion note.** A metric that is currently 'rising' will not be called a spike unless it also crosses the 2-sigma band of its trailing 30-day distribution. This prevents noise from shallow markets (e.g. a channel with low daily variance where a modest uptick looks like a large % swing).

---

## Recommended-action vocabulary

These tags are machine-readable signals for `generate-briefs` to act on. They are NOT user-facing copy.

| Tag | When emitted |
|---|---|
| `increase_budget` | leads/conversions spiking or rising WoW |
| `reduce_budget` | spend rising but leads flat or falling WoW and MoM |
| `test_new_creative` | spend rising but engagement or CTR flat/falling |
| `audit_landing_page` | sessions/impressions rising but conversion metrics not keeping up |
| `investigate_drop` | crash WoW, or anomaly with z < -2 |
| `capitalize_on_spike` | anomaly with z > 2 |
| `check_tracking` | current value = 0 but baseline mean > 10 (tracking gap suspected) |
| `review_targeting` | reach rising but quality metrics (CTR, engagement) not following |
| `expand_to_similar_audience` | conversion rate rising while reach is flat or falling |
| `pause_underperformer` | crash on both WoW and MoM for the same metric |

Multiple tags can fire for a single channel per run. `generate-briefs` uses them as filters, not as directives. Matt reviews every brief before publish.

---

## How to interpret outputs

**InsightSummary.headline** is a one-liner summary of the single strongest signal. It is an internal label for the agent cycle, not a user-facing headline.

**InsightSummary.deltas** are ordered by significance score. The first element is the most important metric to investigate or act on.

**InsightSummary.anomalies** contains ALL metrics, including `insufficient_data` flags. The caller should filter on `insufficient_data === false` when looking for actionable anomalies.

**Recommended actions are additive hints, not mutually exclusive.** A channel can simultaneously deserve `test_new_creative` and `audit_landing_page`. The `generate-briefs` skill weighs these signals along with the budget and calendar context to decide what to propose.

---

## HTTP trigger

```
GET /api/marketing-brain/diagnose?channel=ga4&asOfDate=2026-05-12
Authorization: Bearer $CRON_SECRET
```

- `channel` optional. Omit to run for all channels with recent data.
- `asOfDate` optional. Defaults to yesterday. Format: YYYY-MM-DD.
- Returns `InsightSummary` (single channel) or `InsightSummary[]` (all channels).

---

## Data requirements

The skill requires at least 30 days of history in `marketing_channel_daily` for a channel to produce meaningful z-scores and MoM deltas. With less than 30 days, WoW deltas still work, but MoM priors will be partial sums and anomaly checks will emit `insufficient_data` flags for most metrics.

For a new channel: expect 14 days before anomalies fire, 30 days before MoM is reliable.

---

## Extending this skill

When adding a new metric to an ingestor, no changes to `diagnose.ts` are required. The skill auto-discovers metrics present in the data for each channel. The `recommended_actions` derivation in `generateInsightSummary` uses metric name matching; update `deriveActions()` if the new metric name should trigger a specific action.

When adding a new `RecommendedAction` tag: add it to the `RecommendedAction` union type in `diagnose.ts`, implement the emit condition in `deriveActions()`, document the tag in this skill's vocabulary table, and update `generate-briefs` to consume it.

---

## Related skills

- `marketing-brain:snapshot-channels` - upstream; writes to `marketing_channel_daily`.
- `marketing-brain:generate-briefs` - downstream; consumes `InsightSummary.recommended_actions`.
- `marketing-brain:weekly-cycle` - orchestrates snapshot + diagnose + generate-briefs in sequence.
- `marketing-brain:competitor-recon` - parallel; reads from `competitor_intel`, not this table.
