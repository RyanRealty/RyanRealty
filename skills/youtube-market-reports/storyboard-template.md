# Storyboard Template — Monthly Market Report

## Format Specs
- Resolution: 1920x1080 (16:9 landscape)
- Frame rate: 30fps
- Codec: h264 + aac, faststart
- Target runtime: 8-10 minutes
- Background: Dark navy (`#102742`)
- Text: Cream (`#faf8f4`) — heritage cream, warm tone
- Accent colors: Fir green (`#2e4a3a`), Sky blue (`#8fb8d4`)
- Chart ramp: five-step blue from pale to brand navy
- Gold accents: `#D4AF37` (news clips), `#C8A864` (listing reels)
- Headlines: Amboqia Boriango (display serif — NEVER for body/data)
- Body/data labels/captions: Geist (weights 400/500/600/700)
- Arched/ribbon sub-labels: Azo Sans Medium (rare, uppercase only)
- Numeric surfaces: `font-variant-numeric: tabular-nums` MANDATORY
- Shadows: navy-tinted `rgb(16 39 66 / 0.08)` — never generic grey
- Ken Burns on hero/aerial: 20s duration
- No decorative gradients — only navy protection overlay on hero imagery
- Warm neutrals only — NEVER cool/blue grey

## Audio Design
- Voice: Victoria (ElevenLabs ID `qSeXEcewz7tA0Q0qk9fH`)
- Model: `eleven_turbo_v2_5`
- Settings: stability 0.50, similarity 0.75, style 0.35, speaker_boost true
- Target pacing: 150 WPM (~1,350 words for 9 minutes)
- Background music: ambient/electronic, 70-90 BPM, -18dB to -22dB relative to VO, same track every episode for brand consistency
- SFX: soft whoosh on transitions (0.3s), gentle pop when stat numbers land (0.1s)
- `previous_text` chaining across all lines for prosody continuity
- Forced alignment via `/v1/forced-alignment` MANDATORY for word-level caption sync

## Scene 0: THE HOOK (0:00 - 0:30, 30 seconds)

**Visual:** Full-screen animated stat reveal over Google Earth zoom-in (800km altitude to 600m over downtown Bend, 44.0582N, 121.3153W, 15 degree tilt, cubic-bezier deceleration). CountUp animation from 0 to actual value. Animated trend arrow with YoY comparison. Semi-transparent overlay `rgba(16,39,66,0.75)` over Earth zoom.

**Remotion component:** `<HookStatReveal>` — count-up via `interpolate(frame, [0, 90], [0, value])`, spring-animated trend arrow at frame 90. Geist 700 120px cream (`#faf8f4`) for number. `font-variant-numeric: tabular-nums`.

**Background:** Primary: Google Earth Studio 8s zoom export (1920x1080, 30fps JPEG sequence, FFmpeg to H.264). Fallback 1: Google 3D Tiles via `cascade-peaks` project (`REMOTION_GOOGLE_MAPS_KEY`). Fallback 2: Kling 3.0 aerial 10s ~$1.40.

**Data source:**
```sql
-- Scene 0: Hook stat (current month snapshot)
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  COUNT(*) AS closed_count,
  -- Pick the most dramatic metric as anchor_stat
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      BETWEEN '{{period_start}}' AND '{{period_end}}'
  AND "ClosePrice" IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
  AND days_to_pending IS NOT NULL;
-- If the hook stat is months-of-supply, use query-rules.md Template 11 instead.
-- If the hook stat is sale-to-list, add: AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5  -- UF2
```

**VO template:**
"{{month_name}} was a {{characterization}} month for Bend real estate. The median home price {{direction}} to ${{median_price}}. But the number that really tells the story this month is {{anchor_stat_name}}: {{anchor_stat_value}}."

**Transition out:** CrossfadeTransition, 15 frames.

**Rules:** First spoken word is content (no "hey", "today", "welcome"). Hook contains specific number. Motion engaged by frame 12 (0.4s). On-screen text by frame 30 (1.0s). Minimum 3 seconds for hook text to remain readable.

---

## Scene 1: TITLE CARD + CONTEXT (0:30 - 0:45, 15 seconds)

**Visual:** Branded title card. Ryan Realty stacked logo (from `listing_video_v4/public/brand/stacked_logo_white.png`), episode identifier, mini-agenda text: "Prices | Inventory | Days to Pending | Neighborhood Breakdown". Animated underline sweeps left-to-right.

