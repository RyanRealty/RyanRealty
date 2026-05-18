# KPI Dashboard — Q3 2026
# Ryan Realty Autonomous Marketing Pipeline

**Document version:** 1.0 — 2026-05-17
**Owner:** marketing brain (brain) + Matt Ryan (matt)
**Review cadence:** Weekly brain digest every Monday 06:30 UTC; monthly executive review first Monday of each month; quarterly review September 30, 2026.
**Source of truth:** Supabase project `dwvlophlbvvygjfxcrhm` (ryan-realty-platform) + platform APIs via `marketing_channel_daily` + FUB CRM + Google Search Console.

---

## How to Read This Dashboard

Each metric row contains:
- **Metric:** name and definition
- **Source:** Supabase table.column, API endpoint, or platform dashboard
- **Current value:** baseline as of 2026-05-17 snapshot or [baseline TBD] where no prior measurement exists
- **Q3 Target:** end-of-quarter goal (September 30, 2026)
- **Trend:** direction brain is trying to move the metric (up / down / stable)
- **Owner:** matt | brain | producer slug
- **Cadence:** daily | weekly | monthly | quarterly

Metric IDs are stable. The brain references these IDs in `marketing_brain_actions.strategy_doc_section` to trace each action back to the metric it serves.

---

## Layer 1 — North Star: Qualified Seller Leads

**Definition:** A qualified seller lead is a Deschutes County homeowner with self-reported 12-month sell intent who has not yet listed with another brokerage, reached FUB Stage 3 (qualified), and passed the mortgage-free-or-equity-sufficient filter.

**GCI model:** Median Bend SFR $675K x 2.75% commission = $18,562.50 per closed side. At 20% conversion (qualified lead to closed listing), each qualified seller lead is worth approximately $3,700 in expected GCI.

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| NS-01 | Qualified seller leads per month (FUB Stage 3, Deschutes County, 12-month intent) | `marketing_channel_daily` WHERE channel='fub' AND metric_name='qualified_seller_leads_mtd' | [baseline TBD — first full month measurement in progress] | 18/month by September | up | brain | monthly |
| NS-02 | Seller consultations booked per month (FUB Stage 4 transitions) | `marketing_channel_daily` WHERE channel='fub' AND metric_name='seller_consultations_booked_mtd' | [baseline TBD] | 6/month | up | matt | monthly |
| NS-03 | Listings taken per month (FUB Stage 5, active listing created) | `listings` WHERE "StandardStatus"='Active' AND "ListAgentEmail" LIKE '%ryan-realty%' — grouped by list_date month | [baseline TBD from Supabase] | 4/month | up | matt | monthly |
| NS-04 | Seller lead cost per acquisition (total paid spend / qualified_seller_leads_mtd) | Derived: `paid_campaign_daily.spend_usd` / NS-01 | [baseline TBD — no active Meta campaign as of 2026-05-17] | Less than $250/lead | down | brain | monthly |
| NS-05 | Seller lead source attribution split (organic / paid / referral / GBP) | `marketing_channel_daily` GROUP BY channel WHERE metric_name='qualified_seller_leads' | [baseline TBD] | 50% organic, 30% paid, 20% referral+GBP | stable | brain | monthly |
| NS-06 | Home valuation tool completions per month (ryan-realty.com /valuation) | `site_events` WHERE event_type='valuation_complete' — monthly count | [baseline TBD] | 25/month | up | brain | monthly |
| NS-07 | Valuation-to-qualified-lead conversion rate (NS-06 to NS-01) | Derived: NS-01 / NS-06 | [baseline TBD] | 30% | up | brain | monthly |
| NS-08 | Expected pipeline GCI from qualified seller leads (NS-01 x $3,700) | Derived from NS-01 | [baseline TBD] | $66,600/month expected pipeline GCI | up | matt | monthly |
| NS-09 | Cumulative qualified seller leads Q3 (July through September) | Derived: sum of NS-01 over Q3 | [starts July 1] | 50 total Q3 | up | brain | quarterly |
| NS-10 | Closed seller-side transactions sourced from brain pipeline (Q3) | `listings` WHERE listing_source='brain_pipeline' AND "CloseDate" BETWEEN '2026-07-01' AND '2026-09-30' | [starts July 1] | 8 closings Q3 | up | matt | quarterly |

