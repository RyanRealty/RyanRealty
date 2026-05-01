# Pipeline — YouTube Market Report Production

## Overview

10-phase end-to-end pipeline from data pull to YouTube publish. Total automated time: 3-6 minutes (excluding human review). Orchestrated by Inngest with `waitForEvent` for human review checkpoint.

**Trigger:** Existing Vercel cron `/api/cron/market-report` fires Saturday 2pm PT. Inngest function `market-report/generate` picks up the event.

**Monthly schedule:** Data refreshes continuously via `sync-delta` (every 10 min) and `refresh-market-stats` (every 6h). Pipeline runs on the first Saturday after month-end close data is reconciled (~3-5 business days into the new month).

## Phase 1: Data Pull (~5 seconds)

Run 7 parallel Supabase queries. All queries MUST follow the hard rules in `query-rules.md`.

| Query | Target | Scene |
|-------|--------|-------|
| City period metrics (current month) | Market snapshot: median price, DOM, sales count, sale-to-list | 0, 2 |
| City period metrics (same month last year) | YoY comparison baseline | 0, 2 |
| Monthly time series (24 months) | Trend line data | 2 |
| Per-ZIP metrics (current + prior year) | Neighborhood breakdown | 6 |
| Price/sqft by property type (current + prior) | Property type comparison | 3 |
| Active inventory count + closed last 6 months — SFR-filtered on BOTH sides per `query-rules.md` Template 11 + UF3 | Months of supply calculation | 4 |
| Manual SFR-only absorption / sell-through / median-days-to-pending per `storyboard-template.md` Scene 5 spec — DO NOT pull from `market_pulse_live` (same root-cause skew that breaks its MoS column; see C3) | Absorption rate, sell-through, median days to pending | 5 |

**Output:** Single typed `VideoProps` object containing all data needed for every scene.

**Required filters on every query (universal residential filters — see `query-rules.md`):**
- `"PropertyType" = 'A'`
- `property_sub_type = 'Single Family Residence'`
- `"City" = 'Bend'` (or ZIP filter for Scene 6)
- `"ClosePrice" IS NOT NULL` (for closed sale queries)
- **`"ClosePrice" >= 10000` (UF1) — every closed-sales query, every time. `> 0` lets through 1,640 land/artifact rows.**
- **`sale_to_final_list_ratio BETWEEN 0.5 AND 1.5` (UF2) — every ratio aggregation, in WHERE not in FILTER.**
- `"TotalLivingAreaSqFt" > 0` (for price/sqft queries)
- `days_to_pending` column for all closed/pending DOM stats (matches Beacon methodology)
- `("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date` (for all date filters)
- **MoS computed via `query-rules.md` Template 11 ONLY. Forbidden to read `market_pulse_live.months_of_supply` into the pipeline output, citations, props, or scene data. (UF3 + C3)**

## Phase 2: QA Gate — Spark API Cross-Check (HARD ABORT)

For every figure that also exists in Spark API, query both sources and compare.

```
Supabase median price: $725,000 (query: ...)
Spark median price: $724,500 (query: ...)
Delta: 0.07% — PASS
```

**Rules:**
- |delta| > 1% on ANY metric = ABORT the entire pipeline
- Surface the conflict to Matt: metric name, Supabase value + query, Spark value + query, delta %, suspected cause
- Spark wins for: active inventory count, current DOM
- Supabase wins for: reconciled historical close data past the Spark cutover date
- Wait for Matt's resolution before proceeding
- Document every cross-check in `out/<deliverable>/citations.json`

**Spot-check outliers:** Query for $1 sales, $50M+ listings, days_to_pending > 1000, sale-to-list > 1.50 or < 0.50. Flag any for manual review.

**Verify record counts:** Compare total closed sales count against expected universe. Sudden drops indicate a sync issue.

## Phase 3: Script Generation (~30 seconds)

Use Claude API to generate the VO script from the storyboard template + VideoProps data.

**System prompt includes:**
- Anti-slop manifesto rules (all 12)
- Banned word list
- VO rules (short sentences, two clauses max, no em-dashes, no semicolons)
- Numbers spelled out for ElevenLabs ingestion
- IPA phoneme tags for local place names
- 150 WPM target pacing (~1,350 words for 9 minutes)

**Input:** VideoProps JSON with all data from Phase 1.

