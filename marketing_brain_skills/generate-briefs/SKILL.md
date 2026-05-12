---
name: marketing-brain-generate-briefs
description: The synthesis layer of the marketing brain. Gathers signals from all four audits plus diagnose, competitor intel, and platform trends. Synthesizes ranked opportunities. Maps each opportunity to 0-N content briefs validated against the Ryan Realty voice. Persists to content_briefs and marketing_decisions. Core logic in lib/marketing-brain/generate-briefs.ts. HTTP trigger at /api/marketing-brain/generate-briefs.
---

# marketing-brain: generate-briefs

The most important skill in the marketing brain. Everything upstream — the four audits, the diagnose layer, competitor-recon, platform-trends — feeds into this skill. It decides what content to make, in what format, for which audience, based on what the data actually says. It enforces the brand voice before anything ships.

---

## When to use this skill

- The weekly brain cron fires and needs to produce the week's content briefs.
- Matt wants to know what the brain would recommend making right now (run with `dryRun=true`).
- An audit has surfaced a high-severity opportunity and briefs need to be generated immediately without waiting for the weekly cycle.
- You are debugging why a brief was or was not generated.
- You are adding a new opportunity-to-brief mapping.

---

## Input: the SignalBundle

`gatherSignals(asOfDate, windowDays=7)` runs all reads in parallel and returns:

| Field | Source | Notes |
|---|---|---|
| `websiteAudit` | `auditWebsite()` | GA4, GSC, FUB sessions/leads/SEO |
| `adsAudit` | `auditAds()` | Meta Ads campaigns, fatigue, budget, conversion path |
| `crmAudit` | `auditCRM()` | FUB leads, pipeline health, north-star metric |
| `channelInsights` | `generateInsightSummary()` per channel | WoW/MoM deltas, anomalies, recommended_actions |
| `platformTrends` | `gatherPlatformTrends()` | Algorithm signals, format trends, audio trends |
| `competitorRows` | Supabase `competitor_intel` | Recent competitor SERP and video observations |

Every sub-audit fails softly — if `auditAds` throws, the rest of the pipeline still runs with an empty ads result. No single source failure stops brief generation.

---

## Opportunity ranking: synthesizeOpportunities

All opportunities from every source are merged and ranked by:

```
rank_score = severity_score × north_star_weight
  severity_score: high=3, medium=2, low=1
  north_star_weight: 2 if area relates to qualified_seller_leads, else 1
```

**North-star areas (weight=2):** `north_star`, `source_quality`, `tagging_drift`, `pipeline_health`, `creative`, `targeting`.

The north-star metric is `qualified_seller_leads`. Any opportunity whose area can plausibly drive more qualified seller leads is worth double the weight in the ranking. This ensures CRM health and ad creative issues always surface above low-priority SEO cleanup.

Tie-breaking: severity descending, then source priority (crm > ads > website > competitor > platform-trend > diagnose).

---

## Opportunity → brief mapping

| Opportunity source + area / recommended_action | Brief format(s) | Platforms | Audience |
|---|---|---|---|
| `audit-crm` `north_star` (drop or shift) | `fb_ad_creative` + `ig_reel` | facebook, instagram | `out_of_state_seller` |
| `audit-ads` `test_new_creative` | `fb_ad_creative` × 3 variants: data, question, contrarian | facebook | matches campaign audience from audit |
| `audit-ads` `capitalize_on_spike` | `ig_reel` | instagram, tiktok | matches winning campaign audience |
| `audit-website` `seo` (losing query or low CTR) | `blog_post` targeting that query | blog | `search_intent_match` |
| `audit-website` `page` (high traffic, low conversion) | **NO brief** — CRO task. Logged as `marketing_decisions` only | — | — |
| `competitor` `serp_gap` | `blog_post` targeting the gap query | blog | `search_intent_match` |
| `competitor` `format_gap` | `tiktok_reel` or `ig_reel` adapted to our voice | tiktok or instagram | `brand_default` |
| `platform-trend` `act_on` | Format matching the trend type on the trend's platform | trend's platform | `brand_default` |
| `diagnose` `capitalize_on_spike` | Repeat-the-format brief in the channel's native format | the spiking channel | `brand_default` |

**Opportunities that never produce a brief:** page-leak CRO tasks (area=`page`, recommended_action=`audit_landing_page`). These go straight to `marketing_decisions` as `decision_type='audit_finding'` so Matt sees them but no content creation is triggered.

---

## Brand voice enforcement: applyBrandVoice

Every brief's hook, body, and CTA are concatenated and checked against `marketing_brain_skills/brand-voice/voice_guidelines.md` §6 hard-fail rules in four layers:

1. **§6.1 Banned punctuation** — em dash (—), semicolon (;), dramatic ellipsis-colon pattern. Checked by regex.
2. **§6.2 Banned words** — 31 real-estate clichés + AI-filler words + vague qualifiers. Checked by whole-word regex, case-insensitive.
3. **§6.3 Banned phrases** — 19 specific phrases including hype openings, pandering, talking-down constructions, marketing slop, and fake urgency. Substring match, case-insensitive.
4. **§6.4 Banned tropes** — regex patterns for agent-as-hero framing, market-doom/hype language, and guaranteed-outcome claims.

