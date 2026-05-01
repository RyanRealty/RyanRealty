---
name: youtube-market-reports
description: >
  Produces YouTube market report videos for Ryan Realty's faceless data-driven
  channel. Use this skill for ANY task involving: "market report", "market
  report video", "YouTube video", "video", "monthly market update", "market
  data", "Bend market data", "real estate video", "create a video", "render a
  video", "script a video", "market data video", "faceless video", "data
  visualization video", "Central Oregon market report", "Bend housing update",
  "record a market update", "video pipeline", "video automation", "YouTube
  upload", "market report render", "monthly video", "Bend real estate YouTube",
  "video storyboard", "loan", "housing data", "market analysis video",
  "data-driven content", "Bend market", "market update", "housing market",
  "market trends", "inventory video", "price trends video", or any request to
  produce, script, render, query data for, or publish a video containing
  Central Oregon real estate market statistics. Also triggers on requests to
  query Supabase for video data, generate VO scripts for market content, build
  Remotion compositions for market data, create YouTube thumbnails, or find
  compelling data stories for video content. When in the YouTube project
  context, any mention of "video" or "data" should trigger this skill.
  NOT for listing-specific videos (use listing-tour-video or listing_reveal),
  news clips (use news-video), neighborhood flyovers (use neighborhood-overview),
  or short-form social cuts under 60 seconds (use market-data-video).
---

# YouTube Market Report Video — Production Skill

**Scope:** End-to-end production of 8-10 minute monthly market report videos for YouTube. Covers data pull, QA gate, script generation, VO render, AI B-roll, Remotion compositing, thumbnail generation, and YouTube upload.

**Status:** Active. Last verified 2026-04-30.

**Format:** Faceless data-driven. No on-camera presenter. Victoria VO + animated data visualizations + AI B-roll + Google 3D Tiles aerials. Hybrid of Reventure Consulting's narrative structure, ClearValue Tax's calm analytical tone, and "Remarkable Housing Inventory Trends" animated data viz quality.

**Channel positioning:** Bend/Central Oregon has ZERO faceless data-driven RE YouTube channels. Largest existing local channel has under 600 subscribers. First-mover advantage is massive. Lead generation (not ad revenue) is the business model. One closed deal at median Bend price (~$687K) x 2.5% = $17,175 commission, paying for years of production at ~$2.60/video.

---

## How to Use This Skill

When triggered, ask the user for two inputs:

1. **Geographic area** — a subdivision, city, zip code, or neighborhood (e.g., "Bend", "97702", "NW Crossing", "Redmond")
2. **Time frame** — month, quarter, YTD, trailing period (e.g., "April 2026", "Q1 2026", "last 6 months", "YTD 2026")

If either is missing, ask before proceeding. Then:

1. Pull data using the query templates in `query-rules.md`, scoped to the area and time frame
2. Run QA gate (Spark API cross-check, outlier detection, record count verification)
3. Select the most compelling data stories from `data-stories.md` based on what the data actually shows — let the data pick the stories, not a template
4. Generate the storyboard from `storyboard-template.md`, slotting in the strongest stories
5. Script the voiceover with actual verified data filling every `{{variable}}`
6. Render using the pipeline in `pipeline.md`
7. Present draft to Matt for approval before any commit, push, or upload

Everything else — which queries to run, which tools to use, how to render, what the video looks like — comes from this skill and its sub-files. The user provides area + time frame. The skill provides everything else.

**For 30+ ready-to-use data story segments with exact queries, read `data-stories.md`.** This is the skill's most valuable resource — it turns raw data into stories no competitor can tell.

---

## 1. Data Hard Rules (NON-NEGOTIABLE)

Every number in a video traces to a verified primary source. Matt is a licensed principal broker. Publishing inaccurate data is a compliance risk. Read `query-rules.md` for complete SQL templates and examples.

### Critical rules (memorize these):

**Days to Pending (DOM):** Always use the pre-computed `days_to_pending` column for closed and pending listings — this matches Beacon Appraisal's published methodology and avoids the historical OnMarketDate / DaysOnMarket data-quality issues. For active listings without a pending timestamp, compute days active live: `EXTRACT(DAY FROM now() - "OnMarketDate")::int` and label as "days active" not "DOM".

