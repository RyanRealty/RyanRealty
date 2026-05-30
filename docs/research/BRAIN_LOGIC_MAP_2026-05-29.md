# Brain Logic Map — Ryan Realty Marketing Brain
**Date:** 2026-05-29
**Author:** Claude Sonnet 4.6 (deep audit session)
**Purpose:** End-to-end trace of the marketing-brain pipeline, with precise file:line evidence, used to identify where to rewire for organic channel growth based on what is working today.

---

## 1. The Full Loop (text diagram with file evidence)

```
STAGE 0 — Channel Snapshot (daily 06:30 UTC)
  └── app/api/cron/marketing-snapshot-{ga4,x,meta-page,meta-ads,tiktok,youtube,linkedin,gsc,...}/route.ts
       → writes marketing_channel_daily (date, channel, scope, scope_id, metric, value)
       Status: GA4 and X are LIVE. Meta, FUB, GSC, YouTube, LinkedIn, TikTok = "Pending"
               (keys configured, ingestors not yet wired)
               lib/marketing-brain/snapshot.ts (shared upsertMetricRows helper)

STAGE 1 — Competitor Recon (Mon-Fri 07:00 UTC, one source/day)
  └── app/api/cron/marketing-competitor-recon/route.ts
       → Apify actors (instagram_profile, tiktok_profile, google_serp, fb_ad_library, google_maps_reviews)
       → writes competitor_intel (observation_date, competitor, source, data_type, data)
       lib/marketing-brain/competitor-recon.ts

STAGE 2 — Platform Trends (Monday 08:00 UTC)
  └── app/api/cron/marketing-platform-trends/route.ts
       → Apify rag-web-browser scrapes platform newsrooms + industry blogs
       → writes competitor_intel rows with source='algorithm_intel'|'industry_signal'
       → outputs PlatformTrendsReport.ryan_realty_adaptations.{act_on, monitor, skip}
       lib/marketing-brain/platform-trends.ts

STAGE 3 — Weekly Cycle (Monday 02:00 UTC — runs Sunday night PT)
  └── app/api/cron/marketing-weekly-cycle/route.ts
       → lib/marketing-brain/weekly-cycle.ts: runWeeklyCycle()
         a) generateInsightSummary() per channel (diagnose.ts) — reads marketing_channel_daily
            computeDelta() + detectAnomalies() — WoW/MoM deltas, z-scores
            → recommended_actions per channel (vocab: capitalize_on_spike, test_new_creative, etc.)
         b) auditWebsite() — audit-website.ts (GA4 + GSC + FUB funnel)
         c) auditAds() — audit-ads.ts (Meta Ads creative fatigue, budget drift, CPL)
         d) auditCRM() — audit-crm.ts (FUB lead quality, north-star = qualified_seller_leads)
         All four run in parallel

STAGE 4 — Brief Generation (called from weekly cycle, also GET /api/marketing-brain/generate-briefs)
  └── lib/marketing-brain/generate-briefs.ts: generateWeeklyBriefs()
       → gatherSignals() — pulls all audit outputs + platform trends + competitor rows
                         + cadence gaps (gatherCadenceGaps, line 635)
                         + active listing needs (gatherActiveListingNeeds, line 703)
                         + audit findings (fetchLatestAuditFindings, line 778)
                         + performanceBias (gatherPerformanceBias from performance-bias.ts)
       → synthesizeOpportunities() (line 1032) — rank = severity_score * north_star_weight * bias_multiplier
       → applyBiasToOpportunities() (line 1215) — multiplies rank_score by format_bias_map
       → mapOpportunityToBriefs() (line 1320) — maps each opportunity to 0-N GeneratedBrief structs
       → applyBrandVoice() — §6 hard-fail rules on every hook/body/cta
       → persistBriefs() — writes content_briefs (legacy name) + marketing_brain_actions rows
         status='pending', generated_by='marketing_brain:generate-briefs'

STAGE 5 — Dispatch (every 15 min via cron)
  └── app/api/cron/producer-dispatcher/route.ts
       → reads marketing_brain_actions WHERE status='pending' ORDER BY priority_score DESC
       → UPDATE status='in_production', executed_at=now()
       → writes runtime_invocation_command to executor_response
       NOTE: dispatcher does NOT auto-invoke Claude Agent SDK (loop-closure-log.md line 87).
             It writes the command; the producer-runtime cron (below) executes.

STAGE 5b — Producer Runtime (every 30 min via cron)
  └── app/api/cron/producer-runtime/route.ts
       → requires PRODUCER_RUNTIME_ENABLED=true (set in Vercel prod)
       → picks up status='in_production' rows
       → loads assigned_producer/SKILL.md, calls Claude API via Anthropic SDK
       → transitions row to status='ready', populates executor_response

STAGE 6 — Content Engine Routing (called by producer-runtime for content:* actions)
  └── automation_skills/content_engine/SKILL.md
       → routes by format to the matching producer SKILL.md
       → runs: storyboard → build → QA pass → contact-sheet surface → Matt review
       → HARD GATE: Matt must explicitly approve (silence is not approval)

STAGE 7 — Matt Approval (human-in-the-loop)
  └── /admin/approval-queue (UI)
       Matt says: "ship [N]" / "approve all" / "kill [N]"

STAGE 8 — Publish (every 10 min via cron after approval)
  └── app/api/cron/publisher-sweep/route.ts
       → reads status='approved', scheduled_for <= now()
       → calls /api/social/publish per platform
       → writes content_performance row per platform (action_id, platform, platform_post_id, posted_at)
       → UPDATE status='executed'

STAGE 9 — Measurement (cron: 24h, 7d, 30d windows)
  └── app/api/cron/marketing-measurement-loop/route.ts
       → lib/marketing-brain/measurement-loop.ts: runMeasurementLoop()
       → pulls platform metrics per published post at 3 windows (24h, 168h, 720h)
       → writes content_performance rows (impressions, reach, views, engagements, saves, shares)
       → persistLoopDigest() — writes marketing_decisions row with top-3 winners/losers
         by north_star_attributed_seller_leads

STAGE 10 — Learn (feeds back into Stage 4)
  └── lib/marketing-brain/performance-bias.ts: gatherPerformanceBias()
       → reads last 30 days of content_performance (where metrics_7d populated)
       → groups by (format, platform)
       → bias_score = 1.0 + (avg_north_star * 0.6) + (avg_save_rate * 0.25) + (avg_share_rate * 0.15)
       → winners (bias > 1.2) float up; losers (bias < 0.8) penalized in opportunity ranking
       → format_bias_map applied to rank_score in synthesizeOpportunities() (line 1215)
  └── lib/marketing-brain/generate-briefs.ts: getFormatPerformance()
       → reads content_performance joined to marketing_brain_actions
       → computes median engagement_rate per (action_type, platform)
       → uplift_vs_baseline = (group_median_er - overall_median_er) / overall_median_er
       → BOOST_UPLIFT_THRESHOLD = +0.25 → 20% priority bump
       → SUPPRESS_UPLIFT_THRESHOLD = -0.25 → format dropped from cycle
  └── lib/marketing-brain/generate-briefs.ts: fetchLatestAuditFindings()
       → reads latest analyze:audit_findings action row
       → pickAuditWinningFormat() uses p75 engagement rate to choose format per topic
```

