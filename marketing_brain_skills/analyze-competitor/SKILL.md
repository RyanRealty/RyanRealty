---
name: analyze-competitor
description: >
  Brain-internal deep dive on a named Bend competitor's marketing surface. Pulls
  and analyzes post cadence, content mix, ad creative, listing count, and agent
  activity using Apify actors and the competitor_intel table. Writes structured
  findings to marketing_decisions. No published output. No approval gate. Sister to
  competitor-recon which runs the weekly data collection scrape.
action_types:
  - analyze:competitor_scan
  - analyze:competitor_report
output_type: operational
target_platforms: []
asset_destination: marketing_decisions Supabase table
auto_inputs: ['competitor_social_data', 'competitor_listing_data']
required_inputs: ['competitor_name or mls_agent_id']
optional_inputs: ['lookback_days (default 30)', 'platforms_to_check']
estimated_runtime_min: 15
cost_usd_estimate: $0-$5 (Apify scrapes)
thumbnail_uri: out/proof/2026-05-17/exemplars/analyze-competitor/report.json
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: internal

---

# analyze-competitor

**Scope:** Brain-internal per-competitor deep dive skill. Reads from `competitor_intel`
(populated by `competitor-recon`) and the `listings` table, then produces a structured
`CompetitorAnalysisFindings` object written back as a `marketing_decisions` row. This
producer never publishes content, modifies ad accounts, or sends alerts. Every finding
is data. Downstream, `generate-briefs` reads the findings to surface content gaps and
counter-moves as action rows.

Does NOT run the weekly data collection scrape (that is `competitor-recon`). Does NOT
post content or send alerts (those are content and comms producers). Does NOT audit
Ryan Realty's own channels (that is `audit-website`, `audit-ads`, `audit-crm`).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `marketing_decisions` row with `decision_type='competitor_analysis'`

---

## 1. Scope

### In scope

- `analyze:competitor_scan`: a targeted, single-competitor deep dive triggered by a
  signal (traffic drop, new competitor ad, listing surge) or a manual request
- `analyze:competitor_report`: a full comparative report across all 10 tracked
  competitors or a named subset, used by `generate-briefs` during the weekly cycle

### Out of scope

- Running Apify scrapes in real time (that is `competitor-recon`; this producer reads
  from the already-scraped `competitor_intel` table)
- Alerting Matt directly (if findings are critical, `generate-briefs` enqueues a
  `comms:matt_alert` action)