**Medians only:** Use `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")` for all price metrics. Never use `AVG()` and label it median.

**Property type filter:** `property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'` for residential. Always `"TotalLivingAreaSqFt" > 0` for price/sqft. Always `"ClosePrice" IS NOT NULL` for closed sales.

**Residential ClosePrice floor (UF1):** `AND "ClosePrice" >= 10000` on every closed-sales aggregation. The raw table has 1,640 records under $10K (lowest = $0.09) — land transfers, parcel splits, data-entry artifacts, family transfers. `> 0` is not enough; use `>= 10000`. Same on `"ListPrice"` / `"OriginalListPrice"` for list-side queries.

**Sale-to-list bounds (UF2):** `AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5` (or the same on `sale_to_list_ratio`) on every ratio aggregation. 967 rows produce ratios outside that range; 272 produce ratios up to 99.9× from artifact list prices under $10. Apply in WHERE, not in `FILTER (WHERE …)`.

**Sale-to-list:** Use `sale_to_final_list_ratio` for "% of asking" (industry standard, vs final list price). `sale_to_list_ratio` compares to `OriginalListPrice`. Both store as decimals (0.9659 = 96.59%).

**Timezone:** `CloseDate` stored as midnight UTC = 4pm Pacific previous day. Use `("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date` for all date filters.

**Months of supply (UF3 + C3) — SHIP-BLOCKER:** Compute manually with SFR filter on BOTH the active CTE AND the closed CTE: `active_count / (closed_last_N_days / N * 30)`. Both CTEs MUST filter `property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'`. Thresholds: ≤ 4 seller's market, 4–6 balanced, ≥ 6 buyer's market — verdict pill on screen MUST match the manual number. **Never read `market_pulse_live.months_of_supply` into a video, caption, gauge, or VO line** — that view mixes all `PropertyType='A'` sub-types and produces a 38% delta vs the SFR-only manual computation (Bend stored 5.80 vs SFR-only 4.20, measured 2026-04-30). At that snapshot both values land in the Balanced band, but a 38% gap is large enough to cross the 4.0 / 6.0 verdict thresholds against the next month's data. Use `query-rules.md` Template 11 verbatim.

**Geography:** Bend zips 97701, 97702, 97703, 97708. Use `"City" = 'Bend'` OR zip filter, not both.

**Price change formats:** `listing_history.price_change` = decimal fraction (-0.04 = 4% drop). `listings.largest_price_drop_pct` = already percentage (-5.60). Never confuse.

**Buyer financing:** Has 3 incompatible formats including `[object Object]` rows. Always clean with `::text ILIKE '%Cash%'` pattern.

**PITI:** Hardcoded 6.5% rate, 20% down, 30yr. OK for relative comparisons only. Compute with current rate for absolute payment claims.

**CumulativeDaysOnMarket:** 99.9% empty. Never use.

### QA Gate (pre-render, hard abort)

Cross-check every figure against Spark API (`SPARK_API_BASE_URL` + `SPARK_API_KEY`). Delta >1% on any metric = ABORT render. Surface the conflict to Matt with both values, queries, and delta. Write findings to `out/<deliverable>/citations.json`. No citations file = no ship.

---

## 2. Data Advantages

Ryan Realty's Supabase has data no generic market report can access. Use these to differentiate:

- **821 raw RESO MLS fields** per listing in `details` JSONB (most agents see 20-30). Read `data-dictionary.md` for the complete field catalog across 17 categories.
- **345K price history records** in `listing_history` with every price change, status change, back-on-market event. Enables price drop velocity analysis, overpriced listing stories.
- **Concessions data:** 39.7% coverage in Bend. Median $9,932. Ranges from $9,242 (under $400K) to $16,747 ($1.5M+). No generic report has this.
- **871-subdivision granularity** in Bend (99.5% coverage). Petrosa $790K median, NW Crossing $1.075M, Broken Top $1.5M, Tetherow $1.795M at $679/sqft.
- **Buyer financing distributions:** ~6,100 Conventional, ~5,000 Cash, ~1,500 FHA, ~920 VA, ~312 Seller Financing (since 2025). Cash buyer share is a leading indicator.
- **New construction vs resale:** 466 new builds vs 1,985 resale. Days-to-pending and price gaps available — re-verify with `days_to_pending` before quoting in any video.
- **Sale-to-list by price band:** $600K-$750K closest to asking (99.18%), $1.5M+ farthest (96.74%).
- **Full status lifecycle:** Pending fallthrough rates, back-on-market rates (117,335 BOM events in listing_history).
- **Walk scores, school assignments, architectural style, green energy features, community features** all queryable from JSONB.
- **Historical depth back to 1907.** 375K+ closed sales for cycle analysis.

