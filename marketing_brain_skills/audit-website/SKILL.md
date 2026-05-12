---
name: marketing-brain-audit-website
description: Audit Ryan Realty's website performance — traffic sources, SEO, conversion funnel, page-level engagement, and lead-gen path effectiveness. Produces a structured WebsiteAuditReport consumed by generate-briefs. Reads from public.marketing_channel_daily (ga4 + gsc + fub channels only — no direct API calls). Manual trigger at /api/marketing-brain/audit/website. Core logic in lib/marketing-brain/audit-website.ts.
---

# marketing-brain: audit-website

Website performance audit for the marketing brain. Reads the metrics written by `snapshot-channels` (ga4, gsc, fub) and produces a structured `WebsiteAuditReport`: traffic source quality, funnel drop-off analysis, top-page conversion rates, GSC SEO signal, and a ranked opportunity list. The downstream `generate-briefs` skill consumes `WebsiteAuditReport.opportunities` to decide what content or landing-page work to propose next.

---

## When to use this skill

- The weekly brain cycle needs a website signal layer before generating content briefs.
- Matt asks "which pages are leaking leads?" or "where is the funnel breaking?"
- You want to know which traffic source sends the most qualified visitors.
- An SEO query is gaining or losing position and you need the data quantified.
- You are writing or debugging `lib/marketing-brain/audit-website.ts`.

---

## What the audit covers

| Section | Function | Source channels | Scope |
|---|---|---|---|
| Traffic sources | `analyzeTrafficSources` | ga4, fub | source |
| Funnel | `analyzeFunnel` | ga4, fub | account |
| Top pages | `analyzeTopPages` | ga4 | page |
| SEO | `analyzeSEO` | gsc | source, page |
| Opportunities | `findOpportunities` | synthesized | — |

---

## Data requirements

- Minimum **14 non-zero days** of ga4 `sessions` data for the window before the audit runs.
- When this threshold is not met, `auditWebsite` returns `status: 'insufficient_data'` immediately with a `missing_data` array listing which channels and metrics are short, and an empty `opportunities` array.
- GSC and FUB data that falls below 14 days is noted in `missing_data` but does not by itself block the audit — the audit degrades gracefully (SEO or funnel sections will have sparse data).

---

## WebsiteAuditReport shape

```typescript
interface WebsiteAuditReport {
  as_of_date: string        // YYYY-MM-DD
  window_days: number       // audit window length
  status: 'ok' | 'insufficient_data'
  missing_data?: DataAvailabilityFlag[]   // only when status === 'insufficient_data'
  traffic_sources?: TrafficSourcesAnalysis
  funnel?: FunnelAnalysis
  top_pages?: TopPagesAnalysis
  seo?: SEOAnalysis
  opportunities: Opportunity[]            // max 7, ranked; empty on insufficient_data
}
```

---

## Qualified traffic definition

Used in `analyzeTrafficSources` to distinguish real, attentive visitors from bot traffic, referral spam, and zero-depth pageviews.

A source-medium is **qualified** when:
1. `engaged_sessions / sessions >= 0.50` (engagement rate at least 50%)
2. `sessions >= 20` in the audit window

The `top_by_quality` ranking in `TrafficSourcesAnalysis` is restricted to qualified sources. `top_by_volume` ranks all sources without this filter.

---

## Funnel definition

```
sessions → engaged_sessions → lead_events → qualified_seller_leads
```

- **sessions**: total GA4 sessions (account scope, channel='ga4')
- **engaged_sessions**: sessions with >= 10s engagement, >= 1 conversion, or >= 2 pageviews (GA4 definition; stored by snapshot ingestor)
- **lead_events**: GA4 custom events tagged as lead actions (form submits, call clicks, etc.)
- **qualified_seller_leads**: FUB count of leads tagged as qualified seller prospects (channel='fub', metric='qualified_seller_leads')

Drop-off rate at each step = `(prev_step_value - step_value) / prev_step_value`.

---

## Opportunity type

```typescript
interface Opportunity {
  area: 'seo' | 'funnel' | 'traffic' | 'page'
  severity: 'high' | 'medium' | 'low'
  headline: string              // plain-English one-liner
  evidence: string              // numbers from the data
  recommended_action: RecommendedAction  // see vocabulary below
}
```

---

## Opportunity scoring rules

Opportunities are ranked high → medium → low, then by area (funnel > page > seo > traffic). At most 7 are returned.

| Trigger | Area | Severity | Action |
|---|---|---|---|
| Funnel drop-off >= 80% at any step | funnel | high | `audit_landing_page` or `investigate_drop` |
| Funnel drop-off 50–79% at any step | funnel | medium | `audit_landing_page` or `investigate_drop` |
| High-traffic page with low conversion (> 2× median sessions) | page | high | `audit_landing_page` |
| High-traffic page with low conversion (within 2× median) | page | medium | `audit_landing_page` |
| Page in top-quartile impressions, bottom-quartile CTR | seo | medium | `test_new_creative` |
| GSC query losing position (position_delta > 1) | seo | medium | `investigate_drop` |
| GSC query gaining position (position_delta < -1) | seo | low | `capitalize_on_spike` |
| Traffic source WoW declining > 5% | traffic | low | `investigate_drop` |

---

## Recommended-action vocabulary

A strict subset of the 10 tags defined in `lib/marketing-brain/diagnose.ts`. The audit uses only these five:

| Tag | When emitted |
|---|---|
| `audit_landing_page` | High-traffic page or funnel step not converting |
| `investigate_drop` | Funnel crash, position loss, or declining source |
| `capitalize_on_spike` | GSC query gaining ground — content opportunity |
| `test_new_creative` | High impressions, low CTR — title/meta refresh needed |
| `pause_underperformer` | (reserved for future funnel logic — not currently emitted) |

All 10 tags from `diagnose.ts` remain in scope for future extensions. Do not add new tags here — extend `diagnose.ts` first, then update this table.

---

## HTTP trigger

```
GET /api/marketing-brain/audit/website?asOfDate=2026-05-12&windowDays=30
Authorization: Bearer $CRON_SECRET
```

- `asOfDate` optional. Defaults to server date (today). Format: YYYY-MM-DD.
- `windowDays` optional. Defaults to 30. Minimum 14 (enforced by the route).
- Returns `WebsiteAuditReport` as JSON.

---

## Data flow

```
snapshot-channels (ga4, gsc, fub ingestors)
       ↓
marketing_channel_daily
       ↓
audit-website (this skill)
       ↓
WebsiteAuditReport
       ↓
generate-briefs
```

---

## Related skills

- `marketing-brain:snapshot-channels` — upstream; writes ga4, gsc, fub rows to `marketing_channel_daily`.
- `marketing-brain:diagnose-performance` — sibling; computes WoW/MoM deltas and anomaly z-scores per channel. Shares the `RecommendedAction` vocabulary.
- `marketing-brain:generate-briefs` — downstream; consumes `WebsiteAuditReport.opportunities`.
- `marketing-brain:weekly-cycle` — orchestrates snapshot + diagnose + audit + generate-briefs in sequence.