---

## Layer 2 — Brand Position: Share of Voice and Reputation

**Definition:** Brand position metrics measure Ryan Realty's visibility relative to competitors in Bend and Deschutes County across organic search, social share of voice, and local reputation signals (GBP).

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| BP-01 | Branded search impressions per month ("ryan realty bend", "ryan realty oregon") | Google Search Console API — branded query filter, monthly impressions | [baseline TBD — GSC API connection required] | 1,500/month | up | brain | monthly |
| BP-02 | Branded search click-through rate | Google Search Console API — branded query filter, CTR | [baseline TBD] | 18% CTR | up | brain | monthly |
| BP-03 | GBP total reviews (cumulative) | `marketing_channel_daily` WHERE channel='gbp' AND metric_name='review_count_total' | [baseline TBD] | +12 reviews Q3 (net new) | up | brain | monthly |
| BP-04 | GBP average star rating | `marketing_channel_daily` WHERE channel='gbp' AND metric_name='avg_star_rating' | [baseline TBD] | 4.8 or above | stable | matt | monthly |
| BP-05 | GBP review response rate (responses / new reviews in period) | Derived from GBP API data | [baseline TBD] | 100% within 48 hours | stable | brain | weekly |
| BP-06 | GBP profile views per month (discovery + direct) | `marketing_channel_daily` WHERE channel='gbp' AND metric_name='profile_views_mtd' | [baseline TBD] | 2,500/month | up | brain | monthly |
| BP-07 | GBP website clicks per month (GBP to ryan-realty.com) | `marketing_channel_daily` WHERE channel='gbp' AND metric_name='website_clicks_mtd' | [baseline TBD] | 300/month | up | brain | monthly |
| BP-08 | GBP direction requests per month | `marketing_channel_daily` WHERE channel='gbp' AND metric_name='direction_requests_mtd' | [baseline TBD] | 150/month | up | brain | monthly |
| BP-09 | Estimated social share of voice — Bend real estate topic (IG + TikTok reach vs. top 5 local competitors) | Manual monthly competitive audit — producer: snapshot-channels | [baseline TBD] | Top-2 position in Bend real estate content volume | up | brain | monthly |
| BP-10 | Net Promoter Score proxy — positive sentiment in GBP reviews and IG comments (% positive mentions) | Manual monthly brand audit — producer: brand-audit | [baseline TBD] | 90% positive | stable | matt | monthly |

---

## Layer 3 — Channel Growth: Per-Platform Performance

**Definition:** Channel growth metrics track the raw platform performance signals that signal algorithmic reach, audience growth, and content virality across Instagram, Facebook, YouTube, TikTok, LinkedIn, and Google Business Profile.

### 3A — Instagram

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| CG-IG-01 | Instagram followers (@ryanrealtybend) | `marketing_channel_daily` WHERE channel='instagram' AND metric_name='followers' | [baseline TBD] | +500 net new Q3 | up | brain | weekly |
| CG-IG-02 | Instagram Reels average reach per video | `content_performance` WHERE channel='instagram' AND content_type='reel' — AVG(reach_7d) | [baseline TBD] | 4,000 avg reach/reel | up | brain | weekly |
| CG-IG-03 | Instagram Reels average completion rate | `content_performance` WHERE channel='instagram' AND content_type='reel' — AVG(completion_rate) | [baseline TBD] | 45% completion | up | brain | weekly |
| CG-IG-04 | Instagram Reels saves per post | `content_performance` WHERE channel='instagram' AND content_type='reel' — AVG(saves_7d) | [baseline TBD] | 40 saves/reel | up | brain | weekly |
| CG-IG-05 | Instagram Reels shares per post | `content_performance` WHERE channel='instagram' AND content_type='reel' — AVG(shares_7d) | [baseline TBD] | 25 shares/reel | up | brain | weekly |
| CG-IG-06 | Instagram profile visits from Reels (Reels-to-profile conversion) | Instagram API — profile_visits from reel traffic | [baseline TBD] | 8% of reel reach | up | brain | weekly |
| CG-IG-07 | Instagram link-in-bio clicks per month | `marketing_channel_daily` WHERE channel='instagram' AND metric_name='link_clicks_mtd' | [baseline TBD] | 120/month | up | brain | monthly |
| CG-IG-08 | Instagram carousel average engagement rate (likes + comments + saves / reach) | `content_performance` WHERE channel='instagram' AND content_type='carousel' — AVG(engagement_rate) | [baseline TBD] | 6% engagement rate | up | brain | weekly |