---

## 2. Where Content Decisions Are Made

### Primary decision point: `lib/marketing-brain/generate-briefs.ts` — `mapOpportunityToBriefs()` (line 1320)

The opportunity-to-format mapping table (from the file header, lines 18-50):

```
audit-crm north_star drop/spike       → fb_lead_gen_ad + market_data_short
audit-ads creative test_new_creative  → fb_lead_gen_ad x3 variants
audit-ads capitalize_on_spike         → market_data_short
audit-website seo investigate_drop    → blog_post
audit-website seo capitalize_on_spike → blog_post + ig_carousel
competitor serp_gap                   → blog_post + ig_carousel
competitor format_gap (video)         → market_data_short
platform-trends format act_on         → market_data_short OR meme_video
platform-trends audio act_on          → meme_video
platform-trends hashtag               → ig_carousel
diagnose capitalize_on_spike          → channel-matched format (lines 2228-2290)
cadence gap (any channel)             → channel-matched default (lines 2291-2343)
listing_coverage uncovered_active     → content:list_kit (lines 2345-2380)
```

**The decision is a mix of data-driven and static rules.** The ranking is data-driven (severity * north_star_weight * bias_multiplier). But the format assigned to each opportunity type is largely static — hardcoded in `mapOpportunityToBriefs()`. The bias multiplier is applied BEFORE the brief is generated, meaning high-performing formats bubble up in the ranked opportunity list. However, the format chosen for each opportunity type does not change based on what is working — only the priority changes.

