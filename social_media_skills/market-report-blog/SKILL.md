---
name: market-report-blog
description: >
  Produces the SEO-optimized monthly market report blog post for ryan-realty.com
  (AgentFire WordPress REST API). Companion text to the market-data-video and
  youtube-long-form-market-report. Pulls live data from market_pulse_live and
  market_stats_cache. Length 1500-2500 words with schema.org BlogPosting JSON-LD
  and FAQ section for SEO.
action_types:
  - content:market_report_blog
output_type: text
output_type: text
target_platforms: ['agentfire_blog', 'gbp', 'email']
asset_destination: "out/blog-posts/<date>/"
auto_inputs: ['market_stats_cache', 'market_pulse_live', 'listing_history']
required_inputs: "['city or neighborhood', 'report_period (monthly|quarterly)']"
optional_inputs: ['include_charts (default true)', 'min_words (default 1200)']
estimated_runtime_min: 25
cost_usd_estimate: $0
thumbnail_uri: out/proof/2026-05-17/exemplars/market-report-blog/sample.html
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: blog

---

# Market Report Blog Producer

**Scope:** Monthly SEO-optimized blog post at ryan-realty.com covering the Bend (or
specified city) residential real estate market. Companion piece to the market-data-video
short-form video and the youtube-long-form-market-report. Pulls the same data from
Supabase `market_pulse_live` and `market_stats_cache`. Longer than the standard blog-post
producer output (1500-2500 words vs 800-1500) because this post is the primary SEO landing
page for Bend market report queries. Includes schema.org `BlogPosting` JSON-LD, a 4-6 item
FAQ section targeting long-tail queries, embedded YouTube video (when available), and
all stats verified by live Supabase query with citations.json.

**Status:** Canonical
**Locked:** 2026-05-17
**Sibling skill:** `social_media_skills/blog-post/SKILL.md` (shorter general blog posts)
**Exemplar output:** `out/market-report-blog/<city>-<YYYY-MM>/`

---

## 1. Scope

### In scope

- Monthly market report blog post for a specific city (default: Bend, OR)
- 1500-2500 words including an FAQ section
- `BlogPosting` schema.org JSON-LD + `Place` JSON-LD + `VideoObject` JSON-LD (if video available)
- Embedded YouTube video above the fold (if the youtube-long-form-market-report has been published for this month)
- 4-6 FAQ items targeting long-tail queries ("Is Bend a buyer's or seller's market?", "How many homes are for sale in Bend right now?", etc.)
- AgentFire WordPress REST API publish as `status: 'draft'` first, then `'publish'` on Matt's approval
- Citations.json with every figure traced to live Supabase query

### Out of scope

- The short-form vertical video - use market-data-video producer
- The YouTube long-form video - use youtube-long-form-market-report producer
- The Facebook lead-gen ad - use facebook-lead-gen-ad producer
- Multi-city reports covering more than one market per post (one post per city)
- Neighborhood-level deep dive (use neighborhood-overview producer)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:market_report_blog` | `city`, `month_label`; optional `youtube_url`, `short_video_url`, `scope` | `scope` defaults to `'city'`; `month_label` e.g. "April 2026" |

### Payload schema

```typescript
interface MarketReportBlogPayload {
  city: string                     // 'Bend' | 'Redmond' | 'Sisters' | 'La Pine'
  month_label: string              // 'April 2026'
  year_month: string               // '2026-04' (for URL slug)

  // Optional companion media (embed above fold if provided):
  youtube_url?: string             // 'https://www.youtube.com/watch?v=...'
  short_video_url?: string         // Public URL of the short-form vertical video

  // Scope:
  scope?: 'city' | 'neighborhood' | 'subdivision'  // default 'city'
  neighborhood?: string            // If scope='neighborhood'