**Remotion component:** `<TitleCard>`

**Audio:** Brand sting from `video/brand-outro/` at start.

**Data source:** Static (no query needed).

**VO template:**
"This is the Ryan Realty Market Report for {{month_year}}. Every month, the real MLS data for Bend and Central Oregon, broken down for you. No opinions, just numbers."

**Transition out:** PushTransition, 15 frames.

---

## Scene 2: MEDIAN PRICE TREND (0:45 - 2:15, 90 seconds)

**Visual:** Animated line chart, 12-24 months of median sale price. Current month data point pulses/glows. YoY comparison as dashed secondary line. Annotation callouts for peak and current. ClipPath animation for progressive line reveal, spring-animated data points.

**Remotion component:** `<AnimatedLineChart>` (Recharts-based)

**B-roll underlayer:** Seedance 1 Pro 5s loop at 15% opacity ("slow aerial pan over residential neighborhood, Pacific Northwest, warm afternoon light", fixed seed, $0.50). Import as `<OffthreadVideo>` at `opacity: 0.15`. Fallback: Unsplash API + DepthParallaxBeat (free).

**Data source:**
```sql
-- Scene 2: Monthly median price trend (24 months)
SELECT
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date)::date AS month,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  COUNT(*) AS sales_count
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '{{24_months_ago}}'
  AND "ClosePrice" IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY 1 ORDER BY 1;
```

**VO template:**
"Here is Bend's median sale price over the last two years. In {{current_month}}, the median landed at ${{median_price}}, {{yoy_direction}} {{yoy_pct}} percent from ${{median_price_ly}} a year ago. {{trend_description}}. {{interpretation}}."

**Transition out:** CrossfadeTransition, 15 frames.

---

## Scene 3: PRICE PER SQUARE FOOT (2:15 - 3:15, 60 seconds)

**Visual:** Grouped bar chart. Price/sqft by property type (SFR, condo/townhome, manufactured) with current vs same month last year bars side by side. Bars grow from bottom. Percentage labels fade in after bars reach height.

**Remotion component:** `<GroupedBarChart>`

**Data source:**
```sql
-- Scene 3: Price per sqft by property type, current vs prior year
SELECT
  property_sub_type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf,
  COUNT(*) AS sales
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      BETWEEN '{{period_start}}' AND '{{period_end}}'
  AND "ClosePrice" IS NOT NULL
  AND "ClosePrice" >= 10000      -- UF1
  AND "TotalLivingAreaSqFt" > 0
GROUP BY property_sub_type
ORDER BY median_ppsf DESC;
-- Run same query with prior year dates for comparison bars
```

**VO template:**
"Price per square foot tells a different story than raw sale price. Single family homes in Bend are at ${{sfr_ppsf}} per square foot, {{sfr_direction}} {{sfr_pct}} percent from last year. {{condo_comparison}}. {{manufactured_comparison}}."

**Transition out:** CrossfadeTransition, 15 frames.

---

## Scene 4: INVENTORY AND MONTHS OF SUPPLY (3:15 - 5:00, 105 seconds)

### Part A (3:15 - 4:15): Stacked Area Chart

**Visual:** Stacked area chart showing active inventory over 24 months, broken out by SFR (navy), Condo (medium blue), Land (light blue). Smooth area fill animation.

**Remotion component:** `<StackedAreaChart>`

### Part B (4:15 - 5:00): Market Gauge

**Visual:** Semi-circular gauge, 0-12 months range. Color zones: 0-3 deep red (hot seller's), 3-4 red, 4-6 yellow (balanced), 6+ green (buyer's). Needle animates from 0 to current value with spring easing.

**Remotion component:** `<MarketGauge>` (port from existing `MarketHealthGauge` web component)

**B-roll intercut:** Hailuo 02 5s "For Sale sign, suburban home, Pacific Northwest style, slight camera drift" at full opacity between Part A and Part B ($1.35). Fallback: Wan 2.5 i2v from real Bend photo ($0.20/sec).

**Data source:**