**Priority scoring** (brain-decision-logic.md):
```
priority_score = 0.50 × north_star_impact
              + 0.20 × brand_position_lift
              + 0.15 × channel_growth
              + 0.10 × site_or_ad_health
              + 0.05 × brand_equity
```
Emission threshold: 0.30 standard, 0.20 on low-signal weeks. Cap: 12 actions/week.

**Cadence targets** (generate-briefs.ts line 250):
```
instagram: 5/week, tiktok: 5/week, meta_page: 4/week,
youtube: 2/week, linkedin: 3/week, x: 5/week, gbp: 2/week
```
When a channel falls below target, it generates a brief with the channel's default format. Cadence monitoring IS data-driven: it reads actual post counts from `marketing_channel_daily`.

---

## 3. Does "What's Working Today" Feed Back In?

**Loop status: PARTIALLY CLOSED — with a critical data gap.**

### Evidence that the loop IS wired:

1. `lib/marketing-brain/performance-bias.ts` (implemented 2026-05-17, brain-learning-loop-log.md): reads `content_performance` grouped by (format, platform), computes `bias_score`, writes `format_bias_map` and `platform_bias_map`. Applied in `synthesizeOpportunities()` via `applyBiasToOpportunities()`.

2. `lib/marketing-brain/generate-briefs.ts`: `getFormatPerformance()` (line 443) joins `content_performance` to `marketing_brain_actions`, computes median engagement rate per (action_type, platform), and applies `BOOST_MULTIPLIER = 1.2` for formats 25% above baseline with confidence >= 'medium'. Formats 25% below baseline are suppressed for the cycle.

3. `measurement-loop.ts` `persistLoopDigest()` (line 779): writes the top-3 winners/losers by `north_star_attributed_seller_leads` into `marketing_decisions` with `decision_type='performance_loop_completed'`. The weekly cycle reads `marketing_decisions` — so the loop digest IS in the data the brain sees next cycle.

4. `fetchLatestAuditFindings()` (generate-briefs.ts line 778): reads the `analyze:audit_findings` action row to extract `top_winners_by_topic_format`, then `pickAuditWinningFormat()` (line 877) can override the static format choice when p75 engagement rate is sufficiently high and sample >= 5.

### Critical gap — the loop is STARVED of data:

The `snapshot-channels` skill shows that **only GA4 and X ingestors are LIVE**. Meta, Instagram, TikTok, YouTube, LinkedIn, FUB, GSC, GBP are all "Pending" (snapshot-channels/SKILL.md channel inventory table). This means:

- `marketing_channel_daily` has real data only for GA4 and X.
- `diagnose-performance` anomalies for Instagram, TikTok, YouTube, LinkedIn = `insufficient_data`.
- The weekly cycle's `generateInsightSummary()` for 9 of 11 channels returns empty/error.
- `content_performance` can only be populated when `publisher-sweep` writes `platform_post_id` rows, which requires the publishing pipeline to be running for each platform.
- The `performance-bias` and `getFormatPerformance` functions are no-ops when `content_performance` is empty.

**Verdict: The learn→brief feedback loop is architecturally complete but effectively inoperative until the channel ingestors and publishing pipeline are fully wired for IG, TikTok, YouTube, and LinkedIn.**

---

## 4. Channel Coverage and Organic-Growth Gaps

### Channels with brain coverage (cadence targets set in generate-briefs.ts line 250):