### 3B — Facebook

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| CG-FB-01 | Facebook Page followers | `marketing_channel_daily` WHERE channel='facebook' AND metric_name='followers' | [baseline TBD] | +200 net new Q3 | up | brain | weekly |
| CG-FB-02 | Facebook Reels average reach per video | `content_performance` WHERE channel='facebook' AND content_type='reel' — AVG(reach_7d) | [baseline TBD] | 3,000 avg reach/reel | up | brain | weekly |
| CG-FB-03 | Facebook lead form completions per month (Meta lead-gen forms) | `marketing_channel_daily` WHERE channel='facebook_ads' AND metric_name='lead_form_completions_mtd' | [baseline TBD — no active campaign as of 2026-05-17] | 20/month when campaign active | up | brain | monthly |
| CG-FB-04 | Facebook post organic reach per post | `content_performance` WHERE channel='facebook' AND content_type IN ('post','reel') — AVG(reach_7d) | [baseline TBD] | 2,000 avg/post | up | brain | weekly |

### 3C — YouTube

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| CG-YT-01 | YouTube subscribers (@ryanrealtybend) | `marketing_channel_daily` WHERE channel='youtube' AND metric_name='subscribers' | [baseline TBD] | +300 net new Q3 | up | brain | weekly |
| CG-YT-02 | YouTube Shorts average views per video (first 7 days) | `content_performance` WHERE channel='youtube' AND content_type='short' — AVG(views_7d) | [baseline TBD] | 2,500 views/short | up | brain | weekly |
| CG-YT-03 | YouTube long-form average views per video (first 30 days) | `content_performance` WHERE channel='youtube' AND content_type='long_form' — AVG(views_30d) | [baseline TBD] | 800 views/long-form | up | brain | monthly |
| CG-YT-04 | YouTube average watch time per long-form video (minutes) | `content_performance` WHERE channel='youtube' AND content_type='long_form' — AVG(watch_time_minutes) | [baseline TBD] | 5.5 minutes average | up | brain | monthly |
| CG-YT-05 | YouTube click-through rate on thumbnails | YouTube Data API — impressionClickThroughRate | [baseline TBD] | 6% CTR | up | brain | monthly |

### 3D — TikTok

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| CG-TT-01 | TikTok followers (@ryanrealtybend) | `marketing_channel_daily` WHERE channel='tiktok' AND metric_name='followers' | [baseline TBD] | +400 net new Q3 | up | brain | weekly |
| CG-TT-02 | TikTok average video views per post (first 48 hours) | `content_performance` WHERE channel='tiktok' — AVG(views_48h) | [baseline TBD] | 3,000 views/video | up | brain | weekly |
| CG-TT-03 | TikTok average completion rate per video | `content_performance` WHERE channel='tiktok' — AVG(completion_rate) | [baseline TBD] | 50% completion | up | brain | weekly |
| CG-TT-04 | TikTok shares per video | `content_performance` WHERE channel='tiktok' — AVG(shares_7d) | [baseline TBD] | 30 shares/video | up | brain | weekly |

