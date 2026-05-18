---
name: analyze-anomaly
description: >
  ANALYSIS producer (brain-internal). When the brain flags a channel anomaly.  a drop
  or spike that clears the z-score threshold.  this producer drills into the daily
  data to identify the inflection date, break the metric by its next-level dimensions,
  cross-reference with known events in marketing_decisions, and produce a structured
  AnomalyFindings report written back to marketing_decisions. No published output.
  No approval gate. Findings feed generate-briefs to prioritize recovery or amplification actions.
action_types:
  - analyze:drop_investigation
  - analyze:spike_investigation
  - analyze:metric_decomposition
output_type: operational
target_platforms: []
asset_destination: no asset; state mutation only (logged in marketing_decisions)
auto_inputs: ["current campaign/account state"]
required_inputs: ["account_id OR campaign_id"]
optional_inputs: ["budget_delta_pct", "pause_reason"]
estimated_runtime_min: 3
cost_usd_estimate: $0.01-$0.10 per call (mostly API quota; minimal Anthropic)
thumbnail_uri: out/proof/2026-05-17/exemplars/sample.html
example_outputs: []
---

# analyze-anomaly

**Scope:** Brain-internal deep-dive skill. Reads `marketing_channel_daily` and
`marketing_decisions`, produces a structured `AnomalyFindings` object, and writes it
back as a `marketing_decisions` row. This is an analysis tool only. It does not write
content, publish anything, send alerts, or modify ad accounts. Every finding is data,
not a decision.  the brain's `generate-briefs` skill decides what actions to take next.

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** `marketing_decisions` row with `decision_type='anomaly_findings'`

---

## 1. Scope

### In scope
- `analyze:drop_investigation`.  a metric fell anomalously; find the inflection date and root cause dimensions
- `analyze:spike_investigation`.  a metric spiked anomalously; find what drove it
- `analyze:metric_decomposition`.  decompose a top-line metric into contributing sub-dimensions without a specific anomaly trigger (used by generate-briefs for scheduled deep dives)

### Out of scope
- Deciding what action to take based on the findings.  that is `generate-briefs`
- Alerting Matt directly.  that is `comms-matt-alert`
- Running the statistical anomaly detection itself.  that is `diagnose-performance` / `lib/marketing-brain/diagnose.ts`
- Making any changes to campaigns, CRM, or site.  those are ops producers

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `analyze:drop_investigation` | `metric`, `channel`, `scope`, `asOfDate`, `windowDays`, `observed_change_pct` | `hypothesis` optional |
| `analyze:spike_investigation` | same as drop | direction inferred from `observed_change_pct > 0` |
| `analyze:metric_decomposition` | `metric`, `channel`, `scope`, `asOfDate`, `windowDays` | `observed_change_pct` not required |

### Payload schema

```typescript
interface AnomalyAnalysisPayload {
  metric: string;              // e.g. 'qualified_seller_leads', 'gbp_call_clicks', 'sessions'
  channel: string;             // 'ga4' | 'gsc' | 'fub' | 'meta_ads' | 'gbp' | 'youtube' | 'linkedin'
  scope: 'account' | 'campaign' | 'page' | 'source';
  asOfDate: string;            // YYYY-MM-DD.  the day the anomaly was detected
  windowDays: number;          // 7 (WoW investigation) or 30 (MoM investigation)
  observed_change_pct: number; // from diagnose-performance.  the % change that triggered this
  hypothesis?: string;         // optional starting hypothesis from the brain
}
```

---

## 3. Full action row schema