| Channel | Cadence target | Default format on gap | Snapshot ingestor | Publisher wired |
|---|---|---|---|---|
| Instagram | 5/week | market_data_short (or ig_carousel if audit win) | Pending | Partially |
| TikTok | 5/week | market_data_short | Pending | No |
| Facebook (meta_page) | 4/week | market_data_short | Pending | Yes (Meta Graph) |
| YouTube | 2/week | market_data_short (or market_youtube_longform) | Pending | No |
| LinkedIn | 3/week | ig_carousel | Pending | No |
| X | 5/week | market_data_short | LIVE | Yes |
| GBP | 2/week | gbp_post | Pending | Partially |

### Gap analysis for organic growth:

1. **Opportunity types that should produce organic content but do not**:
   - `platform-trends audio act_on` → only maps to `meme_video`. No trending-audio reels for listing or market content.
   - `platform-trends algorithm` → mapped to `comms:matt_alert` only. Algorithm signals never generate format-adaptive content.
   - `diagnose capitalize_on_spike` on organic channels → maps to `market_data_short` regardless of which channel spiked. A TikTok viral spike should produce another TikTok-native format, not a generic market stat card.

2. **No proactive discovery of trending topics**. `platform-trends` scrapes industry blog posts about platform changes, but does NOT pull the actual trending content on each platform (trending sounds, hashtags with rising velocity, viral hook patterns in real estate or local niche right now). The `scrapeAudioAndHashtagTrends()` function exists but uses `apify/rag-web-browser` on TikTok Creative Center, which the SKILL.md notes "is JavaScript-heavy; see TODO in source if actor cannot parse it" — likely returning empty.

3. **No content-type variety from learning loop**. Cadence gaps always produce `market_data_short` regardless of what formats are actually performing. The `pickAuditWinningFormat()` function can override this, but only when `analyze:audit_findings` rows exist (a producer that itself needs to be run). This is a stub dependency.

4. **LinkedIn and YouTube organic growth are underweighted**. LinkedIn's default cadence format is `ig_carousel` (a cross-post, not LinkedIn-native). YouTube's default is `market_data_short` (a short, not a YouTube-native long-form). These defaults do not reflect what actually works on those platforms.

5. **No engagement-driven discovery**. Comments, DMs, and saves on published posts are not parsed to identify what resonates with the audience. The `engagement_bot` (automation_skills/automation/engagement_bot/) exists as a capability but is not wired into the brief-generation signal bundle.

---

## 5. Trend Detection Status

### What is working:
- `marketing-competitor-recon` runs Mon-Fri, pulls IG profiles, TikTok profiles, SERP positions, FB Ad Library, and GMB reviews for 10 competitors. Data lands in `competitor_intel`. `gatherSignals()` reads this table (line 909) and surfaces `competitor format_gap` and `competitor serp_gap` opportunities.
- `marketing-platform-trends` scrapes 6 algorithm-intel URLs and 4 format-trend URLs weekly. Voice-filters results. Outputs `act_on` bucket.

### What is NOT working:
1. **TikTok trending audio/hashtags**: `scrapeAudioAndHashtagTrends()` in `platform-trends.ts` line ~74 (SKILL.md) uses `apify/rag-web-browser` on TikTok Creative Center, which is documented as potentially unable to parse the JavaScript-heavy page. The alternative `clockworks/free-tiktok-scraper` is listed as a TODO. If this is empty, the brain never gets audio-trend signals.

2. **No real-time viral signal**. Platform trends are pulled weekly (Monday 08:00 UTC). A TikTok sound that blows up on Wednesday does not reach the brain until the following Monday. The gap is structural — there is no daily trend-check.

3. **Trend data does not flow into tool selection**. When a `platform-trends format act_on` opportunity generates a `market_data_short` brief, nothing in the pipeline specifies WHICH AI tool, WHICH hook pattern, or WHICH visual treatment matches the identified trend. The trend signal is lost at the produce step.

---

## 6. Tool Selection Gap

### Where tool selection currently happens (or does not):
- `REGISTRY.md` maps action_type → assigned_producer. No tool is selected at this level.
- `automation_skills/content_engine/SKILL.md` routes to the format SKILL.md. No tool selection here.
- Format SKILL.md (e.g., `video_production_skills/market-data-video/SKILL.md`): the recipe describes HOW to build. Tool selection (which AI model for B-roll, which music bed, which caption style, which hook pattern) is left to the agent reading the SKILL.md.
- `video_production_skills/ai_platforms/SKILL.md`: a capability skill with a decision matrix for AI video models (Kling 3.0 for hero quality, Veo 3.1 for cost-effective API, etc.). But this skill is NOT in any produce tier's mandatory reference list. It is listed in Section G of REGISTRY.md as a "capability, not brain-callable directly."
- `marketing_brain_skills/research/tool-inventory.md`: comprehensive but is a reference doc, not loaded by producers at runtime.

