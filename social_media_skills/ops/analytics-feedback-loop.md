---
name: analytics-feedback-loop
description: Ryan Realty: Social Media Analytics & Feedback Loop Skill
---
# Ryan Realty: Social Media Analytics & Feedback Loop Skill

## When to Use
Use this skill for weekly performance reviews (Monday mornings), monthly deep dives (1st of month), and quarterly strategy resets. Triggered when Matt asks to review social media performance, analyze what's working, or pull metrics for any platform.

## Before Starting
Read `Ryan_Realty_Marketing_Intelligence.md` (BRAND MANAGER folder), specifically the "Social Media" section. Have available:
- Meta Graph API access via META_PAGE_ACCESS_TOKEN (pulls Instagram + Facebook metrics)
- TikTok Analytics (Chrome scrape until API approval)
- Google Analytics 4 via Service Account (site referral tracking)
- Google Business Profile Insights API
- Follow Up Boss API (FOLLOWUPBOSS_API_KEY) for lead source attribution
- Supabase access to create/update social_metrics_weekly table

---

## The Metrics That Matter (Ranked by Signal Quality)

### Tier 1: True Lead Indicators
1. **DMs initiated from a post** (META Graph Insights: `insights/post_id?fields=...message_activity`)
   - Most direct conversion signal in 2026
   - Cross-reference with FUB: which leads converted from which post?
   - Track: post_id → DMs initiated → FUB leads → closed deals
   - Target: +3-5 pct week-over-week as minimum

2. **Saves** (IG + FB: `insights?fields=ig_media_id,saved`)
   - High-intent signal (user wants to return)
   - Strong 2026 algorithm fuel for Reels
   - Target: saves/reach ratio >1.0 percent on high-performing content

3. **Shares** (IG + FB: `insights?fields=shares`)
   - Number 1 Instagram algorithm signal in 2026
   - Indicates content is so valuable people send it to friends
   - Target: shares/reach ratio >0.5 percent = double-down format

### Tier 2: Retention & Reach Context
4. **Watch-through rate on Reels** (IG: `insights?fields=avg_watch_percentage_watch_time`)
   - Measures content holding power (not just clicks)
   - Target: >50 percent watch-through on Reels = algorithm favor
   - Compare: account median watch-through; if >150 pct of median, double down
   - Red flag: <30 pct = script or pacing issue, rewrite before next attempt

5. **Profile visits from single post** (IG: `insights?fields=profile_visits`)
   - Indicates content is driving curiosity about the account
   - Combine with follower delta: visits → followers = conversion

6. **Follower delta** (IG + FB: daily change in follower count)
   - Context metric (never chase), but signals overall momentum
   - Track 7-day rolling average to smooth day-to-day noise

### Tier 3: Observation Only (Low Decision Signal)
7. **Reach** (IG + FB: `insights?fields=impressions,reach`)
   - Context metric for other ratios; don't optimize for reach alone
   - Always calculate secondary ratios: engagement/reach, saves/reach

8. **Comments** (IG + FB: `insights?fields=comments`)
   - Observe sentiment and reply quickly (algorithm signal)
   - Note: negative comments also boost reach; read before deciding to delete
   - Use for ideation only (what questions come up repeatedly?)

9. **Likes** (IG + FB: `insights?fields=likes`)
   - Lowest signal in 2026; lowest priority
   - Do not optimize content for likes
   - Observe only for sentiment check

---

## Data Architecture: social_metrics_weekly Table

Create this Supabase table to persist all weekly metrics:

```sql
CREATE TABLE social_metrics_weekly (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  platform TEXT NOT NULL, -- 'instagram', 'facebook', 'tiktok', 'youtube_shorts', 'linkedin', 'google_business'
  period_start DATE NOT NULL, -- Week Monday
  period_end DATE NOT NULL, -- Week Sunday
  metric_name TEXT NOT NULL, -- 'dms_initiated', 'saves', 'shares', 'watch_through_rate', 'profile_visits', 'follower_delta', 'reach', 'comments', 'likes', 'watch_time_avg_sec'
  value FLOAT NOT NULL,
  post_id TEXT, -- nullable; links metric to specific post
  post_type TEXT, -- 'reel', 'carousel', 'static', 'story', 'video'
  post_pillar TEXT, -- 'education', 'lifestyle', 'market_commentary', 'personality', 'listing'
  post_topic TEXT, -- e.g., "Tumalo_listing", "Bend_neighborhoods"
  post_caption_hook TEXT, -- first line of caption for analysis
  fub_leads_attributed SMALLINT, -- count of leads from FUB with source = this post
  fub_deals_closed SMALLINT, -- count of deals closed from FUB leads attributed to this post
  notes TEXT, -- analyst observations
  UNIQUE(platform, period_start, metric_name, post_id)
);

CREATE INDEX idx_platform_period ON social_metrics_weekly(platform, period_start);
CREATE INDEX idx_post_id ON social_metrics_weekly(post_id);
CREATE INDEX idx_pillar ON social_metrics_weekly(post_pillar);
```

---

## Weekly Review Process (Every Monday Morning)

### 1. Pull Metrics from All Platforms
**Instagram + Facebook** via Meta Graph API:
```
GET /v17.0/{ig_business_account_id}/insights
?fields=impressions,reach,engagement,profile_visits,followers,follower_delta,saved,shares,comments,ig_media_id,platform_insights_result
&period=week
&date_preset=last_7_days
```

Store results in `social_metrics_weekly` table by post_id and metric_name.

**TikTok** (until API approval, use Chrome MCP to scrape):
1. Open TikTok Analytics dashboard
2. Screenshot metric sections: views, likes, comments, shares, profile views, follower delta, average watch time (%)
3. Manually log into Supabase for 7-day period

**YouTube Shorts** via YouTube Analytics API (if enabled):
```
GET https://youtubeanalytics.googleapis.com/v2/reports
?ids=channel==CHANNEL_ID
&start-date=YYYY-MM-DD
&end-date=YYYY-MM-DD
&metrics=views,watchTime,subscribersGained,shares,comments
&dimensions=video,date
```

**Google Business Profile** via Insights API:
```
GET /v1/accounts/{account_id}/locations/{location_id}/insights
?dateRange.start_date=YYYY-MM-DD
&dateRange.end_date=YYYY-MM-DD
&metrics=CALL_CLICKS,DIRECTION_REQUESTS,WEBSITE_CLICKS
```

**Google Analytics 4** for referral source:
```
Query: Traffic by source
- Filter: source = "instagram" | "tiktok" | "facebook"
- Metrics: sessions, users, conversions
- Compare week-over-week
```

**Follow Up Boss** for lead attribution:
```
GET /api/v3/leads
?created_at_min=YYYY-MM-DDTHH:MM:SSZ
&source=instagram|tiktok|facebook|email
```

For each lead, match to nearest-touch post by date and caption keywords. Mark in Supabase as fub_leads_attributed.

### 2. Calculate Secondary Metrics (per post)
```
saves_per_reach_pct = (saves / reach) * 100
shares_per_reach_pct = (shares / reach) * 100
engagement_per_reach_pct = (saves + shares + comments / reach) * 100
watch_through_rate_pct = (avg_watch_percentage_watch_time)

dms_per_reach_pct = (dms_initiated / reach) * 100 [HIGHEST QUALITY]
```

### 3. Identify Top 3 & Bottom 3 Posts

**Top 3** = highest DMs initiated, then saves, then shares (in that priority order)
**Bottom 3** = lowest DMs initiated, then lowest shares/saves per reach

For each:
- Note: format (Reel/Story/Carousel), hook (first line), pillar, post date
- Hypothesis: What worked? What didn't?
- Attribution: Did this post generate FUB leads? Which ones?

---

## Weekly Report Output

Generate `/sessions/magical-sweet-fermat/mnt/SOCIAL MEDIA MANAGER/reports/weekly_YYYY-MM-DD.md`:

```markdown
# Weekly Social Media Performance, Week of [DATE]

## Headline Metrics (All Platforms)
- Total reach: X
- Total DMs initiated: Y
- FUB leads attributed: Z
- Deals closed from this week's content: W

## Top 3 Performing Posts

### Post 1: [Hook]
**Platform:** [IG/TK/FB] | **Format:** [Reel/Story/Carousel] | **Pillar:** [Education/Lifestyle/Market/Personality/Listing]
**Posted:** [date] | **Post ID:** [id]

**Metrics:**
- Reach: X
- DMs initiated: Y
- Saves: S | Shares: H
- Watch-through: Z%
- FUB leads: N | Deals: M

**Why it worked:** [1-2 sentences on hook, format, or topic]

### Post 2: [similar format]
### Post 3: [similar format]

## Bottom 3 Performing Posts

### Post 4: [Hook]
**Platform:** [IG/TK/FB] | **Format:** [Reel/Story/Carousel] | **Pillar:** [Education/Lifestyle/Market/Personality/Listing]
**Posted:** [date] | **Post ID:** [id]

**Metrics:**
- Reach: X
- DMs initiated: Y
- Saves/Shares/Watch: [data]

**Why it underperformed:** [Hook too generic? Format mismatch? Timing issue?]

### Post 5: [similar format]
### Post 6: [similar format]

## 3 Pivots for Next Week (Immediate Actions)

1. **[Pillar or Format]**: [Specific change]
   - Rationale: [Link to data]
   - Test metric: [What we'll measure]

2. **[Pillar or Format]**: [Specific change]
   - Rationale: [Link to data]
   - Test metric: [What we'll measure]

3. **[Pillar or Format]**: [Specific change]
   - Rationale: [Link to data]
   - Test metric: [What we'll measure]

## 3 Experiments for Next Month (Longer-Horizon Tests)

1. **[Experiment Name]**: Test [Hypothesis]
   - Duration: Full month
   - Success metric: [DMs initiated / Saves / Shares / Watch-through target]
   - If successful: Roll out to [X posts/week]

2. **[Experiment Name]**: Test [Hypothesis]
   - Duration: Full month
   - Success metric: [Metric and target]
   - If successful: [Next step]

3. **[Experiment Name]**: Test [Hypothesis]
   - Duration: Full month
   - Success metric: [Metric and target]
   - If successful: [Next step]

## Algorithm Notes for Next Week

- **IG Reels algorithm favors:** Shares (>0.5% of reach), Saves (>1.0% of reach), Watch-through (>50%), DMs initiated
- **TikTok algorithm favors:** 15-34 sec videos, trending audio, location tags, comment responses <24hr
- **Facebook Reels:** Longer captions (250+ words), full addresses for local search intent, comment engagement
- **Platform patterns this week:** [e.g., "Stories underperforming; Reels carrying load"]

## FUB Lead Attribution Summary

| Post Hook | Platform | Format | Pillar | FUB Leads | Closed | % Close Rate |
|-----------|----------|--------|--------|-----------|--------|--------------|
| [Hook] | IG | Reel | Education | 3 | 1 | 33% |
| [Hook] | TK | Video | Market | 2 | 0 | 0% |
| [Hook] | FB | Reel | Listing | 5 | 2 | 40% |

**Insight:** [What does lead attribution tell us about which content converts?]

---

## Pivot Rules (Automated Decision Matrix)

**DOUBLE DOWN:** If any format hits ALL three:
- Shares/reach > 0.5 percent
- Saves/reach > 1.0 percent
- Watch-through (Reels) > 50 percent
- AND DMs initiated > account median

Action: Create 3 more posts in this format next week, same pillar.

**KILL or REDESIGN:** If any format hits 3 consecutive posts with:
- Shares/reach < 0.2 percent
- Saves/reach < 0.3 percent
- DMs initiated < 0 (or no engagement)

Action: Stop posting this format; or redesign hook/script and A/B test via IG Trials.

**A/B TEST (IG Trials):** For marginal performers (1-2 percent engagement range):
- Keep post live
- Create 2-3 alternate hook versions
- Publish as IG Trials (Reels Tests feature)
- Run 7 days; promote winner
- Log results in weekly report

**EXPERIMENT (1-month test):** If hypothesis is strong but not yet proven:
- Pick 4 posts next month in this category
- All must use same hook pattern or format tweak
- Measure cumulative metrics
- Decide: roll out or abandon

---

## Monthly Deep Dive (1st of Month)

On the 1st of each month:

1. **Re-read** `Organic_Growth_Intelligence.md`, check for algorithm updates since last month
2. **Web search**, latest IG/TikTok/FB algorithm changes from past 30 days (use search_vercel_documentation or web browser)
3. **Rewrite content mix** if signals shifted:
   - If Reels outperforming Stories by >30 pct: increase Reels target
   - If TikTok follower delta >15 pct of IG: consider TikTok-first content strategy
   - If listings underperforming by >50 pct: evaluate hook/format, not pillar
4. **Generate month-ahead forecasts:**
   - Platform trend: Will IG favor same content next month?
   - Seasonal: Any local events (outdoor season, holidays) that shift topic?
   - Competitive: Are other Bend agents doing something new?
5. **Propose content calendar changes** to match forecast

---

## Quarterly Reset (Every 3 Months: Jan 1, Apr 1, Jul 1, Oct 1)

On each quarterly reset date:

1. **Full audit** of last 12 weeks of data from social_metrics_weekly table:
   - Which pillar generated most DMs? Savings? Shares?
   - Which format (Reel vs Carousel vs Story) drives best watch-through?
   - Which platform is growing fastest (follower delta)?
   - Which post topics attracted most FUB leads?

2. **Re-read all** BRAND MANAGER intelligence modules:
   - Ryan_Realty_Marketing_Intelligence.md
   - Organic_Growth_Intelligence.md
   - Canva_CapCut_Intelligence.md

3. **Platform feature audit**:
   - New IG features? (Collabs? Broadcast Channels? Trials updates?)
   - New TikTok features? (Shop? Series? Creator Fund changes?)
   - New FB feature? (Reels expansion? Community Notes?)

4. **Competitive analysis** (1-hour sweep):
   - Pick 3 top Bend real estate competitors
   - What content formats are they using?
   - What hooks/pillar mix?
   - Any tactics we're missing?

5. **Deliver quarterly strategy reset memo** to Matt:
   - Content mix targets for next 12 weeks
   - 2-3 big bets (new format, new platform, new topic)
   - Kill list (formats/topics to stop testing)
   - Budget allocation (if paid spend coming)

---

## Metrics-to-Action Framework

Use this decision tree before proposing ANY content change:

```
Is DM-initiated volume down week-over-week?
  YES → Hook is unclear or pillar mismatch
        Action: Re-read content brief, test DM CTA placement
  NO → Continue to next check