```typescript
interface AnomalyActionRow {
  id: string
  action_type: 'analyze:drop_investigation' | 'analyze:spike_investigation' | 'analyze:metric_decomposition'
  target: string               // e.g. 'channel:meta_ads' or 'metric:qualified_seller_leads'
  assigned_producer: string    // 'marketing_brain_skills/analyze-anomaly'
  payload: AnomalyAnalysisPayload
  data_evidence: {
    z_score?: number           // from diagnose-performance
    baseline_mean?: number
    baseline_std?: number
    audit_source?: string      // which audit triggered the flag: 'audit-ads' | 'audit-crm' | 'audit-website'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

Extract: `metric`, `channel`, `scope`, `asOfDate`, `windowDays`, `observed_change_pct`, `hypothesis`.

**Step 2.  Pull 60 days of daily values**

Pull the daily time series for the metric over the trailing 60 days ending at `asOfDate`.
This is the raw data for all downstream analysis.

```sql
SELECT date, value
FROM marketing_channel_daily
WHERE channel = '<channel>'
  AND metric   = '<metric>'
  AND scope    = '<scope>'
  AND scope_id = '<scope_id>'
  AND date BETWEEN (CAST('<asOfDate>' AS date) - INTERVAL '60 days')
                AND CAST('<asOfDate>' AS date)
ORDER BY date ASC;
```

Store as `daily_series: Array<{date: string, value: number}>`.

Minimum data check: if fewer than 14 non-zero days exist in the trailing 30, this
investigation cannot proceed. Set `status='killed'`:

```sql
UPDATE marketing_brain_actions
SET status = 'killed',
    executor_response = '{"reason": "insufficient_data", "non_zero_days": <N>}'::jsonb
WHERE id = '<action_id>';
```

**Step 3.  Identify the inflection date**

Inflection date is the day the trend changed direction. Compute using a 7-day rolling
mean: the inflection is the last date where the rolling mean crossed from above to below
the 30-day baseline (for drops) or below to above (for spikes).

Algorithm:
1. Compute `baseline_mean` = mean of daily values in days -30 to -8 (the pre-recent window).
2. Compute 7-day rolling mean for each day in the last 30.
3. Inflection = first day in the last 30 where the rolling mean crossed the threshold
   (for drops: rolling mean first fell below `baseline_mean * 0.95`; for spikes: first
   rose above `baseline_mean * 1.05`).
4. If no clean inflection is found (gradual drift), use the midpoint of the period.

Record `inflection_date: string` (YYYY-MM-DD).

**Step 4.  Break by next-level dimensions**

For each channel, query the dimension level below `scope`:

**GA4 `sessions` at `scope='account'`:** break by source/medium, landing page, device category, country.
```sql
SELECT scope, scope_id, SUM(value) as total
FROM marketing_channel_daily
WHERE channel = 'ga4'
  AND metric   = 'sessions'
  AND date BETWEEN '<inflection_date>' AND '<asOfDate>'
GROUP BY scope, scope_id
ORDER BY total DESC
LIMIT 10;
```
Run the same query for the equivalent pre-inflection window to compute contribution change.

**GSC position at `scope='account'`:** break by query (source scope, scope_id = query string), by page.

**FUB `qualified_seller_leads`:** break by source (scope='source'), by time-of-day bucket (compute from raw timestamps if available via FUB audit data).

**Meta Ads CPL or spend:** break by campaign (scope='campaign', scope_id = campaign name keyword), by ad creative label if available, by placement.

**GBP:** break by action type (calls vs direction clicks vs website clicks).

For each dimension, compute:
- `current_period_total`: sum in window from inflection_date to asOfDate
- `prior_period_total`: sum in the equivalent-length window before inflection_date
- `contribution_pct`: `(current - prior) / abs(prior) * 100`.  how much of the top-line change this dimension explains

Filter to dimensions with `|contribution_pct| >= 5%`. Cap at 5 top contributors.

```typescript
interface DimensionContributor {
  dimension: string;         // e.g. 'source/medium', 'campaign', 'landing_page'
  value: string;             // the specific value (e.g. 'facebook / cpc', '/sell/')
  current_period_total: number;
  prior_period_total: number;
  contribution_pct: number;  // signed; negative = contributed to drop
}
```

**Step 5.  Cross-reference known events**

Query `marketing_decisions` for events near the inflection date:

```sql
SELECT decision_type, description, decided_at, outcome
FROM marketing_decisions
WHERE decided_at BETWEEN (CAST('<inflection_date>' AS date) - INTERVAL '7 days')
                     AND (CAST('<inflection_date>' AS date) + INTERVAL '3 days')
  AND decision_type IN (
    'campaign_pause', 'campaign_resume', 'budget_change', 'creative_change',
    'site_deploy', 'seo_change', 'content_publish', 'experiment_start',
    'experiment_stop', 'anomaly_findings'
  )