### The gap:
There is no skill that the brain or content engine auto-loads at produce-time to make the RIGHT tool choice based on the platform, the format, the trend signal, and the content type. The `ai_platforms` capability skill exists but is not mandatory-referenced in the TEMPLATE.md tiers or the content_engine routing. Producers could load it, but most do not (based on the producer audit in phase 6 logs).

### Where a tool-mastery skill must plug in:
To be auto-loaded, a new `video_production_skills/tool-mastery/SKILL.md` (or equivalent) must be added to **TEMPLATE.md Tier 3** (every video/animated producer) AND referenced in `automation_skills/content_engine/SKILL.md`'s mandatory references block. It must also be listed in Section G of REGISTRY.md as a capability. As long as it is only a standalone file, it will only be loaded when an individual producer happens to reference it.

---

## 7. Skill Loadability Mechanism

### How skills load at runtime:
The producer-runtime cron (`app/api/cron/producer-runtime/route.ts`) picks up `in_production` rows and calls the Claude API with the producer's `SKILL.md` as the recipe. The Claude model reads the SKILL.md, follows the tier references, and loads each referenced file by path. There is no automatic injection — the agent must explicitly read each file named in the tier references.

### The tier enforcement mechanism:
`marketing_brain_skills/producers/TEMPLATE.md` defines the 5 tiers. Every producer SKILL.md that follows the template includes a "Mandatory references" section listing the tier references. The producer-runtime cron loads the producer SKILL.md, which instructs the agent to load the tier files. This is a document-convention enforcement, not a code enforcement.

### What this means for adding new skills:
To auto-load a new skill for ALL content producers, it must be added to:
1. **`marketing_brain_skills/producers/TEMPLATE.md` Tier 2 or Tier 3** (the authoritative template that every new producer scaffolds from).
2. **`automation_skills/content_engine/SKILL.md`** mandatory references block (the routing bus for all `content:*` actions — already has 8 mandatory references, add to this list).
3. **Retroactively to each existing producer's SKILL.md** in their mandatory references section (or they will miss it until they are touched/rebuilt).

For a tool-mastery skill (applies to video producers only):
- Add to **TEMPLATE.md Tier 3**.
- Add to **content_engine/SKILL.md** mandatory references.
- Add to **Section G of REGISTRY.md** as a capability.

For a viral-playbook skill (applies to all content producers):
- Add to **TEMPLATE.md Tier 2**.
- Add to **content_engine/SKILL.md** mandatory references.
- Add to **Section G of REGISTRY.md** as a capability.

---

## 8. Ranked Rewiring Points for "Organically Grow All Channels with What's-Working-Today Content"

### Rewiring point 1 — Close the data loop: wire all channel snapshot ingestors [CRITICAL]

**Problem:** The learn→brief feedback loop is architecturally correct but starved of data. Only GA4 and X ingestors write to `marketing_channel_daily`. Instagram, TikTok, YouTube, LinkedIn = no data.
**File:** `marketing_brain_skills/snapshot-channels/SKILL.md` — channel inventory table shows 10 of 15 channels as "Pending."
**Fix:** Wire the Meta Page ingestor (`lib/meta-graph.ts`), YouTube ingestor (`lib/youtube.ts`), LinkedIn ingestor (`lib/linkedin.ts`), TikTok ingestor (`lib/tiktok.ts`), and FUB ingestor. Each is a ~150-line route file following the shared pattern in `lib/marketing-brain/snapshot.ts`.
**Impact:** Once wired, `gatherCadenceGaps()` fires real alerts, `diagnose-performance` surfaces real anomalies per platform, and the performance-bias loop gets actual engagement data. Every downstream function becomes meaningful instead of no-op.

### Rewiring point 2 — Add a viral/trend signal skill loadable at brief-time [HIGH]