### 3E — LinkedIn

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| CG-LI-01 | LinkedIn Page followers (/ryanrealtybend) | `marketing_channel_daily` WHERE channel='linkedin' AND metric_name='followers' | [baseline TBD] | +150 net new Q3 | up | brain | weekly |
| CG-LI-02 | LinkedIn post impressions per month | `marketing_channel_daily` WHERE channel='linkedin' AND metric_name='impressions_mtd' | [baseline TBD] | 5,000/month | up | brain | monthly |
| CG-LI-03 | LinkedIn post engagement rate (reactions + comments + shares / impressions) | `content_performance` WHERE channel='linkedin' — AVG(engagement_rate) | [baseline TBD] | 3% engagement rate | up | brain | monthly |

---

## Layer 4 — Site Health: SEO and Conversion

**Definition:** Site health metrics track organic search ranking for the 30 target seller-intent queries defined in Q3-2026-strategy.md §11, Core Web Vitals, and site conversion performance (valuations, consultations, listing alerts).

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| SH-01 | Organic sessions per month (Google Analytics / GSC) | Google Search Console API — non-branded queries, monthly clicks | [baseline TBD] | 2,000/month organic sessions | up | brain | monthly |
| SH-02 | Seller-intent keyword rankings — top 10 positions (count of target queries in positions 1-10) | Google Search Console API or rank tracking tool — 30 target queries from Q3-2026-strategy.md §11 | [baseline TBD] | 8 of 30 target queries in positions 1-10 by Sept 30 | up | brain | monthly |
| SH-03 | Seller-intent keyword rankings — top 20 positions (count of target queries in positions 11-20) | Google Search Console API — same 30 query set | [baseline TBD] | 15 of 30 target queries in positions 1-20 by Sept 30 | up | brain | monthly |
| SH-04 | "Bend Oregon homes for sale" SERP position | GSC or Ahrefs — single query tracking | [baseline TBD] | Position 8 or better | up | brain | monthly |
| SH-05 | "Bend Oregon real estate agent" SERP position | GSC or Ahrefs — single query tracking | [baseline TBD] | Position 10 or better | up | brain | monthly |
| SH-06 | "sell my home bend oregon" SERP position | GSC or Ahrefs — single query tracking | [baseline TBD] | Position 5 or better | up | brain | monthly |
| SH-07 | Blog posts published Q3 (ryan-realty.com /blog, indexed by Google) | GSC indexed pages count for /blog path | [baseline TBD — 6 posts planned per §11] | 6 posts published and indexed by Sept 30 | up | brain | monthly |
| SH-08 | Blog post average organic sessions per post (30 days post-publish) | GSC — clicks per URL, 30-day window after first index date | [baseline TBD] | 120 sessions/post at 30 days | up | brain | monthly |
| SH-09 | Core Web Vitals — Largest Contentful Paint (LCP) | PageSpeed Insights API — ryan-realty.com, mobile | [baseline TBD] | Under 2.5 seconds (Good threshold) | down | brain | monthly |
| SH-10 | Core Web Vitals — Cumulative Layout Shift (CLS) | PageSpeed Insights API — ryan-realty.com, mobile | [baseline TBD] | Under 0.10 (Good threshold) | down | brain | monthly |
| SH-11 | Core Web Vitals — Interaction to Next Paint (INP) | PageSpeed Insights API — ryan-realty.com, mobile | [baseline TBD] | Under 200ms (Good threshold) | down | brain | monthly |
| SH-12 | Home valuation completions per month | `site_events` WHERE event_type='valuation_complete' | [baseline TBD] | 25/month | up | brain | monthly |
| SH-13 | Site-to-valuation conversion rate (valuation completions / total sessions) | Derived: SH-12 / total monthly sessions | [baseline TBD] | 1.25% of sessions | up | brain | monthly |
| SH-14 | Consultation request form submissions per month | `site_events` WHERE event_type='consultation_request' | [baseline TBD] | 8/month | up | brain | monthly |
| SH-15 | Listing alert sign-ups per month | `site_events` WHERE event_type='listing_alert_signup' | [baseline TBD] | 30/month | up | brain | monthly |
| SH-16 | Bounce rate on seller-intent landing pages (/) | Google Analytics — bounce rate for /sell, /valuation paths | [baseline TBD] | Under 60% | down | brain | monthly |
| SH-17 | Pages per session on site | Google Analytics — avg pages/session | [baseline TBD] | 3.5 pages/session | up | brain | monthly |