```sql
-- Scene 4A: Inventory time series (active SFR only — for the stacked area chart's primary series)
SELECT
  DATE_TRUNC('month', "OnMarketDate")::date AS month,
  COUNT(*) FILTER (WHERE property_sub_type = 'Single Family Residence') AS sfr_active,
  COUNT(*) FILTER (WHERE property_sub_type IN ('Condominium', 'Townhouse')) AS condo_active,
  COUNT(*) FILTER (WHERE "PropertyType" = 'C') AS land_active
FROM listings
WHERE "StandardStatus" = 'Active'
  AND "City" = 'Bend'
  AND "ListPrice" >= 10000  -- UF1 list-side floor
GROUP BY 1 ORDER BY 1;
```

**Scene 4B: Months of supply — use `query-rules.md` Template 11 verbatim. Do NOT inline a custom MoS query here.**

Template 11 enforces UF1 + UF3 (SFR filter on both CTEs, ClosePrice ≥ 10000 on the closed CTE) and the canonical `active / (closed_N_days / N * 30)` formula. **Never read `market_pulse_live.months_of_supply` into this scene** — measured Bend gap on 2026-04-30 was stored 5.80 vs SFR-only 4.20 (38%, would flip the gauge needle from "balanced" yellow to "seller's" red zone on camera). Per `query-rules.md` C3 this is a hard ship-blocker.

**Gauge color-band rule:** the gauge's color zone under the needle MUST match the verdict pill text and both must derive from the manually-computed MoS value. ≤ 4 = seller's (red zones), 4–6 = balanced (yellow), ≥ 6 = buyer's (green). If the manual number is 4.2 and the gauge needle lands in the yellow zone, the pill says "Balanced Market" — never override with stored verdicts.

**Citations.json entry for this scene must include:** `active_count`, `closed_count`, `lookback_days`, the divisor (`monthly_close_rate`), the resulting `months_of_supply`, and the Spark cross-check on `active_count`. If the citation cites `market_pulse_live` as the MoS source, the render is non-ship.

**VO template:**
"There are currently {{active_count}} single-family homes for sale in Bend. That is {{inventory_direction}} {{inventory_pct}} percent from last year. At the current pace of sales, that gives us {{months_of_supply}} months of supply. {{market_condition_explanation}}."

**Transition out:** SlideTransition, 15 frames.

---

## Scene 5: DAYS ON MARKET AND ABSORPTION (5:00 - 6:00, 60 seconds)

**Visual:** Split screen. Left panel: horizontal bar chart, median DOM by price band (Under $500K / $500K-$700K / $700K-$1M / $1M+), colored green to yellow to orange to red. Bars animate sequentially top-to-bottom. Right panel: single large absorption rate percentage with trend arrow showing change from prior month.

**Remotion component:** `<SplitMetricPanel>`

**Data source:**
```sql
-- Scene 5: Days-to-pending by price band — use query-rules.md Template 7 (already has UF1 ClosePrice floor)

-- Absorption / sell-through / median days-to-pending:
-- WARNING: market_pulse_live aggregates ALL PropertyType='A' sub-types (same root cause as the
-- C3 MoS bug). For an SFR-only number that matches the rest of the video, recompute manually:
WITH active AS (
  SELECT COUNT(*) AS active_count FROM listings
  WHERE "StandardStatus" = 'Active' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence' AND "City" = 'Bend'
    AND "ListPrice" >= 10000
),
pending_90d AS (
  SELECT COUNT(*) AS pending_count FROM listings
  WHERE "StandardStatus" = 'Pending' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence' AND "City" = 'Bend'
    AND pending_timestamp >= now() - INTERVAL '90 days'
),
closed_90d AS (
  SELECT COUNT(*) AS closed_count,
         PERCENTILE_CONT(0.5) WITHIN GROUP (
           ORDER BY days_to_pending
         ) AS median_days_to_pending
  FROM listings
  WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence' AND "City" = 'Bend'
    AND "ClosePrice" >= 10000  -- UF1
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= now()::date - INTERVAL '90 days'
    AND days_to_pending IS NOT NULL
)
SELECT
  ROUND(100.0 * c.closed_count / NULLIF(a.active_count + c.closed_count, 0), 1) AS absorption_rate_pct,
  ROUND(100.0 * c.closed_count / NULLIF(p.pending_count + c.closed_count, 0), 1) AS sell_through_rate_90d,
  c.median_days_to_pending
FROM active a, pending_90d p, closed_90d c;
```

**VO template:**
"How long are homes sitting on the market? Under five hundred thousand, the median is {{dom_under_500k}} days. Between five hundred and seven hundred thousand, {{dom_500_700k}} days. Above a million dollars, expect {{dom_1m_plus}} days. The absorption rate is {{absorption_rate}} percent, meaning {{absorption_interpretation}}."