**Output:**
- Filled VO script (all `{{variables}}` replaced with verified data)
- SEO title (under 60 characters, geographic + topical + data hook)
- YouTube description (first 200 chars contain primary keyword, timestamps, links, hashtags)
- Tags (10-15, mix of broad and long-tail)
- 3 title variants for A/B consideration

**Script generation function:** `src/scripts/generate-script.ts` (to build).

**Cost:** ~$0.10-0.15 per script.

## Phase 4: HUMAN REVIEW CHECKPOINT

**This is a hard gate. No rendering proceeds without Matt's explicit approval.**

Inngest function calls `waitForEvent("script-approved")` with a 48-hour timeout.

**Present to Matt:**
- Full VO script with data values highlighted
- SEO title and description
- Verification trace (one line per figure)
- Record counts and date ranges
- Any outlier flags from Phase 2

**Matt's options:**
- "Approved" / "Ship it" / "Go" — proceed to Phase 5
- Specific edits — apply changes, re-present
- "Kill" — abort pipeline for this month

**Do not proceed without explicit approval.** Silence is not approval. A successful QA gate is not approval.

## Phase 5: VO Render (~2-3 minutes)

Generate ElevenLabs audio from approved script.

**Steps:**
1. Split script into per-scene segments
2. Generate TTS for each segment with `previous_text` chaining for prosody continuity
3. Call forced-alignment API for each segment to get word-level timestamps
4. Convert timestamps to Remotion frame numbers: `Math.round(timestamp * 30)`
5. Save audio files to `out/<deliverable>/audio/`
6. Save alignment JSON to `out/<deliverable>/alignment/`

**Voice settings (locked):**
- Voice ID: `qSeXEcewz7tA0Q0qk9fH` (Victoria)
- Model: `eleven_turbo_v2_5`
- Stability: 0.50, Similarity: 0.75, Style: 0.35, Speaker boost: true
- Output format: `mp3_44100_128`

**Cost:** ~$0.30 for ~9,000 characters.

**BLOCKER:** `lib/voice/alignment.ts` helper must be built first.

## Phase 6: AI B-Roll Generation (parallel with Phase 5, ~2-5 minutes)

Generate AI video clips via Replicate. All run in parallel.

| Asset | Model | Prompt | Duration | Cost | Scene |
|-------|-------|--------|----------|------|-------|
| Neighborhood aerial loop | Seedance 1 Pro | "slow aerial pan over residential neighborhood, Pacific Northwest, warm afternoon light" | 5s | $0.50 | 2 (15% opacity) |
| For Sale sign | Hailuo 02 | "For Sale sign, suburban home, Pacific Northwest style, slight camera drift" | 5s | $1.35 | 4 (full opacity intercut) |
| Bend aerial (fallback) | Kling 3.0 | "aerial view of Bend Oregon, Cascade mountains background, neighborhoods" | 10s | $1.40 | 6 (only if 3D Tiles fail) |

**Fallback chain:** If primary model fails, try next model in the tool-inventory fallback list. If all fail, use static imagery (Unsplash + DepthParallaxBeat).

**Save to:** `out/<deliverable>/broll/`

## Phase 7: Stock and Maps (parallel with Phase 5, ~1-2 minutes)

| Asset | Source | Use | Scene |
|-------|--------|-----|-------|
| Bend lifestyle photo | Unsplash API | Depth-parallax background | 7 |
| Depth map | MiDaS v3.1 DPT-Large | From Unsplash photo | 7 |
| Google 3D Tiles flyover | cascade-peaks project | Aerial base for ZIP map | 6 |
| Earth zoom | Google Earth Studio (pre-rendered) or 3D Tiles | Hook background | 0 |
| Thumbnails (4 variants) | Grok Imagine | YouTube thumbnail A/B test | Post-render |

**Save to:** `out/<deliverable>/assets/`

## Phase 8: Remotion Compositing (~3-6 minutes)

Assemble all assets into the master composition.

**Steps:**
1. Build complete `VideoProps` object with paths to all generated assets
2. Register `MonthlyMarketReport` composition in Remotion
3. Each scene is a `<Sequence>` with frame-accurate timing
4. `<SubtitleOverlay>` reads word-level timestamps from alignment JSON
5. Transitions use existing components from `listing_video_v4/src/transitions/`
6. Brand colors, fonts, and logo applied via `theme.ts`
7. Background music layered at -18dB to -22dB