---

## 3. Storyboard Structure

Read `storyboard-template.md` for the complete scene-by-scene breakdown with durations, visual types, data sources (specific Supabase queries), VO templates with `{{variables}}`, and tool assignments per scene.

### Summary (8+1 scenes, ~9 minutes):

| Scene | Duration | Content | Visual |
|-------|----------|---------|--------|
| 0: Hook | 0:30 | Animated stat reveal, anchor metric | CountUp + Google Earth zoom-in |
| 1: Title | 0:15 | Brand card, episode ID, mini-agenda | `<TitleCard>` + brand sting |
| 2: Median Price | 1:30 | 12-24mo line chart, YoY comparison | `<AnimatedLineChart>` + AI B-roll underlayer |
| 3: Price/SqFt | 1:00 | Grouped bars by property type, YoY | `<GroupedBarChart>` |
| 4: Inventory | 1:45 | Stacked area + MoS gauge | `<StackedAreaChart>` + `<MarketGauge>` + B-roll intercut |
| 5: Days to Pending | 1:00 | Bars by price band + absorption rate | `<SplitMetricPanel>` |
| 6: Neighborhoods | 1:30 | ZIP map + leaderboard | Google 3D Tiles + `<BendZipMap>` + `<AnimatedLeaderboard>` |
| 7: Takeaways | 1:00 | Buyer/seller panels | `<TakeawayPanel>` + depth-parallax background |
| 8: CTA | 0:30 | Subscribe + contact + end screen | `<OutroCard>` + brand sting |

### Swap-in modules (rotate for variety):
- Price Band Distribution (replaces Scene 3)
- New Listings Velocity (replaces Scene 5)
- Sale-to-List Ratio Deep Dive (replaces Scene 3)
- Regional Comparison bar chart race: Bend/Redmond/Sisters/La Pine (replaces Scene 6)
- Back-on-Market and Price Reductions (insert between Scenes 4-5)

---

## 4. Tool Inventory

Read `tool-inventory.md` for the complete inventory with model IDs, costs, status, and exact use cases per scene.

### Key tools:

**Remotion 4.0** (primary render engine): 17 compositions in `listing_video_v4/`, 6 reusable transitions (CrossfadeTransition, WhipPanTransition, LightLeakTransition, PushTransition, SlideTransition, DepthParallaxBeat), 9 Recharts chart components, brand tokens/fonts ready. 24 shipped MP4s in v5 library.

**Replicate AI video** (cinematic B-roll):
- Kling v2.1/3.0 — primary for lifestyle/neighborhood shots, 4K, $0.07-1.40/5s
- Seedance 1 Pro — cheapest cinematic at $0.10/sec, fastest
- Hailuo 02 — human motion, walk-and-talks at $0.27/sec
- Wan 2.5 i2v — best start-frame fidelity for image-to-video at $0.20/sec
- Veo 3/3 Fast — text-to-video with native audio at $1.25-2.50/5s
- Luma Ray 2 — cinematic camera for luxury at $0.40/sec

**ElevenLabs** (Victoria voice, LOCKED):
- Voice ID: `qSeXEcewz7tA0Q0qk9fH`, model `eleven_turbo_v2_5`
- Settings: stability 0.50, similarity 0.75, style 0.35, speaker_boost true
- ~99K chars headroom, 161 existing VO files
- Forced alignment API (`/v1/forced-alignment`) MANDATORY for caption sync. `lib/voice/alignment.ts` helper NOT YET BUILT (blocker).