**Transition out:** CrossfadeTransition, 15 frames.

---

## Scene 6: NEIGHBORHOOD BREAKDOWN (6:00 - 7:30, 90 seconds)

### Part A (6:00 - 6:45): ZIP Code Map

**Visual:** 3 composited layers: (1) Google Photorealistic 3D Tiles via `cascade-peaks` as aerial base, camera path from 3,000m centered on Bend descending to hit each ZIP centroid: 97702 SW (44.03, -121.33), 97701 E (44.06, -121.28), 97703 W (44.07, -121.35), 97708 N (44.10, -121.30). (2) Remotion SVG overlay with ZIP boundaries (Census TIGER/Line GeoJSON). (3) Text labels showing "NW Crossing: $725K (+2.1%)". Zones fill in sequentially, 15 frames apart. Semi-transparent fills using diverging color palette (green = appreciation, yellow = flat, red = depreciation).

**Remotion component:** `<BendZipMap>` (SVG paths in React, animated color fills)

**Google 3D Tiles:** `REMOTION_GOOGLE_MAPS_KEY`, `maximumScreenSpaceError: 16`, free tier covers ~500-1,000 tile loads per render. Fallback 1: Kling 3.0 aerial 15s ~$2.10. Fallback 2: Google Maps Static API styled satellite.

### Part B (6:45 - 7:30): Leaderboard

**Visual:** Scrolling table with 4 columns: Area, Median Price, YoY Change, Days to Pending. Rows animate in one at a time with slide-up + fade.

**Remotion component:** `<AnimatedLeaderboard>`

**Data source:**
```sql
-- Scene 6: Per-ZIP metrics
SELECT
  "PostalCode",
  COUNT(*) AS sales,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft) AS median_ppsf,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending) AS median_days_to_pending
FROM listings
WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
  AND property_sub_type = 'Single Family Residence'
  AND "City" = 'Bend'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      BETWEEN '{{period_start}}' AND '{{period_end}}'
  AND "ClosePrice" IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
  AND "TotalLivingAreaSqFt" > 0
  AND days_to_pending IS NOT NULL
GROUP BY "PostalCode"
ORDER BY median_price DESC;
-- Run with prior year dates for YoY calculation
```

**VO template:**
"Now the neighborhood breakdown. The west side, ZIP 97703, remains the most expensive area with a median of ${{zip_97703_price}}. The east side, 97701, continues to offer the best value at ${{zip_97701_price}}. The biggest mover this month was {{hottest_zip}} at {{hottest_yoy}} percent year over year."

**Transition out:** WhipPanTransition, 10 frames (energy for this reveal). Then LightLeakTransition, 20 frames into Scene 7.

---

## Scene 7: BUYER/SELLER TAKEAWAYS (7:30 - 8:30, 60 seconds)

**Visual:** Two-panel layout on navy background. Left: "FOR BUYERS" header in cream, 2-3 bullet points. Right: "FOR SELLERS" header, 2-3 bullet points. Points animate in with spring() and slide-up. Background: depth-parallax Bend lifestyle photo (Unsplash API query "bend oregon family neighborhood", MiDaS DPT-Large depth map, `DepthParallaxBeat` component at `parallaxIntensity: 0.03`, dark gradient overlay at 60% opacity). Fallback: Seedance 1 Pro 10s $1.00 at 20% opacity.

**Remotion component:** `<TakeawayPanel>`

**Data source:** Derived from previous scenes' data:
- Buyer negotiation power: sale_to_final_list_ratio computed manually (NOT from `market_pulse_live` — that view aggregates all `PropertyType='A'` sub-types and produces the same skew that breaks the MoS column; see `query-rules.md` C3). Use:
  ```sql
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio) AS median_sale_to_list
  FROM listings
  WHERE "StandardStatus" = 'Closed' AND "PropertyType" = 'A'
    AND property_sub_type = 'Single Family Residence'
    AND "City" = 'Bend'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= now()::date - INTERVAL '90 days'
    AND "ClosePrice" >= 10000                          -- UF1
    AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5;  -- UF2
  ```
- Best value area: lowest median_ppsf ZIP from Scene 6
- Rate context: hardcoded or from rate API
- Pricing advice: median days to pending for listings with vs without price reductions