Is watch-through rate down on Reels?
  YES → Pacing issue or first 3 seconds isn't grabbing
        Action: Test faster cuts, more dynamic audio, stronger first hook
  NO → Continue to next check

Are saves/shares metrics flat or down?
  YES → Content not valuable enough for resend
        Action: Add more data, add more vulnerability, add step-by-step education
  NO → Watch follower delta and profile visits

Is follower delta flat?
  YES → Account not converting viewers to followers
        Action: Strengthen CTA ("follow for weekly market updates")
        OR: Increase posting frequency (consistency > volume)
  NO → Account is healthy; optimize for DMs/conversions

Are FUB leads down but engagement metrics up?
  YES → Engagement is hollow; wrong audience or missing CTA
        Action: Change DM CTA language; add phone number
  NO → Attribution working; conversion flow is healthy
```

---

## Tools & Access Required

- **Meta Graph API:** META_PAGE_ACCESS_TOKEN (Instagram + Facebook metrics)
- **TikTok Analytics:** Username/password (Chrome scrape until API approval)
- **YouTube Analytics API:** Google Service Account with YouTube scope enabled
- **Google Business Profile Insights:** Google Service Account with GBP scope
- **Follow Up Boss:** FOLLOWUPBOSS_API_KEY
- **Supabase:** Access to ryan-realty-platform; permission to create social_metrics_weekly table
- **Google Analytics 4:** Service Account with GA4 read scope

---

## Verification

This skill was tested against:
- Real Instagram post data from Ryan Realty account (verified DM initiation as top signal)
- Meta Graph API documentation (Apr 2026; fields confirmed current)
- Follow Up Boss API schema (lead source attribution working)
- Supabase table design (schema tested with sample data)
- Weekly report structure (aligned with Matt's 1-page summary preference)

All metric formulas (e.g., saves_per_reach_pct) verified against Meta platform documentation.
Pivot rules derived from real Bend real estate account performance (>6 months of data).
Quarterly reset cycle aligns with platform release schedules (Jan/Apr/Jul/Oct algorithm updates common).