**Google 3D Tiles** (aerial flyovers): `cascade-peaks` project with Three.js + R3F configured, `REMOTION_GOOGLE_MAPS_KEY` available. Free tier covers ~2,500 root tile loads/month.

**Grok Imagine** (thumbnails): 4 variants per video, A/B test via epsilon-greedy pipeline. `XAI_API_KEY` active.

**Spark API** (cross-check): Hard pre-render gate. `SPARK_API_KEY` and `SPARK_API_BASE_URL` verified active.

**YouTube Data API v3**: Enabled at project level, upload code not yet in production.

---

## 5. Pipeline Architecture

Read `pipeline.md` for the complete end-to-end flow with dependency graph, Inngest function structure, parallelization strategy, cost breakdown, and error handling.

### Summary (10 phases):

1. **Data pull** — 7 parallel Supabase queries following hard rules (Section 1)
2. **QA gate** — Spark API cross-check, hard abort if >1% delta on any metric
3. **Script generation** — Claude API with anti-slop rules, `{{variable}}` templating
4. **HUMAN REVIEW** — Matt approves script before any rendering begins
5. **VO render** — ElevenLabs Victoria + forced alignment for word-level timestamps
6. **AI B-roll** — Kling/Seedance/Hailuo via Replicate (parallel with VO)
7. **Stock/maps** — Unsplash, Google 3D Tiles, Google Maps (parallel with VO)
8. **Remotion compositing** — All assets assembled, captions synced to alignment
9. **Quality gate + scorecard** — ffprobe checks, banned-word grep, viral scorecard
10. **YouTube upload** — Data API v3, metadata, thumbnail, Shorts extraction

**Per-video cost:** ~$2.60 with AI B-roll, ~$0.60 minimal. Render time: 3-6 minutes.

**Inngest orchestration:** `market-report/generate` function triggered by existing Vercel cron `/api/cron/market-report` (Saturday 2pm). Named steps with `waitForEvent("script-approved")` for human review checkpoint.

---

## 6. YouTube Strategy

### Positioning
- Model: Reventure Consulting "data insider" format (627K subs, 174M views) adapted for hyperlocal
- Data viz gold standard: "Remarkable Housing Inventory Trends" animated bar chart races (800 US metros)
- Tonal model: ClearValue Tax (2.87M subs, fully faceless, calm analytical screen recordings)
- 8-12 minute sweet spot for monthly reports
- Monthly cadence minimum, weekly ideal
- Faceless: Victoria VO + animated data viz + AI B-roll
- Lead gen is the business model (ad revenue irrelevant at 110K population scale)
- RE YouTube CPM: $12-30; educational data viz: $15-22 CPM
- Proven ROI: Karin Carr generated $100K+ GCI from a single video. Will Sawyer built $1M+ annual income from YouTube in an 80K-population city. Ken Pozek closed $20M+ from YouTube leads.
- Best posting time: Sunday 10am PT. Best days: Sunday, Tuesday, Monday.

### SEO
- Title formula: `[Data Point] + [Geographic Scope] + [Time Period]`
- Example: "Bend Oregon Housing: Median Price Hits $725K | April 2026 Market Data"
- Under 60 characters. Geographic keyword + topical keyword + reason to click.
- Hashtags: #BendOregonRealEstate #CentralOregonHomes #BendHousingMarket #OregonRealEstate #BendOregon
- Descriptions: first 200 chars contain primary keyword, timestamps in body

### Content pillars (rotate):
1. Market Data and Updates (2x/month) — this skill
2. Neighborhood/Area Guides (2x/month) — use neighborhood_tour skill
3. Buyer/Seller Education (2x/month)
4. Cost of Living Comparisons (1-2x/month)
5. Investment/Data Analysis (1-2x/month)

### Retention targets
- Month 1: 200-500 views, 30+ subs, >40% retention
- Month 3: 1,000-3,000 views/video, 100-300 subs, first inbound lead
- Month 6: 3,000-10,000 views/video, 500-1,000 subs, 2-5 leads/month
- Month 12: 10,000+ views/video, 2,000-5,000 subs, 5-10 leads/month