**VO template:**
"So what does this mean for you? Buyers: {{buyer_takeaway_1}}. {{buyer_takeaway_2}}. Sellers: {{seller_takeaway_1}}. {{seller_takeaway_2}}."

**Transition out:** CrossfadeTransition, 15 frames.

---

## Scene 8: CTA + OUTRO (8:30 - 9:00, 30 seconds)

**Visual:** Navy (`#102742`) background. Ryan Realty stacked logo centered large — use `assets/brand/logo-white.png` (heritage wordmark, white on dark) or `listing_video_v4/public/brand/stacked_logo_white.png`. URL in Geist 500: "ryan-realty.com" (hyphenated, lowercase). Phone in dotted format: "541.213.6706". Animated subscribe button pulse. Lower third in Geist 400 cream (`#faf8f4`): next month's report date. YouTube end screen elements in final 20 seconds. Headline text (episode sign-off) in Amboqia Boriango.

**Remotion component:** `<OutroCard>`

**Audio:** Brand sting from `video/brand-outro/`.

**Data source:** Static.

**VO template:**
"That is the {{month_name}} data. If this was useful, subscribe for the next report on {{next_report_date}}. Questions about any of these numbers? Reach out at ryan-realty.com. I am Matt Ryan with Ryan Realty. I will see you in the data."

---

## Transition Map

| From | To | Transition | Frames |
|------|----|-----------|--------|
| 0 | 1 | CrossfadeTransition | 15 |
| 1 | 2 | PushTransition | 15 |
| 2 | 3 | CrossfadeTransition | 15 |
| 3 | 4 | CrossfadeTransition | 15 |
| 4 | 5 | SlideTransition | 15 |
| 5 | 6 | WhipPanTransition | 10 |
| 6 | 7 | LightLeakTransition | 20 |
| 7 | 8 | CrossfadeTransition | 15 |

All transition components exist in `listing_video_v4/src/transitions/`.

## Swap-In Modules

Rotate these into the lineup for variety. Each replaces a specific scene.

### Price Band Distribution (replaces Scene 3)
Horizontal stacked bar chart: $0-400K, $400-600K, $600-800K, $800K-1M, $1M+. Shows proportion of sales in each band. Component: `<PriceBandBars>`. Source: `get_city_price_bands`.

### New Listings Velocity (replaces Scene 5)
Line chart of new listings per week over 12 months. Shows seasonal patterns. Component: `<NewListingsVelocity>`. Source: listings with `"ListingContractDate"` grouped by week.

### Sale-to-List Ratio Deep Dive (replaces Scene 3)
Donut chart showing distribution of sale-to-list ratio. Component: `<SaleToListDonut>`.

### Regional Comparison Bar Chart Race (replaces Scene 6)
Animated bar chart race: Bend vs Redmond vs Sisters vs La Pine on a metric over 12 months. Component: `<RegionalComparison>`.

### Back-on-Market and Price Reductions (insert between Scenes 4-5)
Dual metric: BOM rate and price reduction share trends. Component: `<MarketStressIndicators>`.

## Remotion Components Required (10 core + 5 swap-in)

| Component | Status | Est. Build |
|-----------|--------|-----------|
| `<HookStatReveal>` | Not built | 4h |
| `<TitleCard>` | Not built | 2h |
| `<AnimatedLineChart>` | Not built | 8h |
| `<GroupedBarChart>` | Not built | 6h |
| `<StackedAreaChart>` | Not built | 6h |
| `<MarketGauge>` | Port from web `MarketHealthGauge` | 3h |
| `<SplitMetricPanel>` | Not built | 4h |
| `<BendZipMap>` | Not built (needs Census GeoJSON) | 6h |
| `<AnimatedLeaderboard>` | Not built | 4h |
| `<TakeawayPanel>` | Not built | 3h |
| `<OutroCard>` | Not built | 2h |
| `<SubtitleOverlay>` | Not built (needs alignment.ts) | 4h |

Total estimated: ~52 hours for core components.

## Shorts Extraction (auto-generate from same render)

1. **Hook Short (30s):** Scene 0 re-rendered at 1080x1920 portrait. Same data, same VO, reformatted layout.
2. **Neighborhood Short (60s):** Scene 6 extracted, reformatted to portrait, ZIP map recomposed for vertical.
3. **Price Trend Short (45s):** Scene 2 condensed, chart reformatted for vertical.