All violations are collected (not just the first). `applyBrandVoice` returns `{ passed: boolean; violations: string[] }` with each violation citing the specific guideline section (e.g., `§6.2 Banned words: "stunning"`).

**What happens on a voice fail:** the brief is still stored in `content_briefs` with `status='pending'`. The `generation_reason` field is appended with `VOICE_FAIL: <violations>`. A `marketing_decisions` row is also inserted with `decision_type='voice_violation'`. Matt sees both. The brief sits in `pending` until Matt edits and approves it. We log rather than discard so the violation pattern is visible over time.

---

## Persistence flow

`persistBriefs(briefs, opportunities, opts)`:

1. For each brief, INSERT into `content_briefs` with `status='pending'`, `generated_by='marketing_brain:generate-briefs'`.
2. For each brief, INSERT into `marketing_decisions` with `decision_type='brief_generated'` (or `'voice_violation'` if validation failed). `data_observed` contains the data_sources evidence and voice_validation result. `rules_cited` contains the audit thresholds that triggered the opportunity.
3. For each page-leak opportunity that produced no brief, INSERT into `marketing_decisions` with `decision_type='audit_finding'`.
4. When `dryRun=true`, skip all writes and return the would-be brief array.

---

## The GeneratedBrief interface

```typescript
interface GeneratedBrief {
  topic: string                          // What this brief is about
  format: string                         // Skill name: fb_ad_creative, ig_reel, tiktok_reel, blog_post
  platforms: string[]                    // Distribution channels: facebook, instagram, tiktok, blog
  hook: string                           // First line / opening text (voice-validated)
  body?: string                          // Supporting copy (optional for short formats)
  cta?: string                           // Call to action (optional)
  target_audience: string                // out_of_state_seller | brand_default | search_intent_match | past_seller_lookalike | site_visitor_seller
  data_sources: DataSource[]             // [{ type, evidence }] — sourced signals that triggered this brief
  predicted_outcome: PredictedOutcome    // { primary_metric, expected_value, rationale }
  generation_reason: string              // Human-readable explanation of why this brief was created
  voice_validation: VoiceValidation      // { passed: boolean, violations: string[] }
}
```

Every field maps directly to a column in `content_briefs`. Persistence is a straight destructure — no transform needed.

---

## Predicted outcome rationale

The rationale must cite the signal. It follows this pattern:

> "Qualified seller leads dropped [X%] WoW. A direct-response FB ad targeting out-of-state Bend homeowners historically recovers 1-2 leads/week when seller-intent copy leads. Based on CRM attribution over the last 30 days."

Rationale must name: the signal (the observation), the mechanism (why this action helps), and the evidence base (what historical data or attribution pattern supports the expected value).

Do not use "approximately," "roughly," or vague projections. If the evidence base is thin, say so in the rationale rather than inflating the expected value.

---

## What happens to opportunities that don't map to briefs

Two categories:

1. **Page-leak CRO tasks** (area=`page`, recommended_action=`audit_landing_page`): logged as `marketing_decisions` with `decision_type='audit_finding'` and `decision_summary` describing the leak. No content_briefs row. Matt sees this as a site fix task, not a content task.

2. **Opportunities below the maxBriefs cap**: if 10 briefs are already queued and more opportunities remain, the remaining opportunities are not processed in this run. They will resurface in the next weekly cycle if still present in the data.

---

## Cap and noise prevention

Default `maxBriefs=10`. Beyond 10 the brain is generating noise. If 10 briefs per week is too many for the production team to execute, lower the cap. The ranking ensures the most important briefs are always in the first N slots.

The cap applies to the total brief count, not the opportunity count. A single `test_new_creative` opportunity generates 3 brief variants — those count as 3 against the cap.

---

## HTTP route

**GET** `/api/marketing-brain/generate-briefs`

Auth: `Authorization: Bearer $CRON_SECRET`

| Param | Default | Notes |
|---|---|---|
| `asOfDate` | yesterday UTC | YYYY-MM-DD |
| `dryRun` | `false` | `true` = no DB writes |
| `maxBriefs` | `10` | Integer 1-50 |

Returns:
```json
{
  "asOfDate": "2026-05-11",
  "dryRun": false,
  "count": 7,
  "briefs": [ ...GeneratedBrief[] ]
}
```

---

## Related skills

| Skill | Relationship |
|---|---|
| `audit-ads` | Upstream — provides `AdsAuditReport.opportunities` |
| `audit-crm` | Upstream — provides `CRMAuditReport.opportunities`, north-star metric |
| `audit-website` | Upstream — provides `WebsiteAuditReport.opportunities` (SEO, funnel, page) |
| `diagnose-performance` | Upstream — provides `InsightSummary` per channel |
| `platform-trends` | Upstream — provides `PlatformTrendsReport.ryan_realty_adaptations.act_on` |
| `competitor-recon` | Upstream — provides `competitor_intel` rows |
| `brand-voice` | Enforced at every brief — `applyBrandVoice` runs §6 rules on every hook/body/cta |
| `snapshot-channels` | Foundation — populates `marketing_channel_daily` that all audits read |