  // Override:
  target_keyword?: string          // Primary SEO keyword; producer drafts if omitted
  secondary_keywords?: string[]    // Additional keyword targets
}
```

---

## 3. Brief payload schema

```typescript
interface MarketReportBlogActionRow {
  id: string
  action_type: 'content:market_report_blog'
  target: string                   // 'city:Bend:2026-04'
  assigned_producer: 'social_media_skills/market-report-blog'
  payload: MarketReportBlogPayload
  data_evidence: {
    market_signal?: string
    previous_post_url?: string     // URL of last month's post for internal linking
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 - Read the action row and transition to in_production**

```sql
SELECT * FROM marketing_brain_actions WHERE id = '<id>' AND status = 'pending';
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>';
```

**Step 2 - Load mandatory references**

Before producing any copy or data pull:
- `CLAUDE.md` §0 (Data Accuracy - every stat traces to a live query run in this session)
- `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand register, voice, fonts)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (full load - 1500-2500 word long-form)
- `marketing_brain_skills/research/tool-inventory.md` (verify Supabase and WordPress env vars set)
- `marketing_brain_skills/research/platform-bible.md` §22 (AgentFire Blog rules)
- `marketing_brain_skills/research/asset-library-map.md` (featured image registration)
- `marketing_brain_skills/research/bend-market-bible.md` §1 (neighborhood context for any neighborhood references)
- `social_media_skills/blog-post/SKILL.md` (sibling skill - inherit SEO spec §3 fully)
- `video_production_skills/market-data-video/SKILL.md` §22 (data dictionary for market_stats_cache and market_pulse_live columns)

**Step 3 - Verify WordPress env vars before any work**

Check `.env.local` and the env manifest:
- `WP_AGENTFIRE_USER`: UNSET per env-manifest.md - BLOCKING for publish step
- `WP_AGENTFIRE_APP_PASSWORD`: UNSET per env-manifest.md - BLOCKING for publish step
- `WP_AGENTFIRE_SITE_URL`: UNSET per env-manifest.md - BLOCKING for publish step

If all three are unset: build the draft anyway. Surface the blockers to Matt in the contact sheet. The draft can be prepared and reviewed even if publish is blocked. Note: "WordPress credentials not configured. Draft is ready but cannot be published until WP_AGENTFIRE_USER, WP_AGENTFIRE_APP_PASSWORD, and WP_AGENTFIRE_SITE_URL are set in .env.local. Generate the application password at WP Admin > Users > Profile > Application Passwords."

**Step 4 - Pull and verify market data (live queries)**

Per CLAUDE.md §0, every figure in the post traces to a query run in this session. Never reuse numbers from a prior run or the payload without re-querying.

Primary source: `market_pulse_live` and `market_stats_cache`.

```sql
-- Primary stats from market_stats_cache (most recent row for city + SFR):
SELECT
  median_sale_price, active_count, months_supply, median_dom,
  closed_count_ytd, median_sale_price_yoy_pct,
  active_count_yoy_pct, months_supply_yoy_pct,
  stats_date
FROM market_stats_cache
WHERE city = '<city>'
  AND property_type = 'A'
ORDER BY stats_date DESC
LIMIT 1;

-- Cross-check with market_pulse_live (real-time):
SELECT
  median_list_price_active, active_count, new_listings_30d,
  price_reduced_30d, pending_count, pending_to_active_ratio,
  fetched_at
FROM market_pulse_live
WHERE city = '<city>'
  AND property_type = 'A'
ORDER BY fetched_at DESC
LIMIT 1;

-- Months of supply verification (canonical formula):
-- active_count / (closed_last_6_months / 6)
SELECT COUNT(*) as closed_6mo
FROM listings
WHERE "City" = '<city>'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= now() - interval '6 months';
-- MoS = active_count / (closed_6mo / 6)
-- Thresholds: <=4 seller, 4-6 balanced, >=6 buyer
-- Market verdict must match computed MoS, not the cached value if they differ

-- YoY comparison (same window last year):
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_prev_year
FROM listings
WHERE "City" = '<city>'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= date_trunc('year', now()) - interval '1 year'
  AND "CloseDate" < date_trunc('year', now());
```

If any Supabase figure differs from market_pulse_live by >1%, surface the discrepancy
to Matt before proceeding (Spark x Supabase reconciliation gate per CLAUDE.md §0).

**Step 5 - Determine SEO keyword and title**

Primary keyword (from payload or derived):
- Pattern: "{City} real estate market {Month} {Year}"
- Example: "Bend Oregon real estate market April 2026"

Title tag (60 chars max):
- Pattern: "{City} Real Estate Market Report - {Month} {Year} | Ryan Realty"
- Example: "Bend Real Estate Market Report - April 2026 | Ryan Realty"

URL slug (from blog-post/SKILL.md §3.3):
- Pattern: `/market-report/{city-slug}/{YYYY-MM}`
- Example: `/market-report/bend/2026-04`

Meta description (150-160 chars):
- Lead with the headline stat: "Bend's median home price hit $699K in April 2026, down 13.4% from last year. See inventory, days on market, and what it means for you."

Secondary keywords (4-6 FAQ targets):
- "Is Bend a buyer's or seller's market right now?"
- "How many homes are for sale in Bend Oregon?"
- "How long are homes sitting on the market in Bend?"
- "Is Bend real estate market cooling?"
- "Best neighborhoods to buy in Bend Oregon {year}"

**Step 6 - Draft the blog post (1500-2500 words)**

H1 (WordPress post title, auto-wrapped by WP): The SEO title from Step 5.

Opening (150-200 words):
- Lede paragraph: lead with the headline stat plus market context. First sentence is the hook. No "Welcome to..." no "Are you wondering about..." Just the data story.
- Second paragraph: what this report covers (the data sources, the time window, the property type) and who it is for.
- Embed YouTube video here if `payload.youtube_url` is provided (oEmbed or iframe with loading="lazy").

Market snapshot section (H2: "The numbers at a glance"):
- 3-column or 4-stat callout box in WP markup (or styled paragraph list)
- Median sale price (with YoY arrow and percentage)
- Active inventory (with YoY comparison)
- Months of supply (with market verdict: seller/balanced/buyer)
- Median days on market (with YoY comparison)
- All stats must match the verification trace in citations.json exactly

Deep-dive section (H2: "Median sale price") (200-250 words):
- One-paragraph analysis of price trend. What is driving it. How it compares to the statewide Oregon trend if that data is available from Supabase.
- Pull 12-month chart description from the data (even if the chart is not embedded in the text version, describe what the trend looks like).

Deep-dive section (H2: "Inventory and months of supply") (200-250 words):
- Explain months of supply in plain English for a buyer or seller reading this. Define it. Apply it: "With X months of supply, Bend is a [seller/balanced/buyer] market by the standard definition."
- Month-over-month trend if available from market_stats_cache history.

Deep-dive section (H2: "Days on market") (150-200 words):
- What DOM tells a seller vs a buyer. The current median and what it means in practice.

Deep-dive section (H2: "New listings and pending activity") (150-200 words):
- New listings 30 days from market_pulse_live.
- Pending-to-active ratio as a leading indicator of where prices are heading.

Neighborhood breakdown section (H2: "Which Bend neighborhoods are most active?") (250-300 words):
- Pull the top 3 neighborhoods by closed count in the last 30 days from Supabase.
- Use `neighborhood_subdivisions` table to map subdivision names to neighborhoods.
- One paragraph per neighborhood, factual, citing the median close price for that neighborhood specifically.

FAQ section (H2: "Frequently asked questions") (300-400 words):
- 4-6 Q&A items using `<details>`/`<summary>` or H3/paragraph format in WP.
- Each answer is 2-4 sentences, self-contained, factual.
- Target the secondary keywords from Step 5.
- Do not repeat information already in the body - the FAQ adds incremental coverage.

Closing (100-150 words):
- One paragraph offering the reader a next step (no urgency language, no "act fast").
- CTA: link to the contact form or listing search. Matt's phone 541.213.6706. ryan-realty.com.

Voice self-check (mandatory before Step 7):
- Grep for em-dash, en-dash, semicolons: zero allowed
- Grep for every banned word in voice_guidelines.md §6.2: zero allowed
- Grep for exclamation marks: maximum one per post, none in data sections
- Grep for "approximately", "roughly", "about" as number substitutes: zero allowed
- Verify all numbers carry units: "$699,000" not "$699k"; "46 days" not "46d"; "4.3 months" not "4.3 MoS"
- Verify YoY percents carry one decimal and a signed arrow: "down 13.4% YoY" - the arrow character is text, not emoji

**Step 7 - Build JSON-LD blocks**

`BlogPosting` (always required):
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "<title>",
  "description": "<meta description>",
  "image": "<og:image URL>",
  "datePublished": "<ISO 8601>",
  "dateModified": "<ISO 8601>",
  "author": {
    "@type": "Person",
    "name": "Matt Ryan",
    "url": "https://ryan-realty.com/about/matt-ryan"
  },
  "publisher": {
    "@type": "RealEstateAgent",
    "name": "Ryan Realty",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ryan-realty.com/wp-content/uploads/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ryan-realty.com/market-report/<city>/<YYYY-MM>"
  }
}
```

`Place` (always for market reports):
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "<City>, OR",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "<City>",
    "addressRegion": "OR",
    "addressCountry": "US"
  }
}
```

`VideoObject` (only if `payload.youtube_url` is provided):
```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "<video title>",
  "description": "<meta description>",
  "thumbnailUrl": "<YouTube thumbnail URL>",
  "uploadDate": "<ISO>",
  "contentUrl": "<youtube_url>",
  "embedUrl": "<youtube embed URL>"
}
```

Validate all JSON-LD blocks using the Google Rich Results Test pattern before publishing.

**Step 8 - Prepare featured image**

Featured image for the market report blog: use the canonical hero photo at
`design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg` OR a chart screenshot
from the YouTube long-form video if available (per media-sourcing SKILL.md hierarchy).

Resize to 1200x630 for og:image. Upload to WordPress media library:
```
POST /wp-json/wp/v2/media
Authorization: Basic <base64(WP_AGENTFIRE_USER:WP_AGENTFIRE_APP_PASSWORD)>
Content-Type: image/jpeg
Content-Disposition: attachment; filename="bend-market-report-<YYYY-MM>.jpg"
{binary}
```

Store the returned media ID for use in the post payload.

**Step 9 - Write citations.json**

One entry per figure in the post:
```json
{
  "deliverable": "out/market-report-blog/<city>-<YYYY-MM>/post.html",
  "generated_at": "<ISO>",
  "figures": [
    {
      "figure": "$699,000 median sale price",
      "source": "Supabase market_stats_cache",
      "filter": "city='Bend', property_type='A', ORDER BY stats_date DESC LIMIT 1",
      "column": "median_sale_price",
      "value": 699000,
      "row_count": 1,
      "fetched_at": "<ISO>"
    }
  ]
}
```

**Step 10 - Publish to WordPress as draft**

```
POST https://ryan-realty.com/wp-json/wp/v2/posts
Authorization: Basic <base64(WP_AGENTFIRE_USER:WP_AGENTFIRE_APP_PASSWORD)>
Content-Type: application/json