---

## Layer 5 — Ad Health: Paid Acquisition Performance

**Definition:** Ad health metrics track the Ryan Realty paid acquisition program on Meta (Facebook + Instagram). Google Search campaigns are deferred per Q3-2026-strategy.md §12. All metrics depend on at least one active Meta campaign being launched; as of 2026-05-17, no active campaign is running.

**Pre-condition:** Resend domain verification (mail.ryan-realty.com) and Meta campaign activation are required before most of these metrics have values. The brain will set these to [campaign not active] until the campaign launches.

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| AH-01 | Meta campaigns active (count of live campaigns with spend greater than $0) | Meta Ads API — campaigns WHERE status='ACTIVE' | 0 (no active campaign 2026-05-17) | 1 seller lead-gen campaign live by July 7 | up | matt | weekly |
| AH-02 | Meta total monthly spend (USD) | `paid_campaign_daily` WHERE channel='meta' — SUM(spend_usd) monthly | $0 (no active campaign) | $3,000-$5,000/month (within Q3 budget) | stable | matt | monthly |
| AH-03 | Meta seller lead cost per acquisition (CPL) | Derived: AH-02 / CG-FB-03 | [not applicable — no campaign] | Under $250/qualified seller lead | down | brain | monthly |
| AH-04 | Meta lead form click-through rate (link clicks / impressions) | Meta Ads API — CTR per ad set | [not applicable — no campaign] | 1.8% CTR | up | brain | weekly |
| AH-05 | Meta seller audience reach per month | Meta Ads API — unique_reach_monthly WHERE audience_type='seller' | [not applicable — no campaign] | 8,000 unique reached | up | brain | monthly |
| AH-06 | Meta frequency per user per week (ad fatigue indicator) | Meta Ads API — frequency WHERE date_window='7d' | [not applicable — no campaign] | Under 3.0x/week | down | brain | weekly |
| AH-07 | Meta creative fatigue score (ads with CPL increase greater than 30% WoW) | Derived from `paid_campaign_daily` — CPL WoW delta | [not applicable — no campaign] | 0 fatigued creatives in rotation | down | brain | weekly |
| AH-08 | Meta lead form completion rate (completions / form opens) | Meta Ads API — lead_form_completions / lead_form_opens | [not applicable — no campaign] | 75% completion rate | up | brain | weekly |
| AH-09 | Meta lead-to-FUB qualified conversion rate (FUB Stage 3 / Meta leads) | Derived: NS-01 attributed to 'facebook_ads' / CG-FB-03 | [not applicable — no campaign] | 30% leads qualify | up | brain | monthly |
| AH-10 | Meta Retargeting audience size (website visitors, 30-day window) | Meta Ads Manager — custom audience size for ryan-realty.com visitors | [baseline TBD] | 2,000+ in retargeting pool | up | brain | monthly |
| AH-11 | Meta creative testing cadence (new creatives tested per month) | `marketing_brain_actions` WHERE action_type='content:fb_ad' AND status='executed' — monthly count | 0 | 2 new creatives tested per month | up | brain | monthly |
| AH-12 | Instagram Ads reach (boosted posts and paid placements) | Meta Ads API — reach WHERE placement='instagram' | [not applicable — no campaign] | 5,000 unique monthly | up | brain | monthly |

---

## Layer 6 — Operational Hygiene

**Definition:** Operational hygiene metrics track the health of the autonomous pipeline infrastructure: FUB CRM data quality, email deliverability, GBP response velocity, content production throughput, and brain action queue health.