**Problem:** `platform-trends` pulls weekly industry blog posts about algorithm changes, not actual viral content on each platform (which sounds are trending, which hook patterns are getting 5% watch-to-end rates, which real estate creators are blowing up right now).
**Fix:** Create `marketing_brain_skills/research/viral-signal/SKILL.md` (or extend `platform-trends`) with:
  - Apify `clockworks/free-tiktok-scraper` for real trending sounds + hashtags (fix the TODO in `platform-trends.ts scrapeAudioAndHashtagTrends`).
  - Apify IG profile scraper on top 5 real estate creators (not just competitors) to extract hook patterns and engagement rates on recent posts.
  - A daily cron (not weekly) that writes fresh `act_on` rows to `competitor_intel` or a new `viral_signals` table.
  - The output must be read by `gatherSignals()` in `generate-briefs.ts` (line 910+) alongside `platformTrends`.
**Wire into:** `generate-briefs.ts gatherSignals()` as a new parallel promise. Add to `REGISTRY.md` Section H as a brain component.

### Rewiring point 3 — Build and load a tool-mastery skill in the producer execution path [HIGH]

**Problem:** When the brain decides to make a TikTok reel about a market stat, nothing at produce-time chooses the RIGHT AI model (Kling 3.0 vs Veo 3.1 vs Wan 2.5 i2v), the RIGHT hook pattern for TikTok's current algorithm, the RIGHT audio bed, or the RIGHT visual treatment. The `ai_platforms` capability skill exists but is not in any mandatory tier.
**Fix:** Create `video_production_skills/tool-mastery/SKILL.md` with:
  - A decision matrix: platform → content_type → recommended AI model + settings.
  - Links to `video_production_skills/ai_platforms/SKILL.md` for the model-specific API details.
  - A hook-pattern library for each platform (IG Reels, TikTok, YouTube Shorts).
  - Audio bed selection rules (beat-matched vs. ambient vs. trending sound).
**Wire into:** `marketing_brain_skills/producers/TEMPLATE.md` Tier 3 (every video producer). `automation_skills/content_engine/SKILL.md` mandatory references. `REGISTRY.md` Section G.

### Rewiring point 4 — Build and load a viral-playbook skill for brief-guided content decisions [HIGH]

**Problem:** Brief generation decides WHAT to make and for WHICH channel, but the content engine and individual producers have no unified playbook for HOW to make it viral for that specific platform in 2026. The `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md` tell producers what NOT to do and provide a minimum quality floor, but they do not prescribe what IS working right now (hook patterns, pacing, caption timing, CTA placement, content angles).
**Fix:** Create `video_production_skills/viral-playbook/SKILL.md` with:
  - Per-platform 2026 winning patterns synthesized from the research docs already in `docs/research/`.
  - Specific hook templates for each content type × platform combination.
  - Engagement-trigger menu with specific examples (curiosity gap, local stat surprise, contrarian claim, etc.).
  - Updated whenever the viral-signal cron surfaces a new pattern.
**Wire into:** `marketing_brain_skills/producers/TEMPLATE.md` Tier 2. `automation_skills/content_engine/SKILL.md` mandatory references.

### Rewiring point 5 — Fix cadence-gap format defaults to be platform-native [MEDIUM]

**Problem:** Cadence gaps always produce `market_data_short` as the default, which is a stat-card video. On LinkedIn the default is `ig_carousel` (cross-post). These are not platform-native choices and do not maximize organic reach.
**File:** `lib/marketing-brain/generate-briefs.ts` lines 2291-2343.
**Fix:** Change the cadence defaults:
  - `linkedin`: `content:linkedin_doc_carousel` (24% engagement vs 6% static per REGISTRY.md notes).
  - `youtube`: `content:neighborhood_tour` or `content:market_youtube_longform` (not a Short, which is already covered by TikTok/IG).
  - `tiktok`: rotate between `market_data_short`, `content:tiktok_listing_tour`, and `content:meme_video` based on `performanceBias.format_bias_map`.
  - `instagram`: rotate between `market_data_short`, `ig_carousel`, and `listing_reveal` based on audit-winning format.

### Rewiring point 6 — Wire engagement signals into the signal bundle [MEDIUM]

