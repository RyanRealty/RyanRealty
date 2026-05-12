---
name: marketing-brain-audit-ads
description: Audit Ryan Realty's paid Meta Ads performance against the 3-campaign playbook ($30/$20/$10/day). Identifies creative fatigue, budget drift, underperforming campaigns, and attribution tracking gaps. Outputs a structured AdsAuditReport consumed by the generate-briefs skill. Core logic in lib/marketing-brain/audit-ads.ts. Manual trigger at /api/marketing-brain/audit/ads.
---

# marketing-brain: audit-ads

Audits paid Meta Ads performance at both the account and per-campaign level. Compares actual results against the locked 3-campaign playbook, surfaces creative fatigue before it burns budget, and quantifies any gap between Meta Ads conversion counts and FUB qualified seller leads. The output `AdsAuditReport` feeds directly into `generate-briefs` to decide what creative, targeting, or budget changes to propose.

---

## When to use this skill

- The weekly brain cycle needs a paid-ads verdict before generating content briefs.
- Matt wants to know which campaign is wasting spend or needs new creative.
- A sudden CPL spike needs to be attributed to a specific campaign or a tracking failure.
- Before increasing or cutting ad budget — confirm the current state of all three campaigns.
- You are writing or debugging `lib/marketing-brain/audit-ads.ts`.

---

## The 3-campaign playbook context

Every audit is evaluated against the structure locked in `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`:

| Campaign | Audience type | Daily budget | Role |
|---|---|---|---|
| Cold Acquisition | Broad Bend metro | $30 | Find new homeowners who don't know Ryan Realty |
| Lookalike | 1% Lookalike from FUB past sellers | $20 | 30–50% lower CPL than cold |
| Retargeting | Site visitors to `/sell/*` in last 30 days | $10 | Highest-ROI type, warm leads |

**Total locked budget: $60/day = ~$1,800/month.**

Campaign role is inferred from campaign name keywords:
- **cold**: "cold", "acquisition", "awareness", "prospecting", "broad"
- **lookalike**: "lookalike", "lal", "similar", "past seller", "seed"
- **retargeting**: "retarg", "retarget", "remarketing", "site visitor", "website"

Campaigns that match none of these are classified as `unknown` — a campaign structure opportunity flag.

---

## What the audit covers

### 1. `analyzeCampaignPerformance(windowDays, asOfDate)`

Fetches campaign-scope rows from `marketing_channel_daily` and computes for each campaign:

| Field | Description |
|---|---|
| `spend` | Total spend in window |
| `impressions` | Total impressions |
| `clicks` | Total clicks |
| `cpm` | Average CPM across days |
| `cpc` | Average CPC across days |
| `ctr` | Average CTR across days |
| `conversions` | Total conversions (sum of lead + purchase events) |
| `cpl` | Cost per conversion (spend / conversions) |
| `cpl_ratio` | Campaign CPL / account CPL. 1.0 = at average. |
| `flags` | Per-campaign flags (see thresholds below) |

Flags raised per campaign:
- `underperforming_cpl` (high) — CPL > 2x account average CPL
- `no_conversions` (medium) — spend > $0, conversions = 0
- `low_spend` (low) — spend < $5 for the window (likely paused)

### 2. `detectCreativeFatigue(windowDays, asOfDate)`

Compares account-level CPM and CTR for the current 7 days vs the prior 7 days.

**Fatigue = BOTH conditions true simultaneously:**
- CPM rising > 25% WoW
- CTR falling > 15% WoW (negative)

Returns a `FatigueSignal` with `flagged: true` when fatigue is confirmed. Also returns early-warning details when only one condition is met.

### 3. `analyzeBudgetEfficiency(windowDays, asOfDate)`

Computes actual spend vs expected spend (`$60/day × windowDays`) and per-role expected vs actual.

**Budget drift = actual spend outside 85%–110% of playbook target.**

Returns account-level and per-role `BudgetEfficiency`. Unknown-role campaigns are reported separately.

### 4. `analyzeConversionPath(windowDays, asOfDate)`

Compares Meta Ads `conversions` (sum of `lead` + `offsite_conversion.fb_pixel_purchase` action events, stored as the `conversions` metric) against FUB `qualified_seller_leads` for the same window.

**Tracking gap = |meta_conversions - fub_qualified_leads| > 30% of meta_conversions.**

A large gap signals a Pixel misconfiguration, a FUB webhook failure, or a Meta attribution discrepancy.

### 5. `findOpportunities(campaigns, fatigue, budget, conversionPath)`

Derives up to 7 ranked `Opportunity` items. Severity order: high → medium → low.

| Condition | Area | Severity | Recommended action |
|---|---|---|---|
| Creative fatigue confirmed | creative | high | `test_new_creative` |
| Tracking gap > 30% | tracking | high | `check_tracking` |
| Campaign CPL > 2x account CPL | targeting | high | `review_targeting` |
| Account spend drift | budget | medium | `increase_budget` or `reduce_budget` |
| Campaign with zero conversions | campaign_structure | medium | `pause_underperformer` |
| Missing playbook role (no campaign found) | campaign_structure | medium | `investigate_drop` |
| Per-role budget drift | budget | low | `increase_budget` or `reduce_budget` |