{
  "title": "<SEO title>",
  "content": "<full post HTML>",
  "status": "draft",
  "slug": "market-report-<city>-<YYYY-MM>",
  "excerpt": "<meta description>",
  "featured_media": <media_id>,
  "categories": [<market-reports category ID>],
  "tags": [<bend ID>, <2026 ID>, <monthly-report ID>],
  "meta": {
    "yoast_wpseo_title": "<SEO title>",
    "yoast_wpseo_metadesc": "<meta description>",
    "yoast_wpseo_canonical": "https://ryan-realty.com/market-report/<city>/<YYYY-MM>"
  }
}
```

If WordPress env vars are unset, skip this step and note it in the contact sheet (see Step 3).

Preview URL on success: `https://ryan-realty.com/?p=<post-id>&preview=true`

**Step 11 - Build contact sheet and surface to Matt**

```
out/market-report-blog/<city>-<YYYY-MM>/
├── post.html              <- full post content (readable in browser)
├── post.txt               <- plain text version
├── citations.json
├── jsonld-blocks.json     <- all three JSON-LD objects for validation
└── contact-sheet.html     <- MANDATORY review surface
```

Standard surface format per TEMPLATE.md §6. Include:
- WordPress draft preview URL (if env vars are set)
- Word count
- FAQ items listed
- Verification trace (one line per figure)
- WordPress env var status (set/unset)