- Producing content to counter competitor activity (that is the downstream producers
  that `generate-briefs` dispatches after reading this skill's findings)
- Competitive bidding or ad-spend analysis for Ryan Realty's own campaigns

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `analyze:competitor_scan` | `competitor_slug`, `analysis_scope`, `asOfDate`, `lookback_days` | `focus_area` optional |
| `analyze:competitor_report` | `competitor_slugs[]`, `asOfDate`, `lookback_days` | empty array = all 10 tracked competitors |

### Payload schema

```typescript
type CompetitorSlug =
  | 'cascade_hasson_sothebys'
  | 'compass_bend'
  | 'windermere_central_oregon'
  | 'cascade_sothebys'
  | 'coldwell_banker_bain_bend'
  | 'berkshire_hathaway_nw_bend'
  | 'john_l_scott_bend'
  | 'remax_key_properties_bend'
  | 'opendoor'
  | 'offerpad';

interface CompetitorAnalysisPayload {
  competitor_slug?: CompetitorSlug;         // required for analyze:competitor_scan
  competitor_slugs?: CompetitorSlug[];      // required for analyze:competitor_report; [] = all
  analysis_scope: 'social' | 'listings' | 'ads' | 'serp' | 'reviews' | 'full';
  asOfDate: string;                         // YYYY-MM-DD
  lookback_days: number;                    // typically 30 or 90
  focus_area?: string;                      // optional: 'post_cadence' | 'ad_creative' | 'agent_growth'
}
```

---

## 3. Full action row schema

```typescript
interface CompetitorAnalysisActionRow {
  id: string;
  action_type: 'analyze:competitor_scan' | 'analyze:competitor_report';
  target: string;                           // e.g. 'competitor:compass_bend' or 'competitors:all'
  assigned_producer: string;                // 'marketing_brain_skills/analyze-competitor'
  payload: CompetitorAnalysisPayload;
  data_evidence: {
    audit_source?: string;                  // e.g. 'audit-website'
    trigger_signal?: string;               // e.g. 'traffic drop 2026-05-10 to 2026-05-17'
    signal_evidence?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1: Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

**Step 2: Load mandatory references**

- `CLAUDE.md` §0: Data Accuracy (all figures traced to live queries in this session)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last (no published output from this producer)
- `design_system/ryan-realty/SKILL.md`: brand context (for framing findings)
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: findings are internal, but all
  quoted competitor copy must be clearly attributed and not misrepresented
- `marketing_brain_skills/research/tool-inventory.md`: Apify status (§1.6 Apify section);
  verify `APIFY_API_TOKEN` is set
- `marketing_brain_skills/research/platform-bible.md`: platform-specific engagement norms
  used as comparison benchmarks
- `marketing_brain_skills/research/asset-library-map.md`: not required for analysis; note
  that any competitor screenshots are for internal analysis only, never published
- `marketing_brain_skills/research/bend-market-bible.md`: §10 for the competitor brokerage
  roster and context; §1 for neighborhood context when analyzing listing inventory

Read `marketing_brain_skills/competitor-recon/SKILL.md` for the 10 competitor slugs,
the 5 Apify actor IDs, the row taxonomy for `competitor_intel`, and the SERP query list.

**Step 3: Determine target competitors**

For `analyze:competitor_scan`: targets = `[payload.competitor_slug]`.

For `analyze:competitor_report`: if `payload.competitor_slugs` is empty or `['all']`,
use all 10 locked slugs from `competitor-recon/SKILL.md`. Otherwise use the provided
list. Validate every slug against the locked 10; kill if an unknown slug is encountered.

**Step 4: Check data availability in competitor_intel**

For each target competitor and each source in scope:

```sql
SELECT source, COUNT(*) AS row_count, MAX(observation_date) AS most_recent
FROM competitor_intel
WHERE competitor = '<slug>'
  AND observation_date >= (CAST('<asOfDate>' AS date) - INTERVAL '<lookback_days> days')
GROUP BY source;
```

Minimum data requirement: at least 1 row per source in the lookback window for the
analysis to proceed. If no data exists for a competitor-source pair:
- Note "no data available" for that pair in the findings.
- Continue with available data. Do not kill the action row.

If zero data rows exist for the entire competitor: note and skip. Continue with others
in `analyze:competitor_report`.

**Step 5: Social media analysis (IG + TikTok)**

When `analysis_scope` includes 'social' or 'full':

Pull recent posts:
```sql
SELECT
  competitor,
  data ->> 'timestamp' AS post_date,
  CAST(data ->> 'likes' AS int) AS likes,
  CAST(data ->> 'comments' AS int) AS comments,
  CAST(data ->> 'plays' AS int) AS plays,
  data ->> 'caption_text' AS caption
FROM competitor_intel
WHERE competitor = '<slug>'
  AND source IN ('instagram_profile', 'tiktok_profile')
  AND data_type = 'post'
  AND observation_date >= (CAST('<asOfDate>' AS date) - INTERVAL '<lookback_days> days')
ORDER BY post_date DESC;
```

Compute:
- `posts_per_week`: total posts / (lookback_days / 7)
- `avg_engagement_rate`: mean((likes + comments) / followers) per post, for IG
- `avg_play_count`: mean plays for TikTok posts
- `content_type_mix`: count of listing posts vs. market-data posts vs. lifestyle posts
  vs. other (classify by caption keyword scan: listing if contains price or MLS,
  market-data if contains percentage or "days", lifestyle if no price/market signal)
- `top_performing_post`: the post with highest (likes + comments) in the window

Also pull profile-level metrics:
```sql
SELECT
  data ->> 'followers_count' AS followers,
  data ->> 'posts_count' AS post_count,
  observation_date
FROM competitor_intel
WHERE competitor = '<slug>'
  AND source = 'instagram_profile'
  AND data_type = 'profile_metric'
ORDER BY observation_date DESC
LIMIT 2;
```

Compute follower growth if 2+ data points exist: `(latest - prior) / prior * 100`.

**Step 6: Paid ads analysis (Meta)**

When `analysis_scope` includes 'ads' or 'full':

```sql
SELECT
  data ->> 'ad_creative_type' AS creative_type,
  data ->> 'cta_type' AS cta_type,
  data ->> 'body_text' AS body_text,
  data ->> 'impressions_lower' AS impressions_lower,
  data ->> 'impressions_upper' AS impressions_upper,
  observation_date
FROM competitor_intel
WHERE competitor = '<slug>'
  AND source = 'fb_ad_library'
  AND data_type = 'ad'
  AND observation_date >= (CAST('<asOfDate>' AS date) - INTERVAL '<lookback_days> days')
ORDER BY observation_date DESC;
```

Compute:
- `active_ad_count`: number of unique active ads
- `dominant_creative_type`: most common `creative_type` value
- `dominant_cta`: most common `cta_type`
- `avg_impressions_midpoint`: mean of `(impressions_lower + impressions_upper) / 2`
- `ad_messaging_themes`: keyword scan of body_text for price claims, seller funnel
  language, buyer funnel language, brand/awareness language

If no ads data: note "no active ads in Meta Ad Library for this window."

**Step 7: SERP position analysis**

When `analysis_scope` includes 'serp' or 'full':

```sql
SELECT
  data ->> 'query' AS query,
  CAST(data ->> 'position' AS int) AS position,
  data ->> 'url' AS url,
  observation_date
FROM competitor_intel
WHERE competitor = '<slug>'
  AND source = 'google_serp'
  AND data_type = 'serp_position'
  AND observation_date >= (CAST('<asOfDate>' AS date) - INTERVAL '<lookback_days> days')
ORDER BY query, observation_date DESC;
```

For each of the 10 locked SERP queries in `competitor-recon/SKILL.md`, find the most
recent position for this competitor. Compare against Ryan Realty's own GSC position
(from `marketing_channel_daily` if available, or note as "Ryan Realty GSC data needed").

Flag any query where the competitor ranks in the top 5 and Ryan Realty ranks outside
the top 10.

**Step 8: Listing inventory analysis**

When `analysis_scope` includes 'listings' or 'full':

Pull the competitor's active and recently closed listings from the Supabase `listings`
table (MLS data is shared, so competitor listings are in the same table):

```sql
SELECT
  "ListAgentEmail",
  "ListAgentFullName",
  "ListOfficeName",
  COUNT(*) FILTER (WHERE "StandardStatus" = 'Active') AS active_count,
  COUNT(*) FILTER (WHERE "StandardStatus" = 'Closed'
    AND "CloseDate" >= date_trunc('year', now())) AS ytd_closed,
  AVG("CumulativeDaysOnMarket") FILTER (WHERE "StandardStatus" = 'Closed'
    AND "CloseDate" >= date_trunc('year', now()))::int AS avg_dom_ytd
FROM listings
WHERE "ListOfficeName" ILIKE '%<brokerage_name_fragment>%'
  AND "PropertyType" = 'A'
GROUP BY "ListAgentEmail", "ListAgentFullName", "ListOfficeName";
```

Use the brokerage name keywords from `marketing_brain_skills/research/bend-market-bible.md`
§10 (top brokerage offices). Never guess the brokerage name; use the exact MLS office
name strings confirmed in that section.

Compute:
- `total_active_listings`: sum across all agents
- `ytd_closed_count`: sum of YTD closed
- `avg_dom_ytd`: volume-weighted average

**Step 9: GMB reviews analysis**

When `analysis_scope` includes 'reviews' or 'full':

```sql
SELECT
  CAST(data ->> 'rating' AS float) AS rating,
  data ->> 'text' AS review_text,
  data ->> 'published_at' AS published_at
FROM competitor_intel
WHERE competitor = '<slug>'
  AND source = 'google_maps_reviews'
  AND data_type = 'review'
  AND observation_date >= (CAST('<asOfDate>' AS date) - INTERVAL '<lookback_days> days')
ORDER BY published_at DESC;
```

Compute:
- `review_count_in_window`: row count
- `avg_rating_in_window`: mean rating
- `most_common_praise_theme`: keyword frequency in positive reviews (rating >= 4)
- `most_common_complaint_theme`: keyword frequency in negative reviews (rating <= 2)

**Step 10: Synthesize findings**

Build the `CompetitorAnalysisFindings` object:

```typescript
interface CompetitorAnalysisFindings {
  competitor_slug: CompetitorSlug;
  analysis_scope: string;
  lookback_days: number;
  asOfDate: string;
  produced_at: string;

  social?: {
    posts_per_week: number;
    avg_engagement_rate_pct: number;
    avg_play_count_tiktok?: number;
    content_type_mix: Record<string, number>;
    follower_growth_pct?: number;
    top_performing_post_summary: string;
  };

  ads?: {
    active_ad_count: number;
    dominant_creative_type: string;
    dominant_cta: string;
    avg_impressions_midpoint: number;
    ad_messaging_themes: string[];
  };

  serp?: {
    queries_ranked_top_5: string[];
    queries_outranking_ryan_realty: string[];
    avg_position: number;
  };

  listings?: {
    total_active_listings: number;
    ytd_closed_count: number;
    avg_dom_ytd: number;
    agent_count: number;
  };

  reviews?: {
    review_count_in_window: number;
    avg_rating_in_window: number;
    most_common_praise_theme: string;
    most_common_complaint_theme: string;
  };

  gaps_identified: string[];         // e.g. ["Compass Bend ranks #3 for 'sell my home bend'"]
  counter_moves: string[];           // action_type suggestions for generate-briefs
  data_completeness_pct: number;     // what % of scopes had at least 1 data row
}
```

For `analyze:competitor_report` (multi-competitor): produce one `CompetitorAnalysisFindings`
object per competitor, then synthesize a `CompetitorReportSummary`:

```typescript
interface CompetitorReportSummary {
  competitors_analyzed: CompetitorSlug[];
  overall_social_leader: CompetitorSlug;    // highest posts_per_week * avg_engagement
  overall_ads_leader: CompetitorSlug;       // highest avg_impressions_midpoint
  overall_serp_leader: CompetitorSlug;      // most queries in top 5
  top_3_gaps_for_ryan_realty: string[];
  top_3_counter_moves: string[];
  individual_findings: CompetitorAnalysisFindings[];
}
```

**Step 11: Write findings to marketing_decisions**

```sql
INSERT INTO marketing_decisions (
  decision_type,
  description,
  decided_at,
  outcome,
  metadata
) VALUES (
  'competitor_analysis',
  '<one-sentence summary: competitor, scope, top finding>',
  now(),
  'findings_produced',
  '<CompetitorAnalysisFindings or CompetitorReportSummary as jsonb>'::jsonb
);
```

**Step 12: Enqueue high-priority counter-moves**

For each `counter_move` that maps to a valid action_type in REGISTRY.md and where
`data_completeness_pct >= 50`:

```sql
INSERT INTO marketing_brain_actions (
  action_type, target, assigned_producer, payload, generation_reason, status
) VALUES (
  '<action_type>',
  '<target>',
  '<assigned_producer from REGISTRY.md>',
  '<payload jsonb>',
  'Counter-move from analyze-competitor: <slug> scan on <asOfDate>',
  'pending'
);
```

Deduplication: do not re-enqueue if an identical action_type + target combination
has a pending or in_production row created in the last 7 days.

**Step 13: Update action row**

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "findings_decision_id": "<uuid>",
      "competitors_analyzed": <count>,
      "top_finding": "<one sentence>",
      "counter_moves_enqueued": <count>,
      "data_completeness_pct": <number>
    }'::jsonb
WHERE id = '<id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | `competitor_intel` reads; `marketing_decisions` writes; `marketing_brain_actions` updates | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Apify MCP (`mcp__Apify__call-actor`) | Ad-hoc real-time scrape if `competitor_intel` data is stale by more than 7 days and `analysis_scope='ads'` | `APIFY_API_TOKEN` (via tool-inventory.md §1.6) |
| `marketing_brain_skills/competitor-recon/SKILL.md` | Slug registry, Apify actor IDs, row taxonomy, SERP query list | read-only reference |

**Apify actors available (from tool-inventory.md §1.6):**
- `compass/Google-Maps-Reviews-Scraper`: GMB reviews
- `apify/google-search-scraper`: SERP positions
- `apify/instagram-profile-scraper`: IG profile + posts
- `clockworks/free-tiktok-scraper`: TikTok posts
- `apify/facebook-ads-scraper`: Meta Ad Library

Use Apify MCP for real-time pulls only when `competitor_intel` has no data for the
target competitor-source combination in the lookback window. Prefer the pre-scraped
table for speed and cost efficiency.

---

## 6. Output format

**Primary output:** `marketing_decisions` row with `decision_type='competitor_analysis'`

**No file system output.** No `out/` directory. No scorecard. No Matt-facing contact
sheet from this producer directly.

**executor_response (written to action row):**
```json
{
  "findings_decision_id": "uuid",
  "competitors_analyzed": 1,
  "top_finding": "Compass Bend ranks #3 for 'sell my home bend' while Ryan Realty is not in the top 10 for that query.",
  "counter_moves_enqueued": 2,
  "data_completeness_pct": 80
}
```

---

## 7. Approval gate

| approval_type | what it means |
|---|---|
| `none` | Brain-internal analysis only. Produces structured findings and database rows. No published content. No changes to live marketing systems except `marketing_decisions` inserts and `marketing_brain_actions` inserts. |

This producer never publishes content or modifies ad accounts, CRM, or the website.
The `none` gate is correct and permanent for this producer.

---

## 8. Status flow

```
pending       <- producer reads row here
  |
  v
in_production <- set immediately; executed_at=now()
  |
  +-- Zero data for all competitors in scope -> killed (with data gap explanation)
  +-- Unknown competitor slug -> killed
  |
  v
executed      <- set after CompetitorAnalysisFindings written to marketing_decisions

killed        <- zero data across all competitors, unknown slug, or Supabase error
```

No `ready` or `approved` states. No draft surface to Matt from this producer.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Zero data for competitor-source pair | No rows in `competitor_intel` for the lookback window | Note in findings as "no data"; continue with other pairs; do not kill unless all pairs empty |
| All data empty | Zero rows across all competitors and all sources | Kill; surface: "No competitor_intel data exists in the window. Run competitor-recon first." |
| Unknown competitor slug | Slug not in the locked 10 from competitor-recon | Kill; list the valid slugs |
| `marketing_decisions` insert fails | Supabase constraint or network error | Retry once; if second attempt fails, write findings to `executor_response` directly on the action row; set `status='killed'` with the error so data is not lost |
| Duplicate counter-move | Same action_type + target already pending in last 7 days | Skip insertion; note in `executor_response.counter_moves_enqueued` count |
| Apify MCP unavailable | `mcp__Apify__call-actor` not in tool list | Proceed with pre-scraped data only; note in findings that real-time scrape was unavailable |
| `APIFY_API_TOKEN` unset | Apify call returns auth error | Note in findings; proceed with `competitor_intel` table only |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy
- `CLAUDE.md` §0.5: Draft-First, Commit-Last (no published output)
- `design_system/ryan-realty/SKILL.md`: brand context for framing findings
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: all quoted text properly attributed
- `marketing_brain_skills/research/tool-inventory.md`: Apify §1.6, env var status
- `marketing_brain_skills/research/platform-bible.md`: platform benchmarks for comparison
- `marketing_brain_skills/research/asset-library-map.md`: competitor screenshots are for internal analysis only
- `marketing_brain_skills/research/bend-market-bible.md`: §10 brokerage roster; §1 neighborhood context

**Sister skill (data collection):**
- `marketing_brain_skills/competitor-recon/SKILL.md`: weekly Apify scrape; feeds `competitor_intel`

**Downstream consumers:**
- `marketing_brain_skills/generate-briefs/SKILL.md`: reads `marketing_decisions` rows with
  `decision_type='competitor_analysis'` to prioritize content and ops action rows

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section F, row `analyze-competitor`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Apify actor for IG profile scraping** (within minimal budget): schedule a weekly Apify run on the top 3 competitor IG profiles to pull post engagement and content type distribution automatically.
2. **ORMLS competitive listing feed**: query Supabase for all listings in the target farm area not belonging to Ryan Realty and surface days-on-market and price-reduction frequency as competitive signals.
3. **Competitor ad library API**: use the Meta Ad Library API (free, no token required) to pull competitor Facebook/Instagram ad creatives and flag any that match Ryan Realty's own creative patterns.

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