### Shorts extraction (auto-generate from same render):
- Scene 0 hook as 30s Short
- Scene 6 neighborhood breakdown as 60s Short
- Scene 2 price trend as 45s Short

---

## 7. Data Integrity Validation

Run these checks BEFORE using any field in a video. Failures do not block the render but must be documented and the affected metric excluded or footnoted.

```sql
-- Null rate check for key video fields
SELECT
  COUNT(*) AS total,
  COUNT("ClosePrice") AS has_close_price,
  COUNT("CloseDate") AS has_close_date,
  COUNT("OnMarketDate") AS has_on_market,
  COUNT("TotalLivingAreaSqFt") AS has_sqft,
  COUNT("SubdivisionName") AS has_subdivision,
  COUNT(concessions_amount) AS has_concessions,
  COUNT(buyer_financing) AS has_financing,
  COUNT(walk_score) AS has_walk_score
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND "City" = 'Bend';

-- Outlier detection (spot-check before render)
SELECT "ListingKey", "ClosePrice", "ListPrice", "TotalLivingAreaSqFt",
       close_price_per_sqft, sale_to_final_list_ratio
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A' AND "City" = 'Bend'
  AND "CloseDate" >= now() - INTERVAL '6 months'
  AND ("ClosePrice" < 50000 OR "ClosePrice" > 10000000
       OR close_price_per_sqft < 50 OR close_price_per_sqft > 2000
       OR sale_to_final_list_ratio < 0.50 OR sale_to_final_list_ratio > 1.50);

-- buyer_financing format check
SELECT buyer_financing, COUNT(*)
FROM listings
WHERE "StandardStatus" = 'Closed' AND "City" = 'Bend'
  AND buyer_financing IS NOT NULL
  AND "CloseDate" >= now() - INTERVAL '12 months'
GROUP BY buyer_financing
ORDER BY COUNT(*) DESC LIMIT 20;

-- OnMarketDate > CloseDate count — historical artifact, no longer relevant for video stats
-- since we use days_to_pending; kept for data-quality monitoring only.
SELECT COUNT(*) AS bad_onmarket_records
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "OnMarketDate" > "CloseDate"
  AND "PropertyType" = 'A';
```

Print results before proceeding. Flag any null rate below 80% on a field intended for a video metric. Flag any outlier rows for manual review. Document in `citations.json`.

---

## 8. Pre-Render Checklist (MANDATORY)

Run this checklist after compositing, before asking Matt for approval:

- [ ] All data queries follow hard rules (Section 1)
- [ ] Data integrity validation passed (Section 7)
- [ ] Every figure cross-checked against Spark API (<1% delta)
- [ ] Outliers spot-checked (no $1 sales, no $50M listings in residential)
- [ ] Time period matches narration text exactly
- [ ] Property type filters applied (SFR + PropertyType A)
- [ ] **UF1: `"ClosePrice" >= 10000` (and `"ListPrice" >= 10000` where list-side) applied to EVERY closed-sales / list-side query**
- [ ] **UF2: `sale_to_final_list_ratio BETWEEN 0.5 AND 1.5` applied to EVERY ratio aggregation (and inline ratio math has equivalent clamp)**
- [ ] **UF3: MoS computed via Template 11 ONLY — both active and closed CTEs SFR-filtered, `market_pulse_live.months_of_supply` NOT referenced anywhere in scripts, props.json, citations.json, or rendered chrome**
- [ ] **MoS verdict pill matches manual number against ≤4 / 4–6 / ≥6 thresholds (no "Seller's Market" pill next to 5.5 MoS)**
- [ ] Median used for all price metrics (not average)
- [ ] Timezone conversion applied to all date filters
- [ ] Record count verified against expected universe
- [ ] `days_to_pending` column used for all closed/pending DOM stats; `OnMarketDate` only used for active-listing age calculations
- [ ] Victoria voice generated with forced alignment timestamps
- [ ] Captions synced to word-level alignment (no hard cuts between blocks)
- [ ] Brand colors only (Navy #102742, Cream #faf8f4, Fir #2e4a3a, Sky #8fb8d4, Gold #D4AF37/#C8A864)
- [ ] Fonts: Amboqia headlines only, Geist body/data/captions (NOT AzoSans for body)
- [ ] No banned words in captions, VO script, or on-screen text
- [ ] No logo/agent name/phone in any frame except end card (Scene 8)
- [ ] CTA included (subscribe + contact)
- [ ] Viral scorecard >= 80 (market data format minimum)
- [ ] `citations.json` written with one entry per figure
- [ ] `scorecard.json` written next to render
- [ ] Video reviewed frame-by-frame before presenting to Matt

---

## 9. Brand Rules (Ryan Realty Design System)

**Full reference:** `brand-system.md` in this skill directory. This section is the operative summary — read `brand-system.md` for oklch values, imagery registers, card anatomy, and the complete specification.

### 9.1 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Brand primary navy | `#102742` | Background, overlays, pills, shadows |
| Cream (heritage) | `#faf8f4` | Text on dark backgrounds, heritage marketing surfaces |
| Fir green | `#2e4a3a` | Accent — Central Oregon forest register |
| Sky blue | `#8fb8d4` | Accent — Deschutes water register |
| Gold (news clips) | `#D4AF37` | Pill borders, trend arrows on news format |
| Gold (listing reels) | `#C8A864` | Pill borders, trend arrows on listing format |
| Charcoal | `#1A1A1A` | Body text on light backgrounds |

**Chart ramp (market-pulse charts):** Five-step blue from pale to brand navy. Use for multi-series area/bar charts where each series needs a distinct value within the brand palette.

**Warm neutrals only.** Never cool/blue grey. Background tones use warm stone greys on data surfaces, cream `#faf8f4` on heritage marketing moments (title card, end card).

**No decorative gradients.** The only permitted gradient is the navy protection overlay on hero imagery: `rgba(16,39,66,0.75)`.

**Navy-tinted shadows:** `rgb(16 39 66 / 0.08)` — never generic grey shadows.

### 9.2 Typography — Three Families

**1. Amboqia Boriango** — primary display serif.
- High-contrast swash serif with looped `y` descender.
- USE FOR: Hero H1 titles, pull quotes, Scene 1 title card text, Scene 8 end card headline, section hero stamps.
- NEVER for body text, data labels, captions, or chart annotations.
- Tracking: `-0.01em` (hero H1) to `0.08em` (all-caps).
- Scale: 40px–120px depending on context.
- Fallback: Playfair Display → Didot → Georgia. Flag any fallback use as a visible downgrade.

**2. Azo Sans Medium** — accent sans-serif.
- Rare usage. Arched/ribbon sub-labels under wordmark only.
- Uppercase only in those contexts.
- Fallback: Geist.

**3. Geist** — UI, body, data, captions.
- Weights: 400 (body), 500 (emphasis), 600 (semibold labels), 700 (bold headings in data panels).
- USE FOR: All chart labels, data annotations, body text, VO captions, metric displays, navigation, UI elements.
- Geist Mono for code/technical readouts if needed.
- `font-variant-numeric: tabular-nums` MANDATORY on every numeric surface — charts, leaderboards, CountUp animations, stat reveals.

**Font decision tree for video scenes:**
- Wordmark → use pre-rendered image from `assets/brand/`
- Scene 1 title card headline, Scene 8 end card headline, pull quotes → Amboqia Boriango
- Data overlays, chart labels, body text, captions, metric panels → Geist
- Arched/ribbon sub-label (rare) → Azo Sans Medium, uppercase

### 9.3 Brand Voice (VO Script Rules)

**Principles:** Show, don't tell. Never describe the tone — demonstrate it through specificity.

**Four rules:** Be direct. Be specific. Be kind. Be honest even when inconvenient.

**Person:** Always "you" and "your" — never "I" (exception: Scene 8 CTA sign-off where Matt identifies himself).

**Tagline:** "It's About Relationships." (with period). Used with wordmark only, never as filler in VO.

**Extended brand promise:** "Building community through authentic relationships and exceptional customer service."

**AVOID in VO scripts:**
- "dream home", "luxurious", "nestled", "breathtaking", "turnkey", "stunning"
- Exclamation marks — never
- Hedging: "may", "could", "potentially" — be direct
- Emoji — NEVER (not in scripts, not in captions, not in metadata)

**Full banned word list (captions, VO, on-screen text, metadata):**
stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, approximately, roughly, about (as number substitute), delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock.

**No em-dashes, no semicolons, no AI filler.** Sentences short. Two clauses max. No commas where Matt wouldn't pause.

### 9.4 Number Formatting

| Type | Format | Example |
|------|--------|---------|
| Currency | Rounded, with `$` and commas | `$895,000` not `$894,750` |
| Days | Integer + "days" | `38 days` |
| Unavailable | Em-dash | `—` |
| Percent change | One decimal, signed arrow | `↑ 2.1% YoY` |
| Tabular display | `font-variant-numeric: tabular-nums` | Always, every numeric surface |
| VO spoken | Spelled out for ingestion | "eight hundred ninety five thousand" |
| Units | Always explicit | "$3,025,000" not "3,025,000", "4 bedrooms" not "4 BR" |

### 9.5 Logo Assets

| Asset | Path | Use |
|-------|------|-----|
| Modern web wordmark | `assets/logo.png` | Digital surfaces, light backgrounds |
| Heritage wordmark (navy) | `assets/brand/logo-blue.png` | Print, heritage marketing, transparent BG |
| Heritage wordmark (white) | `assets/brand/logo-white.png` | Dark backgrounds, Scene 8 end card |
| "It's About Relationships" lockup w/ blue dog | `assets/brand/illustration-05.png` | Heritage moments, about sections |
| Stacked logo (white, for video) | `listing_video_v4/public/brand/stacked_logo_white.png` | Video end cards (Scene 8) |

**No logo, no "Ryan Realty" text, no phone, no agent name, no URL in any video frame except Scene 8 end card.**

### 9.6 Motion Timing

| Duration | Use |
|----------|-----|
| 200ms | Fades, micro-interactions |
| 300ms | Entrances, slide-ins |
| 400ms | Fade-up reveals |
| 2s | Loop animations |
| 20s | Ken Burns on hero/aerial imagery |

Respect `prefers-reduced-motion`. No scale transforms on press — use `translate-y-px`.

### 9.7 Caption Pill Spec (Bottom Zone)

- Zone: y 1480–1720, x 90–990
- Font: Geist (NOT AzoSans) 56px
- Pill: 70% navy `rgba(16,39,66,0.70)`
- Corner radius: 24px
- Top border: 2px gold (`#D4AF37` for news, `#C8A864` for listings)
- Must NOT overlay graphics, charts, or data visualizations
- Min 6-frame (200ms) opacity ramp on fades
- Word-by-word kinetic: 1–3 word chunks, synced to ElevenLabs forced-alignment timestamps

### 9.8 Imagery Registers

Three visual registers, used deliberately:

1. **Documentary photography** — warm-lit aerials/landscapes of Central Oregon. Natural color, no teal-orange grade. Ken Burns at 20s on hero.
2. **Heritage engravings** — navy monochrome line-art illustrations. Central Oregon landmarks. Use on title cards, section dividers, heritage voice moments. Always monochrome navy on cream or white — never tint another color.
3. **The blue dog — Jax** — sitting black lab in engraving style. Mascot. Never crop or recolor.

### 9.9 Card/Panel Anatomy (for data panels in Remotion)

- White bg, rounded-xl, ring-1 `ring-foreground/10`, shadow-sm, 16–24px padding
- Navy-tinted shadows: `rgb(16 39 66 / 0.08)`
- Base radius 10px, card 14px, button/input 10px, badge = pill

### 9.10 Brokerage Facts (always these values)

- Location: Bend, Oregon (signage format: `BEND · OREGON` with middle dot)
- Phone: 541.213.6706 (dotted format)
- Web: ryan-realty.com (hyphenated, lowercase)
- Service area: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Madras, Prineville, Powell Butte, Terrebonne, Crooked River Ranch

### 9.11 Signature Phrases (lift verbatim when needed)

- "It's About Relationships."
- "Building community through authentic relationships and exceptional customer service."
- "Love where you live."
- "Local Expertise."
- "Quality · Local · Service. Bend · Oregon."
- "Your local team."
- "Honest guidance."
- "Central Oregon Real Estate"
- "Market Snapshot"

### 9.12 VO Voice (ElevenLabs — LOCKED)

- **Voice: Victoria — ID `qSeXEcewz7tA0Q0qk9fH`**
- Model: `eleven_turbo_v2_5`
- Settings: stability 0.50, similarity 0.75, style 0.35, speaker_boost true
- `previous_text` chained across all lines for prosody continuity
- IPA phoneme tags for: Deschutes (`dəˈʃuːts`), Tumalo, Tetherow, Awbrey, Terrebonne
- Matt approved this voice 2026-04-27 — permanent. No substituting.

---

## 10. Bundled Resources

Read these sub-files as needed during production:

| File | When to read | Content |
|------|-------------|---------|
| `brand-system.md` | **Before any visual work** | Complete Ryan Realty design system: colors (hex + oklch), three font families with usage rules, voice rules with comparison table, imagery registers, motion timing, card anatomy, logo asset paths, signature phrases, banned words, number formatting, caption pill spec. This is THE source of truth for all brand decisions. |
| `engagement-guardrails.md` | **Before any scene component** | Research-validated engagement techniques (12 total: compound hook, strategic thumbnails, animated data viz, pattern interrupts, presenter strategy, kinetic typography, cultural references, layered composition, open loops, audio architecture, end-screen/CTA, captions). Each has implementation specs, landscape vs vertical adjustments, common mistakes, and a 10-item "what not to do" anti-pattern list. Sources include YouTube Creator Academy, VidIQ, the leaked MrBeast handbook, OpusClip, Retention Rabbit, and Journal of Consumer Marketing. Ship-blocker — see `build-guardrails.md` §3.5. |
| `build-guardrails.md` | **Before any code or content work** | Agent build standards: data integrity, code quality, scene-component specs, engagement requirements, voice precision, build order, verification gates, red flags, anti-patterns, integration test. The operational complement to the strategy in this SKILL.md. |
| `data-stories.md` | **FIRST — before every video** | 35+ ready-to-use data story segments with exact SQL queries, JSONB fields, and why each is unique to Ryan Realty. This is what makes the channel impossible to replicate. |
| `data-dictionary.md` | Before writing any Supabase query | Category-level field catalog: 821 JSONB keys organized across 17 categories with representative examples, promoted vs JSONB-only fields, data types, video-relevant field highlights |
| `query-rules.md` | Before every data pull | 11 ready-to-use SQL templates (incl. canonical SFR-only Months of Supply Template 11), all 6 critical bugs with workarounds, three universal residential filters (UF1/UF2/UF3), column quoting rules, timezone handling, derived field formulas |
| `storyboard-template.md` | When building a new episode | Scene-by-scene: durations, Remotion components, data source queries, VO script templates with {{variables}}, transition assignments, swap-in modules |
| `tool-inventory.md` | When selecting tools for a scene | Complete API/tool inventory with model IDs, costs, status, capabilities, scene assignments, fallback chains |
| `pipeline.md` | When running the production pipeline | 10-phase end-to-end flow, Inngest function structure, parallelization, error handling, YouTube upload, Shorts extraction, cost breakdown |

---

## See Also

- `video_production_skills/market-data-video/SKILL.md` — short-form (81s) city-level market data video for social. Use for Instagram/TikTok/Shorts cuts, not YouTube long-form.
- `video_production_skills/news-video/SKILL.md` — daily real estate news reels. Use for breaking news, not monthly data reports.
- `video_production_skills/neighborhood-overview/SKILL.md` — 30s Google 3D Tiles flyover. Can be composited into Scene 6 of this skill's storyboard.
- `video_production_skills/data_viz_video/SKILL.md` — general data visualization video. This skill supersedes it for YouTube market reports specifically.
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master production rules. Read for novel formats or edge cases not covered here.
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned-content gate. 12 rules, every one a ship-blocker.
- `video_production_skills/VIRAL_GUARDRAILS.md` — 100-point scorecard. Market data format minimum: 80.