**Render command:**
```bash
cd listing_video_v4 && npx remotion render src/index.ts MonthlyMarketReport \
  out/<name>.mp4 --codec h264 --concurrency 1 --crf 22 \
  --image-format=jpeg --jpeg-quality=92
```

**Output:** MP4 in `out/<deliverable>/` (gitignored).

**Shorts renders (3 separate compositions):**
```bash
npx remotion render src/index.ts HookShort out/<name>-hook-short.mp4 ...
npx remotion render src/index.ts NeighborhoodShort out/<name>-neighborhood-short.mp4 ...
npx remotion render src/index.ts PriceTrendShort out/<name>-price-short.mp4 ...
```

## Phase 9: Quality Gate + Viral Scorecard

### Quality Gate (all must pass)
```bash
# Duration check (8-10 minutes for long-form)
ffprobe -v error -show_entries format=duration out/<name>.mp4

# Black frame detection (must return ZERO sequences)
ffmpeg -i out/<name>.mp4 -vf "blackdetect=d=0.1:pix_th=0.05" -f null - 2>&1 | grep blackdetect

# Audio non-silent check
ffmpeg -i out/<name>.mp4 -af silencedetect=n=-30dB:d=2 -f null - 2>&1 | grep silence_end

# Frame extraction for visual review
ffmpeg -i out/<name>.mp4 -vf "fps=1" out/<name>-frames/frame_%04d.jpg
```

### Visual Checks
- [ ] Frame at 0s has motion + content (not black, not logo)
- [ ] Frame at 25% has visual register change
- [ ] Frame at 50% has pattern interrupt
- [ ] Captions never overlap other visual components
- [ ] Caption transitions are smooth (fade or word-by-word, no hard cuts)
- [ ] All on-screen numbers carry units ("$725K" not "725K")
- [ ] No banned words in any frame

### Banned-Word Grep
```bash
grep -i -E "stunning|nestled|boasts|charming|pristine|gorgeous|breathtaking|must-see|dream home|meticulously|entertainer|tucked away|hidden gem|truly|spacious|cozy|luxurious|updated throughout|approximately|roughly|delve|leverage|tapestry|navigate|robust|seamless|comprehensive|elevate|unlock" out/<name>-script.txt
```
Any match = fix before proceeding.

### Viral Scorecard
Score 1-10 in each of 10 categories per `video_production_skills/VIRAL_GUARDRAILS.md` section 3:
1. Hook (motion by 0.4s, content by 1.0s, payoff by 2.0s)
2. Retention structure (25%, 50%, 75%, final 15% beats)
3. Text overlays (safe zone, readability, duration)
4. Audio (VO quality, music level, caption sync)
5. Format (resolution, length, codec)
6. Engagement triggers
7. Cover/thumbnail quality
8. CTA placement
9. Voice/brand consistency
10. Anti-slop compliance

**Market data format minimum: 80/100.** Below 80 = do not ship.

**Write:** `out/<deliverable>/scorecard.json` and `out/<deliverable>/citations.json`.

## Phase 10: Present Draft to Matt

**Format:**
> **Draft ready:** `out/<deliverable>/<name>.mp4`
> **Scorecard:** X/100 (market data minimum 80)
> **Verification trace:** one-line summary
> **Ready to commit + push to main on your sign-off.**

Then STOP. Do not upload. Do not commit. Wait for explicit approval.

### After Matt approves:

**YouTube Upload:**
1. YouTube Data API v3 resumable upload
2. Set metadata: title, description (with timestamps), tags, category
3. Upload winning Grok Imagine thumbnail
4. Set visibility: public (or scheduled for Sunday 10am PT)
5. Upload 3 Shorts as separate videos

**Commit to repo:**
1. Copy final MP4 to tracked location if needed
2. Commit `scorecard.json`, `citations.json`, script
3. Push to `origin main` immediately

**Post-publish tasks:**
- Pin comment with CTA and lead magnet link
- Set end screen elements (subscribe + next video)
- Slack/email notification to Matt with YouTube URL
- Log production metadata for future analysis

## Inngest Function Structure