### 6A — FUB CRM Hygiene

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| OH-FUB-01 | FUB leads without a Stage tag (unclassified leads) | FUB API — contacts WHERE stage IS NULL OR stage='' | [baseline TBD] | 0 unclassified leads | down | brain | weekly |
| OH-FUB-02 | FUB leads without a Source tag | FUB API — contacts WHERE lead_source IS NULL | [baseline TBD] | Under 5% untagged | down | brain | weekly |
| OH-FUB-03 | FUB active leads older than 90 days without a task (stale pipeline) | FUB API — contacts WHERE stage IN ('Stage1','Stage2') AND last_activity_date less than NOW()-90 days | [baseline TBD] | 0 stale leads over 90 days | down | brain | weekly |
| OH-FUB-04 | FUB qualified seller leads (Stage 3) response time — hours from creation to first outreach | FUB API — time delta between stage3_at and first_note_at | [baseline TBD] | Under 4 hours | down | matt | weekly |

### 6B — Email Deliverability

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| OH-EM-01 | Resend domain verification status (mail.ryan-realty.com) | Resend API — domain status | Unverified (2026-05-17) | Verified by June 30 | stable | matt | weekly |
| OH-EM-02 | Monthly email open rate (nurture sequences sent via Resend) | Resend API — opens / delivered | [not applicable — Resend unverified] | 38% open rate | up | brain | monthly |
| OH-EM-03 | Monthly email click-through rate | Resend API — clicks / delivered | [not applicable — Resend unverified] | 6% CTR | up | brain | monthly |
| OH-EM-04 | Email list size (verified subscribers, Deschutes County homeowners) | `email_subscribers` WHERE status='active' AND verified=true | [baseline TBD] | 500 active subscribers by Sept 30 | up | brain | monthly |
| OH-EM-05 | Email unsubscribe rate per campaign | Resend API — unsubscribes / delivered | [not applicable — Resend unverified] | Under 0.3% per campaign | down | brain | monthly |
| OH-EM-06 | Email bounce rate (hard bounces) | Resend API — hard_bounces / sent | [not applicable — Resend unverified] | Under 0.5% | down | brain | monthly |

### 6C — Content Production Throughput

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| OH-CP-01 | Brain actions emitted per week | `marketing_brain_actions` WHERE created_at BETWEEN week_start AND week_end — COUNT | [baseline TBD] | 5-8 actions per week | stable | brain | weekly |
| OH-CP-02 | Brain actions in 'ready' status awaiting Matt approval (queue depth) | `marketing_brain_actions` WHERE status='ready' — COUNT | [baseline TBD] | Under 5 items in queue at any time | down | brain | daily |
| OH-CP-03 | Brain actions approved and executed per week | `marketing_brain_actions` WHERE status='executed' AND executed_at BETWEEN week_start AND week_end — COUNT | [baseline TBD] | 4-6 per week | up | matt | weekly |
| OH-CP-04 | Brain actions killed or expired without execution (failure rate) | `marketing_brain_actions` WHERE status='killed' — monthly count | [baseline TBD] | Under 10% kill rate | down | brain | monthly |
| OH-CP-05 | Average action age from 'pending' to 'executed' (days) | Derived: AVG(executed_at - created_at) WHERE status='executed' | [baseline TBD] | Under 5 days average | down | brain | weekly |
| OH-CP-06 | Content posts published per week (all channels combined) | `marketing_brain_actions` WHERE action_type LIKE 'content:%' AND status='executed' — weekly count | [baseline TBD] | 7 posts/week minimum (1/day) | up | brain | weekly |
| OH-CP-07 | Video renders completed per week (listing + market + news + neighborhood) | `asset_library` WHERE media_type='video' AND created_at BETWEEN week_start AND week_end — COUNT | [baseline TBD] | 3 videos/week | up | brain | weekly |

### 6D — Pipeline Infrastructure Health

