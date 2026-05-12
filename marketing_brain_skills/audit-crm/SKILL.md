---
name: marketing-brain-audit-crm
description: Audit the Follow Up Boss (FUB) CRM pipeline. Measures lead source quality, response-time SLA compliance, pipeline stage health, and the qualified-seller-leads north-star metric. Outputs CRMAuditReport for downstream generate-briefs. Reads only from public.marketing_channel_daily (channel='fub'). Manual trigger at /api/marketing-brain/audit/crm.
---

# marketing-brain: audit-crm

Audits the Follow Up Boss (FUB) CRM and lead-handling pipeline. Produces a `CRMAuditReport` consumed by `generate-briefs` to prioritize CRM-sourced content and operational improvements.

---

## When to use this skill

- The weekly brain cycle needs CRM signal alongside channel-performance signal.
- You want to know which lead sources produce the highest-quality sellers.
- You are reviewing response-time SLA compliance against the 5-minute standard.
- You need a pipeline funnel view: new → hot → warm → nurture → contract.
- You are writing or debugging `lib/marketing-brain/audit-crm.ts`.

---

## FUB data shape

All data reads from `public.marketing_channel_daily` where `channel = 'fub'`.

Written by `app/api/cron/marketing-snapshot-fub/route.ts` (via `lib/fub-snapshot.ts`).

### Account-scope metrics (scope='account', scope_id='')

| Metric | Description |
|---|---|
| `new_leads` | Leads created in FUB that day |
| `qualified_seller_leads` | Leads with any canonical seller tag (hot-seller, warm-seller, seller, seller-lead). Excludes nurture-only. This is the north-star metric. |
| `avg_response_time_minutes` | Mean (respondedAt − createdAt) for new leads with measurable response. Only emitted on days where at least one response time was recorded. |
| `appointments_booked` | FUB events of type Appointment on that day |
| `deals_created` | Deals created in FUB that day |
| `deals_closed_won` | Deals whose status transitioned to "closed won" (approximated via updatedAt within day window) |
| `deals_lost` | Deals whose status transitioned to "closed lost" (same approximation) |

### Source-scope metrics (scope='source', scope_id=lead_source_string)

| Metric | Description |
|---|---|
| `new_leads` | Count of new leads from this source on that day |

### Campaign-scope metrics (scope='campaign', scope_id='stage:<name>')

| Metric | Description |
|---|---|
| `pipeline_count` | Number of active deals in this stage (current-state snapshot, not time-filtered) |
| `pipeline_value` | Sum of deal price for deals in this stage |

---

## Seller-lead tag vocabulary

Tags in FUB that identify a lead as a qualified seller (from `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md §2`):

| Tag | Meaning | Included in north-star |
|---|---|---|
| `hot-seller` | Timeline 0–3 months, ASAP | Yes |
| `warm-seller` | Timeline 3–12 months | Yes |
| `seller` | General seller tag (organic or broad funnel) | Yes |
| `seller-lead` | Broad seller-pipeline tag | Yes |
| `nurture-only` | Just exploring; no active timeline | **No** |

---

## Response-time SLA thresholds

Per `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` (5-minute webhook response requirement):

| Lead type | SLA | Threshold |
|---|---|---|
| HOT (hot-seller tag) | Respond within 5 minutes | `HOT_SLA_MINUTES = 5` |
| WARM (warm-seller tag) | Respond within 30 minutes | `WARM_SLA_MINUTES = 30` |

**Compliance calculation:** since `avg_response_time_minutes` is an account-level daily mean (not tag-segmented in the current ingestor), the audit uses `ACCOUNT_SLA_MINUTES = 5` (the stricter HOT threshold) as the compliance gate. A day is "compliant" when the day's average is ≤ 5 minutes. Compliance % = compliant_days / data_days × 100.

---

## Source quality weighted score

Formula for each source's `quality_score` (0–100):

```
quality_score = 
  (qualified_lead_ratio × 0.50)
  + (deal_closed_won_ratio × 0.30)
  + (avg_deal_value_score × 0.20)
  × 100

where:
  qualified_lead_ratio  = qualified_seller_leads / new_leads  (0–1)
  deal_closed_won_ratio = deals_closed_won / new_leads         (0–1)
  avg_deal_value_score  = source_avg_deal_value / max_peer_avg_deal_value  (0–1, normalised)
```

**Important:** because the ingestor does not break down `qualified_seller_leads` or `deals_closed_won` per source (only per account), those figures are allocated proportionally to source lead share. The quality score is therefore a relative ranking across sources, not an absolute conversion-rate guarantee. When the ingestor is enhanced to track per-source outcomes, this allocation step should be removed.

Sources are ranked by `quality_score` descending (rank 1 = best).

---

## Pipeline stall detection

A stage is flagged `is_stalled = true` when:
1. The stage's `pipeline_count` grew over the window (earliestCount < latestCount), AND
2. The `contract` stage count did NOT grow (no deals advanced to contract).

This is a proxy for funnel stagnation. Stall threshold: `PIPELINE_STALL_DAYS = 14`.