ORDER BY decided_at DESC;
```

Also check `competitor_intel` for scrapes in the same window.  a competitor price drop
or new listing spike could explain a site-traffic shift.

Record as `correlated_events: Array<{event_type, date, description}>`.

**Step 6.  Form hypothesis**

If `payload.hypothesis` was provided, evaluate it against the findings.

Otherwise, generate a hypothesis from the evidence:
- If top contributor is a single campaign and there is a `campaign_pause` event on the inflection date: "Campaign pause on [date] removed [campaign name], accounting for [X]% of the drop in [metric]."
- If top contributor is an organic search query and position moved: "GSC position for '[query]' fell from [N] to [M] on [date], reducing organic sessions by [X]%."
- If no correlated event found: "No correlated system event detected near inflection date [date]. Possible external cause: [describe the dimension that moved]."

Limit hypothesis to 2 sentences. No hedging words ("approximately", "might").

**Step 7.  Generate recommended actions**

Based on findings, produce up to 3 recommended actions. Each maps to a valid
`action_type` the brain can enqueue:

| finding pattern | recommended action_type | rationale |
|---|---|---|
| Campaign pause caused drop | `ops:meta_ads_resume` | Resume the paused campaign |
| Creative fatigue on top campaign | `content:fb_lead_gen_ad` | New creative for that campaign |
| Organic query losing position | `content:seo_blog` or `site:seo_fix` | Target the lost query with new or updated content |
| Traffic source diversification opportunity | `content:blog_post` | Reduce dependency on flagged source |
| Lead source quality drop | `ops:fub_audit` | Investigate tag/stage assignments |

```typescript
interface RecommendedAction {
  action_type: string;      // valid brain action_type
  rationale: string;        // one sentence, specific to this finding
  priority: 'high' | 'medium' | 'low';
}
```

**Step 8.  Build and write AnomalyFindings**

```typescript
interface AnomalyFindings {
  metric: string;
  channel: string;
  observed_change_pct: number;
  inflection_date: string;
  analysis_window: { start: string; end: string };
  top_contributors: DimensionContributor[];
  correlated_events: Array<{ event_type: string; date: string; description: string }>;
  hypothesis: string;
  recommended_actions: RecommendedAction[];
  produced_at: string;      // ISO
  data_points_analyzed: number;  // total rows from marketing_channel_daily used
}
```

Write to `marketing_decisions`:

```sql
INSERT INTO marketing_decisions (
  decision_type, description, decided_at, outcome, metadata
) VALUES (
  'anomaly_findings',
  '<one-sentence summary: metric, direction, magnitude, hypothesis>',
  now(),
  'findings_produced',
  '<AnomalyFindings as jsonb>'::jsonb
);
```

**Step 9.  Enqueue recommended actions**

For each item in `recommended_actions` with `priority='high'`:

```sql
INSERT INTO marketing_brain_actions (
  action_type, target, assigned_producer, payload, generation_reason, status
) VALUES (
  '<action_type>',
  '<target derived from findings>',
  '<the producer that handles this action_type per REGISTRY.md>',
  '<payload jsonb>',
  'Recommended by analyze-anomaly investigation of <metric> drop/spike on <inflection_date>',
  'pending'
);
```

Only enqueue actions the brain has not already queued for the same target in the last 7 days
(prevent duplicate queuing on repeated analysis runs).

**Step 10.  Update action row to complete**

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "findings_decision_id": "<uuid of the marketing_decisions row>",
      "inflection_date": "<date>",
      "top_contributor": "<dimension: value>",
      "hypothesis_summary": "<one sentence>",
      "actions_enqueued": <count>
    }'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | all data reads + writes | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `lib/marketing-brain/diagnose.ts` | `dailyValues()`, `computeDelta()`.  reuse for internal computation | imported by `lib/marketing-brain/audit-*.ts` patterns |
| No external APIs | all analysis runs on cached `marketing_channel_daily` data | snapshot ingestors must have run before this skill executes |

---

## 6. Output format

**Primary output:** `marketing_decisions` row with `decision_type='anomaly_findings'`

**No file system output.** No `out/` directory. No scorecard. No Matt-facing alert from
this producer directly.  if findings are urgent enough to alert Matt, `generate-briefs`
enqueues a `comms:matt_alert` action after reading the findings.

**Executor response (written to action row):**
```json
{
  "findings_decision_id": "uuid",
  "inflection_date": "2026-05-06",
  "top_contributor": "campaign: Cold Acquisition",
  "hypothesis_summary": "Campaign pause on 2026-05-06 removed Cold Acquisition, accounting for 78% of the CPL spike.",
  "actions_enqueued": 1,
  "data_points_analyzed": 312
}
```

---

## 7. Approval gate

| approval_type | what it means |
|---|---|
| `none` | Brain-internal analysis only. Produces a structured report and database rows. No published content. No changes to live systems except `marketing_decisions` inserts and `marketing_brain_actions` inserts. |

This producer never publishes content or modifies ad accounts, CRM, or the website.
The `none` gate is correct and permanent for this producer.

---

## 8. Status flow

```
pending       <- producer reads row here
  |
  v