| ID | Metric | Source | Current Value | Q3 Target | Trend | Owner | Cadence |
|----|--------|--------|---------------|-----------|-------|-------|---------|
| OH-PI-01 | Supabase `market_stats_cache` freshness (hours since last update for Bend SFR) | `market_stats_cache` WHERE city='Bend' AND property_type='A' — MAX(updated_at) | [baseline TBD] | Updated within 24 hours at all times | stable | brain | daily |
| OH-PI-02 | Supabase `marketing_channel_daily` rows inserted per day (platform sync health) | `marketing_channel_daily` WHERE date = CURRENT_DATE - 1 — COUNT | [baseline TBD] | At least 15 rows/day (one per channel-metric pair) | stable | brain | daily |
| OH-PI-03 | ElevenLabs API remaining character balance | ElevenLabs API — /v1/user subscription.character_remaining | ~99,000 characters remaining (2026-05-17 estimate) | Above 20,000 characters at all times | stable | brain | weekly |
| OH-PI-04 | asset_library registered media files (cumulative) | `asset_library` — COUNT(*) | [baseline TBD] | +45 new assets registered Q3 | up | brain | monthly |
| OH-PI-05 | content_performance rows with 48h metrics filled | `content_performance` WHERE reach_48h IS NOT NULL — COUNT as percentage of total rows | [baseline TBD] | 100% fill rate within 72 hours of publish | stable | brain | weekly |

---

## Dashboard Health Check

Run this Supabase SQL to pull all Layer 1 and Layer 6 metrics in one pass (daily brain hygiene check):

```sql
-- Layer 1: North star latest monthly value
SELECT metric_name, SUM(value) AS monthly_total
FROM marketing_channel_daily
WHERE channel = 'fub'
  AND date >= date_trunc('month', CURRENT_DATE)
  AND metric_name IN (
    'qualified_seller_leads_mtd',
    'seller_consultations_booked_mtd'
  )
GROUP BY metric_name;

-- Layer 6C: Brain queue depth
SELECT status, COUNT(*) AS count
FROM marketing_brain_actions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;

-- Layer 6D: market_stats_cache freshness
SELECT city, property_type, MAX(updated_at) AS last_updated,
       NOW() - MAX(updated_at) AS age
FROM market_stats_cache
WHERE city = 'Bend' AND property_type = 'A'
GROUP BY city, property_type;
```

---

## Metric Count Verification

| Layer | Metrics | IDs |
|-------|---------|-----|
| Layer 1 — North Star | 10 | NS-01 through NS-10 |
| Layer 2 — Brand Position | 10 | BP-01 through BP-10 |
| Layer 3A — Instagram | 8 | CG-IG-01 through CG-IG-08 |
| Layer 3B — Facebook | 4 | CG-FB-01 through CG-FB-04 |
| Layer 3C — YouTube | 5 | CG-YT-01 through CG-YT-05 |
| Layer 3D — TikTok | 4 | CG-TT-01 through CG-TT-04 |
| Layer 3E — LinkedIn | 3 | CG-LI-01 through CG-LI-03 |
| Layer 4 — Site Health | 17 | SH-01 through SH-17 |
| Layer 5 — Ad Health | 12 | AH-01 through AH-12 |
| Layer 6A — FUB Hygiene | 4 | OH-FUB-01 through OH-FUB-04 |
| Layer 6B — Email Deliverability | 6 | OH-EM-01 through OH-EM-06 |
| Layer 6C — Content Throughput | 7 | OH-CP-01 through OH-CP-07 |
| Layer 6D — Pipeline Infrastructure | 5 | OH-PI-01 through OH-PI-05 |
| **Total** | **95** | |

**Minimum required:** 50. Actual: 95. Requirement satisfied.

---

## Baseline Collection Plan

Most metrics show [baseline TBD] because the unified `marketing_channel_daily` sync and `content_performance` table were added in Phase 4.6. The brain's first action of Q3 2026 (July 1) is to run the `snapshot-channels` producer across all platforms to populate June 2026 baselines for every [baseline TBD] cell above. The `site-audit` producer will pull Core Web Vitals and GSC data on the same day.

Until baselines are collected, the brain uses directional targets only and flags any action that claims a specific improvement percentage as [pending baseline].