**Step 12 - UPDATE action row to ready**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/market-report-blog/<city>-<YYYY-MM>/post.html',
      'wp_draft_id', <post_id_or_null>,
      'wp_preview_url', '<url_or_null>',
      'word_count', <count>,
      'wp_credentials_set', <true_or_false>
    )
WHERE id = '<id>';
```

**Step 13 - On Matt's approval, publish**

```
PATCH https://ryan-realty.com/wp-json/wp/v2/posts/<post-id>
Authorization: Basic <base64(WP_AGENTFIRE_USER:WP_AGENTFIRE_APP_PASSWORD)>
Content-Type: application/json

{ "status": "publish" }
```

After publish: ping the sitemap URL and surface the live post URL to Matt.
Set action row: `approved` then `executed`.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market data pull, neighborhood data, action row transitions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| WordPress REST API | draft create, media upload, publish | `WP_AGENTFIRE_USER` (UNSET), `WP_AGENTFIRE_APP_PASSWORD` (UNSET), `WP_AGENTFIRE_SITE_URL` (UNSET) |
| Spark API | Supabase reconciliation cross-check | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| Unsplash / Shutterstock | featured image if not using canonical hero | `UNSPLASH_ACCESS_KEY` (set), `SHUTTERSTOCK_API_KEY` (set) |

---

## 6. Output format

**Draft lands at:** `out/market-report-blog/<city>-<YYYY-MM>/`

```
out/market-report-blog/<city>-<YYYY-MM>/
├── post.html
├── post.txt
├── citations.json
├── jsonld-blocks.json
└── contact-sheet.html    <- MANDATORY
```

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

Matt reviews the contact sheet and the WordPress preview URL. On "ship it" / "approved" / "go", the producer flips the WP post from draft to published.

---

## 8. Status flow

```
pending
  |
  v