---

## AdsAuditReport shape

```typescript
interface AdsAuditReport {
  as_of_date: string               // YYYY-MM-DD
  window_days: number              // audit window length
  campaigns: CampaignPerformance[] // one entry per discovered campaign
  fatigue: FatigueSignal           // creative fatigue analysis
  budget: BudgetEfficiency         // spend vs playbook targets
  conversion_path: ConversionPath  // Meta vs FUB attribution comparison
  opportunities: Opportunity[]     // max 7, ranked by severity
  generated_at: string             // ISO timestamp
}
```

Each `Opportunity`:
```typescript
interface Opportunity {
  area: 'creative' | 'targeting' | 'budget' | 'tracking' | 'campaign_structure'
  severity: 'high' | 'medium' | 'low'
  headline: string
  evidence: string
  recommended_action: RecommendedAction  // from the diagnose vocabulary (10 tags)
}
```

---

## Thresholds (locked)

| Threshold | Value | Rule |
|---|---|---|
| Creative fatigue — CPM | > 25% WoW | Must co-occur with CTR drop to flag fatigue |
| Creative fatigue — CTR | < −15% WoW | Must co-occur with CPM rise to flag fatigue |
| Budget drift (high) | > 110% of target | Over-pacing |
| Budget drift (low) | < 85% of target | Under-pacing |
| CPL underperformance | > 2x account CPL | Flag campaign as underperforming |
| Tracking gap | \|delta\| > 30% of meta_conversions | Flag as tracking concern |

---

## Recommended-action vocabulary

`audit-ads` uses only actions from the `diagnose-performance` vocabulary. No new tags are introduced.

| Tag | When emitted |
|---|---|
| `test_new_creative` | Creative fatigue confirmed |
| `check_tracking` | Meta vs FUB conversion gap > 30% |
| `review_targeting` | Campaign CPL > 2x account average |
| `increase_budget` | Account or role under-pacing vs playbook |
| `reduce_budget` | Account or role over-pacing vs playbook |
| `pause_underperformer` | Campaign spent with zero conversions |
| `investigate_drop` | Missing playbook campaign role |

---

## Data requirements

Reads only from `public.marketing_channel_daily`:
- `channel='meta_ads'`, `scope='account'` — account-level totals (spend, cpm, ctr, conversions)
- `channel='meta_ads'`, `scope='campaign'` — per-campaign rows with `metadata.campaign_name`
- `channel='fub'`, `scope='account'`, `metric='qualified_seller_leads'` — FUB lead count

The ingestor (`app/api/cron/marketing-snapshot-meta-ads/route.ts`) must have run for the window. No direct API calls are made from `audit-ads.ts`.

**Minimum data for reliable output:** 14 days for fatigue detection (needs a prior 7-day window). The 7-day fatigue check degrades gracefully when prior-week data is missing — it returns `flagged: false` with null WoW values.

---

## HTTP trigger

```
GET /api/marketing-brain/audit/ads?asOfDate=2026-05-12&windowDays=30
Authorization: Bearer $CRON_SECRET
```

- `asOfDate` optional. Defaults to yesterday UTC.
- `windowDays` optional integer (1–365). Defaults to 30.
- Returns `AdsAuditReport` JSON.

---

## Extending this skill

**Adding a new campaign role:** add keywords to the `ROLE_KEYWORDS` array in `audit-ads.ts` and add the daily budget to `PLAYBOOK_DAILY_BY_ROLE`. Update the playbook table in this SKILL.md.

**Adding a new flag type:** add to the `CampaignFlag['type']` union, implement the detection logic in `analyzeCampaignPerformance`, add an opportunity derivation case in `findOpportunities`, and document the threshold in the table above.

**Changing thresholds:** update the named constants at the top of `audit-ads.ts` (`FATIGUE_CPM_WOW_THRESHOLD`, `FATIGUE_CTR_WOW_THRESHOLD`, `BUDGET_HIGH_THRESHOLD`, `BUDGET_LOW_THRESHOLD`, `CPL_RATIO_THRESHOLD`, `TRACKING_GAP_THRESHOLD`) and the locked-thresholds table in this file. Threshold changes require Matt sign-off — they gate what gets flagged as an opportunity.

---

## Related skills

- `marketing-brain:diagnose-performance` — upstream signal layer; provides `RecommendedAction` vocabulary used by this skill.
- `marketing-brain:snapshot-channels` — upstream ingestor; writes the `meta_ads` rows this skill reads.
- `marketing-brain:generate-briefs` — downstream; consumes `AdsAuditReport.opportunities` to propose creative or budget changes.
- `marketing-brain:weekly-cycle` — orchestrates snapshot + diagnose + audit-ads + generate-briefs in sequence.
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` — source of truth for the 3-campaign architecture and budget targets.