Canonical funnel order for stage_conversions: `new → hot → warm → nurture → contract`

Conversion rate between adjacent stages = `to_stage.pipeline_count / from_stage.pipeline_count` (snapshot ratio, not historical cohort).

---

## Tagging drift definition

Approximated as:

```
untagged_pct = (window_new_leads - window_qualified_seller_leads) / window_new_leads × 100
```

Flag threshold: `TAGGING_DRIFT_THRESHOLD_PCT = 10` — if > 10% of new leads in the window carry no seller-stage tag, a tagging-drift opportunity is emitted.

This is an approximation. Leads tagged `nurture-only` or untagged both appear in the numerator. True tagging drift (no tag at all on day 0) would require per-person tag inspection in FUB, not available in the aggregated ingestor data.

---

## CRMAuditReport shape

```typescript
interface CRMAuditReport {
  as_of_date: string          // YYYY-MM-DD
  window_days: number         // audit window (default 30)
  source_quality: SourceQuality[]     // per-source ranked list
  response_time: ResponseTimeReport   // SLA compliance
  pipeline_health: PipelineHealthReport // stage counts, values, stall flags
  north_star: NorthStarReport         // qualified_seller_leads WoW/MoM/baseline
  opportunities: Opportunity[]        // ranked, max 7
}
```

### SourceQuality
```typescript
{ source, new_leads, qualified_seller_leads, qualified_lead_ratio,
  deals_created, deals_closed_won, deal_closed_won_ratio,
  avg_deal_value, quality_score, rank }
```

### ResponseTimeReport
```typescript
{ avg_response_time_minutes, compliant_days, noncompliant_days, data_days,
  compliance_pct, sla_hot_minutes, sla_warm_minutes,
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data' }
```

### PipelineHealthReport
```typescript
{ stages: PipelineStage[], total_pipeline_count, total_pipeline_value,
  stage_conversions: StageConversion[] }
// PipelineStage: { stage, pipeline_count, pipeline_value, is_stalled }
// StageConversion: { from_stage, to_stage, conversion_rate }
```

### NorthStarReport
```typescript
{ metric: 'qualified_seller_leads', window_total,
  wow_change, wow_pct, mom_change, mom_pct,
  trailing_baseline_mean_7d, trend_vs_baseline_pct }
```

### Opportunity
```typescript
{ area: 'response_time' | 'source_quality' | 'pipeline_health' | 'tagging_drift' | 'north_star',
  severity: 'high' | 'medium' | 'low',
  headline: string,
  evidence: string,
  recommended_action: RecommendedAction }
```

---

## Thresholds (locked)

| Threshold | Value | Description |
|---|---|---|
| `HOT_SLA_MINUTES` | 5 | Max minutes for hot-lead response (playbook) |
| `WARM_SLA_MINUTES` | 30 | Max minutes for warm-lead response (playbook) |
| `ACCOUNT_SLA_MINUTES` | 5 | Account-level daily compliance gate (strictest SLA) |
| `TAGGING_DRIFT_THRESHOLD_PCT` | 10 | % of untagged new leads triggering a drift flag |
| `PIPELINE_STALL_DAYS` | 14 | Days of no funnel advance before stall flag fires |
| Source quality weights | 50/30/20 | qualified_lead_ratio / deal_closed_won_ratio / avg_deal_value_score |
| Opportunity cap | 7 | Maximum ranked opportunities in output |

---

## HTTP trigger

```
GET /api/marketing-brain/audit/crm?asOfDate=2026-05-12&windowDays=30
Authorization: Bearer $CRON_SECRET
```

- `asOfDate` — optional YYYY-MM-DD. Defaults to yesterday.
- `windowDays` — optional integer 1–90. Defaults to 30.
- Returns `CRMAuditReport` as JSON.

---

## Recommended-action vocabulary

Same 10-tag set as `marketing-brain:diagnose-performance`. Tags used by this skill:

| Tag | When emitted |
|---|---|
| `investigate_drop` | response-time compliance < 50%, north-star WoW drop > 20%, tagging drift flagged |
| `review_targeting` | low-quality high-volume source, response-time compliance 50–80% |
| `check_tracking` | no response-time data, or worsening trend |
| `expand_to_similar_audience` | high-quality source with low volume |
| `pause_underperformer` | pipeline stage stalled with no funnel advances |
| `audit_landing_page` | new-to-hot conversion rate < 5% |
| `capitalize_on_spike` | north-star WoW growth > 30% |
| `reduce_budget` | north-star MoM decline > 10% |

---

## Related skills

- `marketing-brain:snapshot-channels` (`app/api/cron/marketing-snapshot-fub/`) — upstream; writes the FUB rows this skill reads.
- `marketing-brain:diagnose-performance` — parallel; same `marketing_channel_daily` table, different analysis focus (channel-level, all channels).
- `marketing-brain:generate-briefs` — downstream; consumes `opportunities[].recommended_action` to decide what CRM-improvement content to create.
- `marketing-brain:weekly-cycle` — orchestrates snapshot + diagnose + audit-crm + generate-briefs in sequence.