in_production
  |
  v
ready             <- draft built, WP draft created (or blocked with reason), contact sheet up
  |
  v (Matt approves)
approved
  |
  v (WP status flipped to publish)
executed          <- set after confirmed live URL
  |
  v (7-day GSC impressions + click check)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| WordPress credentials unset | `WP_AGENTFIRE_USER`, `WP_AGENTFIRE_APP_PASSWORD`, or `WP_AGENTFIRE_SITE_URL` missing | Build draft locally. Surface blockers clearly in contact sheet: "Cannot publish until WordPress Application Password is configured. Go to ryan-realty.com/wp-admin > Users > Profile > Application Passwords." Do NOT set status='killed' - the draft is still valuable. |
| Naming convention mismatch | Code uses `AGENTFIRE_WP_USER` vs `WP_AGENTFIRE_USER` | Use `WP_AGENTFIRE_USER` (the `app/` layer convention). Note the inconsistency in the contact sheet for Matt to resolve. |
| Market data Spark/Supabase delta >1% | Reconciliation gate triggers | Surface both values + delta to Matt. Do not publish until resolved. |
| Voice gate fails | Banned word or punctuation found | Rewrite and re-validate. Never surface a failing draft. |
| YouTube URL returns 404 | `payload.youtube_url` is invalid | Skip the video embed. Note in contact sheet: "YouTube video URL not reachable - embedded video omitted. Add the correct URL when available and update the post." |
| Word count below 1500 | Draft is under minimum | Add depth to FAQ section or expand the neighborhood breakdown. Do not pad with filler sentences. |
| JSON-LD fails validation | Rich Results Test would fail | Fix the specific field causing the failure. Common: missing `datePublished`, wrong `@type` nesting, image URL not publicly accessible. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 - Data Accuracy (every stat traces to a live query in this session)
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md` - brand visual and voice system
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - full load (1500-2500 word long-form)
- `marketing_brain_skills/research/tool-inventory.md` - tool and env var status
- `marketing_brain_skills/research/platform-bible.md` - §22 AgentFire Blog surface rules, §24 compliance
- `marketing_brain_skills/research/asset-library-map.md` - featured image registration (§8 AgentFire WP media library)
- `marketing_brain_skills/research/bend-market-bible.md` - neighborhood data for the neighborhood breakdown section

**Sibling and delegating producers:**
- `social_media_skills/blog-post/SKILL.md` - sibling (shorter general posts; inherit SEO spec §3)
- `automation_skills/content_engine/SKILL.md` - content routing
- `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate
- `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard and format minimums
- `video_production_skills/market-data-video/SKILL.md` §22 - canonical data dictionary (all column names)
- `video_production_skills/youtube-long-form-market-report/SKILL.md` - companion video (same data)
- `video_production_skills/monthly-market-report-orchestrator/SKILL.md` - calling orchestrator

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `market-report-blog`
- WordPress REST API: https://developer.wordpress.org/rest-api/reference/posts/
- Google Rich Results Test: https://search.google.com/test/rich-results

## 12. Tool gap suggestions

What would make this 10x better:

1. **AgentFire WordPress REST API** (credentials pending): auto-publish the approved draft directly to the WordPress blog rather than requiring a manual copy-paste, with the canonical URL returned to the action row.
2. **Internal linking automation**: after publishing, query the GSC sitemap for existing blog posts on adjacent topics and auto-insert 2-3 internal links into the new post.
3. **Schema markup generator**: auto-wrap the market data table in Article + FAQPage JSON-LD schema markup to improve Google featured-snippet eligibility.

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