in_production <- set immediately
  |
  v
executed      <- set after AnomalyFindings written to marketing_decisions
  |
killed        <- set on insufficient data or unrecoverable query error
```

No `ready` or `approved` states. No draft surface.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Insufficient data | fewer than 14 non-zero days in trailing 30 for the metric | Set `status='killed'`, `executor_response.reason='insufficient_data'`. The brain should not re-queue until more data accumulates. |
| No rows returned from dimension query | Channel data not yet snapshotted for the window | Log missing channel + date range in `executor_response.warnings`. Produce partial findings with available data. If primary metric data is missing, kill. |
| `marketing_decisions` insert fails | Supabase constraint or network error | Retry once. If second attempt fails, write findings to `executor_response` directly on the action row and set `status='killed'` with the error so data is not lost. |
| Inflection date not found | Flat or noisy series with no clear crossing | Use the midpoint of the window. Note in findings: "No clear inflection detected; analysis covers the full window." |
| Recommended action already queued | Duplicate detection query finds existing pending row | Skip insertion. Note in `executor_response.actions_enqueued` the count of net-new insertions only. |

---

## 10. Related skills and references

**Required reading before executing:**
- `marketing_brain_skills/diagnose-performance/SKILL.md`.  anomaly definitions, z-score thresholds (`ANOMALY_Z_THRESHOLD=2.0`, `MIN_NON_ZERO_DAYS=14`, significance bands), `InsightSummary` shape
- `lib/marketing-brain/diagnose.ts`.  `AnomalyResult`, `DeltaReport`, `Significance`, `InsightSummary` types; `computeDelta()` and `detectAnomalies()` primitives for reference
- `marketing_brain_skills/audit-website/SKILL.md`.  GA4 and GSC metric dictionary (channel, scope, scope_id patterns)
- `marketing_brain_skills/audit-ads/SKILL.md`.  Meta Ads metric dictionary (campaign scope patterns, CPL fatigue thresholds)
- `marketing_brain_skills/audit-crm/SKILL.md`.  FUB metric dictionary (`qualified_seller_leads` north-star definition, seller-tag vocabulary)
- `CLAUDE.md` §0.  Data Accuracy: every figure in findings must trace to a live Supabase query

**Downstream consumers:**
- `marketing_brain_skills/generate-briefs/SKILL.md`.  reads `marketing_decisions` rows with `decision_type='anomaly_findings'` to generate the next content brief cycle
- `marketing_brain_skills/producers/comms-matt-alert/`.  if findings are critical, generate-briefs enqueues a `comms:matt_alert` action

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section F, row `analyze-anomaly`

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

