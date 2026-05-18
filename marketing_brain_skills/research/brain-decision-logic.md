# Brain Decision Logic — Priority Score Reference
# Ryan Realty Autonomous Marketing Pipeline

**Document version:** 1.0 — 2026-05-17
**Owner:** marketing brain
**Authority:** Q3-2026-strategy.md §4; AUTONOMOUS_PIPELINE_BRIEF.md §3
**Referenced by:** generate-briefs/SKILL.md, run/SKILL.md, marketing_brain_actions table (column: priority_score)

---

## 1. The Scoring Function

Every candidate action the brain considers emitting receives a priority_score before it is written to `marketing_brain_actions`. The score determines which actions the brain emits in its weekly cycle and in what order they are surfaced to Matt.

```
priority_score = 0.50 × north_star_impact
              + 0.20 × brand_position_lift
              + 0.15 × channel_growth
              + 0.10 × site_or_ad_health
              + 0.05 × brand_equity
```

All five factors are normalized to the range [0.0, 1.0] before weighting. The result is a float in [0.0, 1.0]. Higher scores emit first.

**Emission threshold:** Any candidate with priority_score below 0.30 is not emitted. The brain may override this threshold during low-signal weeks (fewer than 3 candidates above 0.30) by dropping the floor to 0.20 and noting the override in the action row's `comments` JSONB field.

**Weekly cap:** The brain emits a maximum of 12 actions per week (configurable via `app_config` WHERE key='brain_weekly_cap'). When more than 12 candidates clear the threshold, the top 12 by priority_score are emitted and the rest are held in a pending candidate pool for the following week.

---

## 2. Factor Definitions, Inputs, and Scaling Rules

### Factor 1 — north_star_impact (weight 0.50)

**Definition:** How directly does this action move qualified seller leads per month (KPI NS-01)?

**Measurement:** Brain scores each action against a causal chain:

| Causal distance | Score range | Examples |
|-----------------|-------------|---------|
| Direct lead capture (action generates a lead form submission, a valuation completion, or a direct phone call from a seller prospect) | 0.80-1.00 | Meta seller lead-gen ad, home valuation landing page CTA, seller-intent blog post with embedded CTA |
| One step removed (action builds the seller audience that leads flow from) | 0.50-0.79 | Instagram seller-intent Reel, GBP review response optimized for "sell my home", email nurture sequence to equity-ready segment |
| Two steps removed (action builds brand recall that influences future lead consideration) | 0.25-0.49 | Neighborhood market report video, employer-adjacent content, area guide, "things to do" Reel |
| Background infrastructure (action fixes pipeline that makes leads possible but doesn't generate them) | 0.05-0.24 | Core Web Vitals fix, FUB tag hygiene, Resend domain verification, asset library registration |

**Input signal:** `predicted_north_star_impact` column written to `marketing_brain_actions` at emit time. Brain derives this from the action_type string and payload.target using a lookup table in generate-briefs/SKILL.md §6.

**Scaling rule:** The brain applies a recency multiplier when seller lead volume is below target. If NS-01 is more than 20% below monthly target, all actions with north_star_impact in the 0.50-0.79 range receive a +0.10 uplift (capped at 0.90).

---

### Factor 2 — brand_position_lift (weight 0.20)

**Definition:** How much does this action improve Ryan Realty's share of voice, reputation score, or branded search signal in Deschutes County?

**Measurement:** Brain scores against three sub-signals:

| Sub-signal | Score range | Examples |
|------------|-------------|---------|
| GBP review generation (action directly solicits or enables a new GBP review) | 0.70-1.00 | GBP review request sequence in FUB post-close, GBP review response that surfaces credibility |
| Branded search lift (action creates content indexed by Google with "Ryan Realty" + Bend keyword co-occurrence) | 0.40-0.69 | Blog post with brokerage byline, YouTube video with branded title, press mention |
| Share of voice (action reaches a Bend homeowner audience that competitive brands also reach) | 0.20-0.39 | Market data Reel distributed on IG/TikTok, neighborhood market report |

**Input signal:** Derived from action_type and target geography. Actions targeting Bend SFR homeowners score higher than actions targeting buyers or out-of-county audiences.

**Scaling rule:** During Q3 2026, GBP-related actions receive a +0.05 bonus because the GBP review count is below the target of 4.8 stars with 12 net new Q3 reviews (KPI BP-03, BP-04).

---

### Factor 3 — channel_growth (weight 0.15)

**Definition:** How much does this action improve the algorithmic reach and audience size of Ryan Realty's social channels?

**Measurement:** Brain scores by predicted platform signal value:

| Platform signal | Score range | Examples |
|-----------------|-------------|---------|
| High-signal format on a growth channel (Reels on IG, Shorts on YouTube, trending-audio TikTok) | 0.70-1.00 | 30-45 second market data Reel optimized for Reels algorithm, YouTube Short repurposed from long-form |
| Standard post on an established channel | 0.30-0.69 | Carousel post on IG, standard Facebook post, LinkedIn market update |
| Repurpose of existing asset to a new channel | 0.20-0.39 | Cross-posting a TikTok to Facebook Reels, embedding a YouTube video in a blog post |
| Platform infrastructure (OAuth fix, profile update, pinned post update) | 0.05-0.19 | Updating TikTok bio link, refreshing LinkedIn featured section |

**Input signal:** `assigned_producer` and `payload.channels` from the action row. Producers tagged as video_production generate higher channel_growth scores than static content producers.

**Scaling rule:** TikTok and YouTube Shorts receive a +0.10 bonus through Q3 2026 because both channels are below follower targets and the algorithm heavily rewards consistent new-creator cadence.

---

### Factor 4 — site_or_ad_health (weight 0.10)

**Definition:** How much does this action improve the technical performance of ryan-realty.com or the health of active paid campaigns?

**Measurement:** Brain scores by improvement type:

| Improvement type | Score range | Examples |
|------------------|-------------|---------|
| Conversion rate improvement on seller-intent pages | 0.70-1.00 | Valuation page CTA redesign, consultation form simplification, /sell page copy refresh |
| Core Web Vitals or PageSpeed improvement | 0.40-0.69 | LCP optimization, CLS fix, image compression, font loading fix |
| SEO infrastructure improvement | 0.30-0.49 | Schema markup addition, internal linking pass, sitemap update |
| Ad campaign optimization (creative refresh, audience update, bid adjustment) | 0.20-0.39 | New ad creative test, audience exclusion update, campaign budget reallocation |
| Hygiene fix (no direct performance lift but prevents degradation) | 0.05-0.19 | 404 fix, redirect audit, canonical tag fix |

**Input signal:** action_type prefix `site:` or `ops:meta_ads_*`. Content actions (`content:*`) default to site_or_ad_health = 0.10 unless the payload includes a `landing_page_cta` field, in which case they score 0.35.

**Scaling rule:** No bonus multipliers for this factor. Score is taken at face value from the action_type lookup.

---

### Factor 5 — brand_equity (weight 0.05)

**Definition:** How much does this action build long-term brand recognition, trust, and differentiation for Ryan Realty in Deschutes County — separate from short-term lead or follower metrics?

**Measurement:** Brain scores by brand equity mechanism:

| Mechanism | Score range | Examples |
|-----------|-------------|---------|
| Original primary-source research or data analysis (content only Ryan Realty can produce because it requires MLS access) | 0.70-1.00 | Monthly market report with verified Supabase data, neighborhood price trend analysis, annual Bend market year-in-review |
| Authentic local story (content tied to a specific Bend place, event, employer, or community moment) | 0.40-0.69 | Employer spotlight (St. Charles, BASX, OSU-Cascades), event coverage (Pole Pedal Paddle, Bend Brewfest), neighborhood character profile |
| Evergreen reference content (content that will remain accurate and useful for 12+ months) | 0.20-0.39 | ADU guide, wildfire insurance explainer, water rights overview, first-time buyer checklist |
| Standard content execution (content that competes on format but not uniqueness) | 0.05-0.19 | Generic "tips for sellers" Reel, national market news repurpose, lifestyle-only content without local grounding |

**Input signal:** `payload.content_angle` or `payload.data_source` fields. Actions with `data_source='supabase_listings'` score 0.70+. Actions with `content_angle='lifestyle_generic'` score below 0.20.

**Scaling rule:** No bonus multipliers. This factor is intentionally low-weighted (0.05) because brand equity is a lagging indicator — the brain should not deprioritize seller lead actions to build brand equity.

---

## 3. Worked Examples

The following 10 examples show real candidate actions the brain might evaluate, scored factor by factor, with the final priority_score computed and the strategy doc section each action ladders to.

---

### Example 1 — Meta Seller Lead-Gen Ad (New Campaign Launch)

**Candidate action:**
- action_type: `ops:meta_ads_activate`
- target: `campaign:seller_lead_gen_bend_sfr`
- payload: { budget_daily: 150, audience: 'bend_homeowner_equity_ready', form_type: 'seller_valuation' }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.90 | Direct lead capture: seller valuation form routes to FUB Stage 2, with 30% qualifying to Stage 3. Closest possible causal distance to NS-01. |
| brand_position_lift | 0.30 | Paid ads reach homeowners but do not generate indexed content or GBP signals. |
| channel_growth | 0.15 | Meta ads can grow a retargeting audience (KPI AH-10) but do not grow organic followers. |
| site_or_ad_health | 0.80 | Directly activates the paid acquisition channel. Score reflects the high impact of going from 0 active campaigns to 1. |
| brand_equity | 0.10 | Paid ads do not compound as brand equity assets. |

**Computation:**
```
priority_score = 0.50(0.90) + 0.20(0.30) + 0.15(0.15) + 0.10(0.80) + 0.05(0.10)
              = 0.450 + 0.060 + 0.023 + 0.080 + 0.005
              = 0.618
```

**priority_score: 0.618**

**Strategy doc section:** §12 (Paid acquisition), §19 (Q3 prerequisites — Meta campaign activation)
**Verdict:** Emits above threshold. Requires Matt explicit approval per ops: category governance.

---

### Example 2 — Bend SFR Monthly Market Report Video (July 2026)

**Candidate action:**
- action_type: `content:market_data_video`
- target: `city:Bend`
- payload: { month: '2026-07', data_source: 'supabase_listings', channels: ['instagram', 'tiktok', 'youtube_shorts'] }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.55 | One step removed: seller-intent viewers who see a market report are the Persona B (equity-ready homeowner) audience. Does not capture leads directly but primes the seller funnel stage 2 (aware of market conditions). Receives no recency uplift assuming NS-01 is near target. |
| brand_position_lift | 0.55 | Branded content with original MLS data indexed by YouTube and embedded in blog post raises branded search co-occurrence. GBP bonus (+0.05) applies because this is a Bend-specific piece. Final: 0.55 + 0.05 = 0.60 (cap at 1.0). |
| channel_growth | 0.80 | High-signal format (Reel + Short) on three growth channels simultaneously. TikTok/YouTube Shorts bonus (+0.10) applies. |
| site_or_ad_health | 0.10 | If content embeds in a blog post (§11), site_or_ad_health gets a landing page CTA bump to 0.35. Without blog embed, stays at 0.10. |
| brand_equity | 0.80 | Original primary-source research with verified Supabase data. Ryan Realty is the only Bend brokerage with MLS-verified monthly video reports. |

**Computation (without blog embed):**
```
priority_score = 0.50(0.55) + 0.20(0.60) + 0.15(0.80) + 0.10(0.10) + 0.05(0.80)
              = 0.275 + 0.120 + 0.120 + 0.010 + 0.040
              = 0.565
```

**priority_score: 0.565**

**Strategy doc section:** §9 (Content strategy, flagship tier), §11 (SEO, blog post supporting market report), §22 (Content loop compounding)
**Verdict:** Emits. High-value flagship content. Routes through content_engine to market-data-video producer.

---

### Example 3 — St. Charles Employer Spotlight (July 2026)

**Candidate action:**
- action_type: `content:blog_post`
- target: `employer:st_charles`
- payload: { angle: 'st_charles_employee_relocation_bend_homes', word_count: 1800, seller_cta: 'home_valuation' }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.45 | Two steps removed: employees relocating to Bend are buyers, not sellers. However, existing St. Charles employees who own Bend homes and are transferring to another facility are Persona B. CTA is a seller valuation, which improves the direct capture score slightly above the two-step baseline. |
| brand_position_lift | 0.50 | Blog post with "Ryan Realty" + "Bend" + "St. Charles" keyword co-occurrence builds branded search signals. GBP bonus (+0.05) does not apply (this is a blog action, not a GBP action). |
| channel_growth | 0.30 | Blog post is cross-posted to LinkedIn (CG-LI metric) and Facebook. Standard post format. No YouTube or TikTok reach. |
| site_or_ad_health | 0.35 | Blog post embeds seller valuation CTA. site_or_ad_health gets the landing page CTA bump from 0.10 to 0.35. |
| brand_equity | 0.65 | Authentic local story tied to the Bend employer ecosystem. This content is uniquely producible by a Bend brokerage with MLS data. Evergreen for 18-24 months. |

**Computation:**
```
priority_score = 0.50(0.45) + 0.20(0.50) + 0.15(0.30) + 0.10(0.35) + 0.05(0.65)
              = 0.225 + 0.100 + 0.045 + 0.035 + 0.033
              = 0.438
```

**priority_score: 0.438**

**Strategy doc section:** §25 (Employer-adjacent content, St. Charles July)
**Verdict:** Emits. Elevated tier content. Routes to blog-post producer.

---

### Example 4 — GBP Review Response (Post-Close Outreach)

**Candidate action:**
- action_type: `comms:gbp_review_response`
- target: `review:gbp_recent_3`
- payload: { tone: 'warm_genuine', include_local_reference: true }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.15 | Background infrastructure: GBP reviews improve discovery by local sellers searching "real estate agent Bend Oregon" on Google Maps, but the causal chain is long. |
| brand_position_lift | 0.80 | Direct GBP reputation action. GBP bonus (+0.05) applies, but score is already near ceiling. Stays at 0.80. |
| channel_growth | 0.10 | GBP is not a follower-growth channel in the social sense. |
| site_or_ad_health | 0.05 | Hygiene action for brand reputation, not site performance. |
| brand_equity | 0.50 | GBP reviews with authentic broker responses build trust signals visible to any homeowner researching Ryan Realty. Evergreen for the life of the review. |

**Computation:**
```
priority_score = 0.50(0.15) + 0.20(0.80) + 0.15(0.10) + 0.10(0.05) + 0.05(0.50)
              = 0.075 + 0.160 + 0.015 + 0.005 + 0.025
              = 0.280
```

**priority_score: 0.280**

**Strategy doc section:** §10 (Channel plans, GBP), §14 (Brand positioning)
**Verdict:** Below standard threshold of 0.30. Emits only if low-signal week (floor drops to 0.20). In a full week, this action waits for a week with capacity. Note: `comms:` actions bypass Matt approval per governance table.

---

### Example 5 — Resend Domain Verification (Infrastructure)

**Candidate action:**
- action_type: `ops:resend_domain_verify`
- target: `domain:mail.ryan-realty.com`
- payload: { blocker_for: ['email_nurture', 'post_close_sequence'], priority_flag: true }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.20 | Infrastructure that unblocks email nurture sequences. Once Resend is verified, the three-email equity-ready seller sequence (§13) can run, which has direct north_star_impact of 0.60. Without verification, those sequences cannot fire at all. The brain credits the enabling action at one tier below the actions it unblocks. |
| brand_position_lift | 0.05 | No direct brand signal. |
| channel_growth | 0.05 | Email is a conversion channel, not a follower-growth channel. |
| site_or_ad_health | 0.70 | Directly unblocks a major pipeline channel. Scored as a high-impact site/ad health improvement because email deliverability is treated as an ad health signal. |
| brand_equity | 0.05 | Technical infrastructure with no brand equity effect. |

**Computation:**
```
priority_score = 0.50(0.20) + 0.20(0.05) + 0.15(0.05) + 0.10(0.70) + 0.05(0.05)
              = 0.100 + 0.010 + 0.008 + 0.070 + 0.003
              = 0.191
```

**priority_score: 0.191**

**Strategy doc section:** §19 (Q3 prerequisites), §13 (Email and CRM nurture)
**Verdict:** Below 0.30 threshold in isolation. However, because `payload.priority_flag: true` is set (unblocks multiple downstream actions), the brain's generate-briefs logic applies a blocker_multiplier of 1.5 to any action marked as unblocking 2 or more other actions. Adjusted score: 0.191 x 1.5 = 0.287. Still below 0.30. Emits only on a low-signal week OR when Matt explicitly requests the infrastructure sprint.

---

### Example 6 — Sunriver Listing Tour Video (Out-of-Primary-Market)

**Candidate action:**
- action_type: `content:listing_reel`
- target: `mls:220198445`
- payload: { address: '17955 Raven Rd, Sunriver', list_price: 895000, channels: ['instagram', 'facebook'] }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.30 | The listing itself is a seller lead converted (it is already listed). The reel's secondary value is to attract other Sunriver owners who may be considering selling. Sunriver is in the geographic expansion tier (Ansoff 10% product development bucket), so the north_star_impact for out-of-primary-market actions is capped at 0.40. Score: 0.30. |
| brand_position_lift | 0.40 | Expands Ryan Realty's visible footprint into Sunriver. Content is branded per listing video rules. |
| channel_growth | 0.65 | Listing videos are high-engagement on IG Reels and Facebook. Listing content typically outperforms market data content on saves and shares from buyers in active search. |
| site_or_ad_health | 0.10 | No blog embed or landing page CTA in this action. Standard content score. |
| brand_equity | 0.35 | Authentic local listing with verified price data. Not as equity-building as original market research, but more so than lifestyle-generic content. |

**Computation:**
```
priority_score = 0.50(0.30) + 0.20(0.40) + 0.15(0.65) + 0.10(0.10) + 0.05(0.35)
              = 0.150 + 0.080 + 0.098 + 0.010 + 0.018
              = 0.356
```

**priority_score: 0.356**

**Strategy doc section:** §9 (Content, listing video), §23 (Geographic expansion, Sunriver)
**Verdict:** Emits above threshold. Routes to listing-tour-video producer via content_engine. Draft requires Matt approval per content: governance.

---

### Example 7 — Bend ADU Regulatory Guide (Evergreen Blog + Video)

**Candidate action:**
- action_type: `content:blog_post`
- target: `topic:bend_adu_guide_2026`
- payload: { word_count: 2200, data_source: 'city_of_bend_adu_ordinance', cta: 'seller_valuation', format: ['blog', 'instagram_carousel', 'tiktok'] }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.50 | One step removed: homeowners reading an ADU guide are considering whether their property's value has increased enough to sell. CTA is seller valuation. Blog post indexed for "Bend ADU rules 2026" captures sellers in research phase (Schwartz stage 3: problem-aware). |
| brand_position_lift | 0.55 | Original regulatory research. "Ryan Realty" + "ADU" + "Bend" indexed content builds branded search signals for a high-value local topic. GBP bonus (+0.05) does not apply (blog action). Score: 0.55. |
| channel_growth | 0.55 | Multi-format dispatch: blog drives SEO, carousel drives IG saves, TikTok targets homeowners researching ADU conversions. Receives TikTok bonus (+0.10). Final: 0.55. |
| site_or_ad_health | 0.35 | Blog post embeds seller valuation CTA. Gets landing page CTA bump from 0.10 to 0.35. |
| brand_equity | 0.70 | Evergreen regulatory content that Ryan Realty can uniquely contextualize with MLS price data. Remains accurate for 12+ months (ADU ordinance effective June 2025, next review 2027). |

**Computation:**
```
priority_score = 0.50(0.50) + 0.20(0.55) + 0.15(0.55) + 0.10(0.35) + 0.05(0.70)
              = 0.250 + 0.110 + 0.083 + 0.035 + 0.035
              = 0.513
```

**priority_score: 0.513**

**Strategy doc section:** §24 (ADU and regulatory content), §11 (SEO, blog post 3 of 6)
**Verdict:** Emits above threshold. Flagship tier content. Routes through content_engine to blog-post producer + listing-tour-video for carousel and TikTok cut.

---

### Example 8 — FUB Tag Hygiene Audit

**Candidate action:**
- action_type: `ops:fub_tag_audit`
- target: `fub:all_contacts`
- payload: { check: ['missing_stage', 'missing_source', 'stale_active_leads'], report_to: 'matt' }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.08 | Background infrastructure. Directly improves lead routing accuracy (stale leads re-engaged, unclassified leads triaged) but does not generate new leads. Score reflects the one-time value of cleaning up the pipeline. |
| brand_position_lift | 0.05 | No brand signal. Internal operation. |
| channel_growth | 0.05 | No channel signal. |
| site_or_ad_health | 0.20 | FUB hygiene improves the accuracy of lead attribution, which indirectly improves ad optimization (Meta lookalike audiences built from FUB qualified leads are cleaner). Scores as a hygiene-level site/ad health action. |
| brand_equity | 0.05 | Internal data quality action with no audience-facing brand signal. |

**Computation:**
```
priority_score = 0.50(0.08) + 0.20(0.05) + 0.15(0.05) + 0.10(0.20) + 0.05(0.05)
              = 0.040 + 0.010 + 0.008 + 0.020 + 0.003
              = 0.081
```

**priority_score: 0.081**

**Strategy doc section:** §15 (Autonomous pipeline, operational hygiene), Layer 6 KPIs (OH-FUB-01 through OH-FUB-04)
**Verdict:** Below threshold in isolation. The brain emits this action as a scheduled monthly hygiene pass (first Monday of each month) regardless of score, flagged in `comments` as `{"reason":"scheduled_hygiene","bypass_threshold":true}`.

---

### Example 9 — NW Crossing Neighborhood Market Report (Neighborhood Scope)

**Candidate action:**
- action_type: `content:neighborhood_overview`
- target: `neighborhood:NW_Crossing`
- payload: { data_source: 'supabase_market_stats_cache', month: '2026-08', channels: ['instagram', 'youtube_shorts', 'tiktok'], include_blog: true }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.60 | NW Crossing has a $900K-$1.3M price range (bend-market-bible.md). Homeowners in this range have high equity and are primary Persona B targets (equity-ready, 38-60). Neighborhood-specific market data directly addresses the question "what is my home worth right now" — the highest seller-intent signal short of a valuation completion. Score: 0.60. |
| brand_position_lift | 0.60 | Neighborhood-specific content with Ryan Realty branding establishes expertise signal for "NW Crossing real estate" queries. GBP bonus (+0.05) applies. Final: 0.65 (cap at 1.0). |
| channel_growth | 0.80 | Three-channel dispatch including YouTube Shorts and TikTok with bonus (+0.10). Blog inclusion adds SEO channel. |
| site_or_ad_health | 0.35 | Blog post embeds seller valuation CTA. Gets landing page CTA bump to 0.35. |
| brand_equity | 0.80 | Original neighborhood-level MLS data. Ryan Realty is likely the only Bend brokerage producing monthly neighborhood-specific video market reports at this cadence. |

**Computation:**
```
priority_score = 0.50(0.60) + 0.20(0.65) + 0.15(0.80) + 0.10(0.35) + 0.05(0.80)
              = 0.300 + 0.130 + 0.120 + 0.035 + 0.040
              = 0.625
```

**priority_score: 0.625**

**Strategy doc section:** §9 (Content, flagship tier), §23 (Geographic focus, NW Crossing), §11 (SEO, blog post 4 of 6)
**Verdict:** Emits. Highest-scoring of the worked examples outside of direct lead capture. Routes through content_engine to neighborhood-overview producer.

---

### Example 10 — Lifestyle "Things to Do in Bend" Reel (Evergreen Awareness)

**Candidate action:**
- action_type: `content:lifestyle_reel`
- target: `topic:bend_summer_activities`
- payload: { format: 'reels_30s', channels: ['instagram', 'tiktok'], data_source: 'none', seller_cta: false }

**Score breakdown:**

| Factor | Score | Reasoning |
|--------|-------|-----------|
| north_star_impact | 0.15 | Two steps removed from seller leads. Lifestyle content without a seller CTA builds top-of-funnel awareness with people who may not be considering selling. Very long causal chain. |
| brand_position_lift | 0.25 | Ryan Realty brand visible in lifestyle content builds association with the Bend experience. Not a search-indexed asset. GBP bonus does not apply. |
| channel_growth | 0.70 | Lifestyle content on IG and TikTok can achieve high organic reach from non-follower discovery feeds. TikTok bonus (+0.10) applies. |
| site_or_ad_health | 0.05 | No site or ad health impact. |
| brand_equity | 0.15 | Standard lifestyle content. Competing brokerages can produce identical content. No primary-source research. |

**Computation:**
```
priority_score = 0.50(0.15) + 0.20(0.25) + 0.15(0.70) + 0.10(0.05) + 0.05(0.15)
              = 0.075 + 0.050 + 0.105 + 0.005 + 0.008
              = 0.243
```

**priority_score: 0.243**

**Strategy doc section:** §9 (Content, everyday tier), §10 (Channel plans, Instagram)
**Verdict:** Below standard threshold (0.30). Below low-signal-week threshold (0.20 if brain lowers floor). This action type does not emit autonomously unless Matt explicitly requests it, or unless channel_growth metrics are critically below target (TikTok or IG followers more than 30% below Q3 pace). At that point, the brain may emit 1 lifestyle reel per week as a channel-priming action, flagged in `comments` as `{"reason":"channel_growth_deficit"}`.

---

## 4. Score Distribution Reference

| Score range | Interpretation | Weekly emission likelihood |
|-------------|---------------|--------------------------|
| 0.65-1.00 | Highest priority — direct seller lead pipeline or flagship market data | Always emits |
| 0.50-0.64 | High priority — strong multi-factor content | Emits when weekly cap allows |
| 0.35-0.49 | Medium priority — one-step-removed seller audience builder | Emits unless week is at cap |
| 0.30-0.34 | Low priority — background audience or brand building | Emits only if below cap |
| 0.20-0.29 | Below standard threshold | Emits only on low-signal weeks |
| Under 0.20 | Scheduled hygiene or blocked by prerequisites | Emits only on schedule or Matt request |

---

## 5. How the Brain Uses This Document

The `generate-briefs` skill loads this document before computing priority_score for any candidate. The produce skill loads it when asked to emit a single action directly.

The brain writes `priority_score`, `predicted_north_star_impact`, and `strategy_doc_section` to `marketing_brain_actions` at emit time, using the factor scores computed here. Matt can audit any action row to see why it scored as it did by reading the `comments` JSONB field, which the brain populates with the raw factor breakdown:

```json
{
  "priority_score_breakdown": {
    "north_star_impact": 0.55,
    "brand_position_lift": 0.60,
    "channel_growth": 0.80,
    "site_or_ad_health": 0.10,
    "brand_equity": 0.80,
    "computed_score": 0.565,
    "bonuses_applied": ["tiktok_channel_growth_bonus"],
    "threshold_used": 0.30
  }
}
```