```typescript
export const generateMarketReport = inngest.createFunction(
  { id: "market-report/generate" },
  { cron: "0 14 * * 6" }, // Saturday 2pm PT (via Vercel cron trigger)
  async ({ step }) => {
    const data = await step.run("fetch-data", () => fetchAllVideoData());
    const qaResult = await step.run("qa-gate", () => crossCheckSpark(data));
    if (qaResult.hasConflict) throw new Error("Spark delta > 1%");

    const props = await step.run("generate-props", () => buildVideoProps(data));
    const script = await step.run("generate-script", () => generateScript(props));

    // Human review checkpoint
    await step.waitForEvent("script-approved", {
      event: "market-report/script-approved",
      timeout: "48h",
    });

    const [audio, broll, assets, thumbnails] = await Promise.all([
      step.run("generate-audio", () => generateVO(script)),
      step.run("generate-broll", () => generateBRoll()),
      step.run("generate-assets", () => fetchStockAndMaps()),
      step.run("generate-thumbnails", () => generateThumbnails(props)),
    ]);

    const video = await step.run("render-video", () => renderComposition(props, audio, broll, assets));
    const shorts = await step.run("render-shorts", () => renderShorts(props, audio));
    const scorecard = await step.run("quality-gate", () => runQualityGate(video));

    if (scorecard.total < 80) throw new Error(`Scorecard ${scorecard.total}/100 below minimum 80`);

    // Present to Matt for final approval
    await step.waitForEvent("render-approved", {
      event: "market-report/render-approved",
      timeout: "48h",
    });

    await step.run("upload-youtube", () => uploadToYouTube(video, shorts, thumbnails));
    await step.run("notify-complete", () => notifyMatt(video));
  }
);
```

## Error Handling

| Error | Action |
|-------|--------|
| Supabase query fails | Retry 3x with 5s backoff. If still failing, abort and notify Matt. |
| Spark API unavailable | Log warning but DO NOT skip cross-check. Abort pipeline. |
| Spark delta > 1% | Abort. Surface both values to Matt. |
| ElevenLabs rate limit | Wait and retry. ~99K chars headroom should be sufficient. |
| Replicate model timeout | Try fallback model from tool-inventory chain. |
| All AI B-roll fails | Use static imagery (Unsplash + DepthParallaxBeat). |
| Remotion render OOM | Ensure concurrency=1. Reduce CRF if needed. |
| YouTube upload fails | Retry 3x. If auth issue, refresh service account token. |
| Scorecard below 80 | Do not ship. Identify failing categories. Fix and re-render. |

## Monthly Production Calendar

| Day | Task |
|-----|------|
| 1-3 of month | Wait for month-end close data to reconcile in Supabase |
| First Saturday after day 3 | Pipeline auto-triggers at 2pm PT |
| Saturday evening | Matt reviews script (15-30 min) |
| Sunday morning | Pipeline renders after script approval |
| Sunday 10am PT | Video publishes (optimal posting time) |
| Sunday 6am | `performance_loop` begins tracking |

**Matt's total monthly time investment: 25-45 minutes** (script review 15-30 min, video review 10-15 min).

## Build Priorities

### P0 — Required for first video (46h estimated)
- `generate-props.ts` (6h)
- `generate-script.ts` (4h)
- `lib/voice/alignment.ts` (4h) — BLOCKER
- `<HookStatReveal>` (4h)
- `<TitleCard>` (2h)
- `<AnimatedLineChart>` (8h)
- `<TakeawayPanel>` simplified (2h)
- `<OutroCard>` (2h)
- `<SubtitleOverlay>` (4h)
- 6-scene master composition (6h)
- YouTube upload function (4h)

### P1 — Full storyboard (50h estimated)
- `<GroupedBarChart>` (6h)
- `<StackedAreaChart>` (6h)
- `<MarketGauge>` port (3h)
- `<SplitMetricPanel>` (4h)
- `<BendZipMap>` + GeoJSON (8h)
- `<AnimatedLeaderboard>` (4h)
- AI B-roll pipeline (6h)
- 3D Tiles automation (8h)
- Depth-parallax backgrounds (4h)
- Inngest full pipeline (8h)
- Shorts generation (4h)
- Grok thumbnails pipeline (3h)

### P2 — Automation and polish
- Full Inngest orchestration with retry logic
- Thumbnail A/B testing integration
- Performance tracking dashboard
- Swap-in module library
- Multi-city expansion (Redmond, Sisters, La Pine, Sunriver)