**Problem:** The `engagement_bot` capability exists (`automation_skills/automation/engagement_bot/`) but comment/DM/save patterns from organic posts never reach `gatherSignals()` in `generate-briefs.ts`.
**Fix:** Add a `gatherEngagementSignals()` function to `generate-briefs.ts` that reads `content_performance` for posts with high `saves` or `shares` (top quartile), extracts the topic from `metadata.topic`, and adds a synthetic `capitalize_on_spike` opportunity for repeat-the-format. This is a 40-50 line addition to `gatherSignals()`.

### Rewiring point 7 — Fix the platform-trends TikTok audio stub [MEDIUM]

**Problem:** `scrapeAudioAndHashtagTrends()` in `lib/marketing-brain/platform-trends.ts` uses `apify/rag-web-browser` on TikTok Creative Center, which cannot parse JavaScript-heavy SPAs. The SKILL.md documents the alternative (`clockworks/free-tiktok-scraper`) as a TODO.
**Fix:** Replace the actor for `AUDIO_HASHTAG_SOURCES` that target TikTok Creative Center with `clockworks/free-tiktok-scraper`. Test: `GET /api/cron/marketing-platform-trends?dryRun=true`. This unblocks audio-trend signals that currently never reach `generate-briefs`.

---

## 9. Where New Skills Must Be Referenced to Auto-Load

### For `video_production_skills/tool-mastery/SKILL.md`:
1. `marketing_brain_skills/producers/TEMPLATE.md` — Tier 3 block (line 112-116 area). Add it as a 5th bullet.
2. `automation_skills/content_engine/SKILL.md` — "Mandatory references" block (line 249-314). Add to the "Content-producer additional references" subsection.
3. `marketing_brain_skills/producers/REGISTRY.md` — Section G (Capabilities). Add a row.

### For `video_production_skills/viral-playbook/SKILL.md`:
1. `marketing_brain_skills/producers/TEMPLATE.md` — Tier 2 block (line 106-110 area). Add as a 5th bullet.
2. `automation_skills/content_engine/SKILL.md` — "Mandatory references" block. Add alongside VIRAL_GUARDRAILS.
3. `marketing_brain_skills/producers/REGISTRY.md` — Section G. Add a row.

---

## Summary: Is the Learn Loop Closed or Open?

**Partially closed — architecturally complete, operationally blocked.**

The loop IS wired: `measurement-loop → content_performance → performance-bias → rank_score multiplier → brief priority order`. The `getFormatPerformance()` function actively suppresses losers and boosts winners.

The loop is STARVED: Only 2 of 15 channel ingestors write data. Most of `content_performance` is likely empty. The bias multiplier is a no-op until real post performance data flows. Additionally, the TikTok audio trend signal is broken (JavaScript scrape stub), and trend data does not reach tool selection at produce-time.

**Top 3 rewiring points:**

1. **Wire all channel snapshot ingestors** (especially Meta/IG, TikTok, YouTube, LinkedIn) — this is the single highest-leverage action because it feeds every downstream feedback mechanism simultaneously.

2. **Build and load a tool-mastery skill** (`video_production_skills/tool-mastery/SKILL.md`) into TEMPLATE.md Tier 3 and content_engine mandatory references — closes the gap between "brain decided to make a TikTok reel" and "agent knows HOW to make a viral TikTok reel using the right model, hook, and audio."

3. **Build and load a viral-playbook skill** (`video_production_skills/viral-playbook/SKILL.md`) into TEMPLATE.md Tier 2 and content_engine mandatory references — gives every content producer the 2026 platform-specific patterns for hooks, pacing, and content angles that are actually driving organic growth right now.

**Exactly where the two new skills must be referenced:**

- Both skills: `marketing_brain_skills/producers/TEMPLATE.md` (appropriate tier block) + `automation_skills/content_engine/SKILL.md` (mandatory references block) + `marketing_brain_skills/producers/REGISTRY.md` (Section G).
- Tool-mastery: Tier 3 (video producers only).
- Viral-playbook: Tier 2 (all content producers).

Without adding them to BOTH TEMPLATE.md and content_engine/SKILL.md, the skills will only load when a producer explicitly references them — which most existing producers do not.
