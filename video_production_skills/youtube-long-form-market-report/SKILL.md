---
name: youtube-long-form-market-report
description: Generate a YouTube long-form (8-12 minute, 1920x1080 horizontal) market report video for Central Oregon — deep narrative arc using ALL 40+ market_stats_cache columns, chapter timestamps, mid-roll FAQs, agent commentary, and full SEO metadata for YouTube search. Use this skill whenever the monthly-market-report-orchestrator routes deliverable #2, OR whenever the user says "YouTube long-form", "long-form market report", "deep dive market video", "make me a 10-minute version of this market report", or asks for the YouTube video version of a market report. Do NOT use this skill for short-form vertical reels — those go to market-data-video. Long-form is the depth-of-coverage variant where every cache column gets a beat instead of being collapsed into a 30-60s summary.
---

# YouTube Long-Form Market Report Skill — Ryan Realty

## Required references — load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)** — visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md)** — 2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**Scope:** Generate 8–12 minute YouTube long-form market analysis videos at 1920×1080. Uses every available column from `market_stats_cache` (40+ columns), top neighborhoods leaderboard, multi-year history, and agent commentary segments. Designed for "Bend Real Estate Market Report — April 2026" YouTube search intent.

**Status:** Locked 2026-05-07. Length target 8–12 min per Matt directive — long enough to use all the cache data, short enough to maintain retention.

---

## 1. When to use / when not to use

**Use this skill for:**
- Deliverable #2 from `monthly-market-report-orchestrator` (the YouTube long-form version of every monthly report)
- Standalone "deep dive" market analyses for YouTube
- Quarterly or year-end reviews where the data warrants a longer format
- Educational content tied to market data (e.g. "How to read a Bend market report")

**Do NOT use for:**
- Short-form vertical reels (use `market-data-video/SKILL.md` — 30–60s, 1080×1920)
- Listing tour videos (use `listing-tour-video/SKILL.md`)
- News clips (use `news-video/SKILL.md`)
- Anything under 6 minutes — the skill is built for depth; if the data only supports 4 min, ship the short-form instead

---

## 2. Format spec (locked)

| Parameter | Value | Reason |
|---|---|---|
| Resolution | 1920×1080 (landscape) | YouTube long-form discovery + search algorithm prefers landscape |
| Frame rate | 30 fps | Matches all Ryan Realty video output for consistency |
| Codec | h.264, yuv420p | Standard YouTube upload spec |
| Duration | 8–12 minutes (target 9–10) | Retention curve peaks 8–10 min for data-rich market analysis on YouTube; <6 min too thin for "deep" search intent; >13 min retention drops sharply (per VIRAL_GUARDRAILS) |
| Audio | AAC, 48kHz stereo | YouTube spec |
| Captions | Burned-in + uploaded SRT/VTT | YouTube auto-captions are good but not perfect for niche terms (Tumalo, Deschutes, Petrosa) |
| Bitrate | CRF 22 (high quality) | YouTube transcodes anyway; ship the cleanest source |
| File size | <500 MB | YouTube has no real cap, but smaller = faster upload |
| Chapter timestamps | Every section | Required for YouTube chapters feature + SEO |

---

## 3. Narrative arc (10-chapter spec)

The cache pre-computes 40+ columns. Long-form gets a chapter for each major data theme.

| # | Chapter | Duration | Cache columns featured | Visual |
|---|---|---|---|---|
| 1 | **Cold open + hook** | 0:00–0:45 | `market_health_label`, headline `median_sale_price_sfr` | Title card + drone B-roll of city |
| 2 | **Median sale price + 4-year history** | 0:45–2:00 | `median_sale_price_sfr`, `_history.windows[4]`, `yoy_median_price_delta_pct_sfr`, `mom_median_price_change_pct_sfr` | Multi-color line chart (per market-data-video §19) + Matt voiceover |
| 3 | **Where the action is — price segments** | 2:00–3:15 | `price_band_counts` (5 buckets), `price_tier_breakdown` (6 tiers) | Histogram + tier breakdown |
| 4 | **Months of supply + market verdict** | 3:15–4:15 | `months_of_supply` (computed), `market_health_score`, `market_health_label` | Gauge + verdict pill |
| 5 | **Days on market — distribution** | 4:15–5:30 | `median_dom_sfr`, `speed_p25/50/75`, `dom_distribution` (6-bin histogram) | DOM histogram + percentile chart |
| 6 | **Sale-to-list + concessions** | 5:30–6:30 | `avg_sale_to_list_ratio_sfr`, `median_concessions_amount_sfr` | Bar gauge + concessions trend |
| 7 | **Cash buyers + affordability** | 6:30–7:45 | `cash_purchase_pct_sfr`, `affordability_monthly_piti` | Donut chart for cash% + PITI hero |
| 8 | **Top neighborhoods** | 7:45–9:00 | Direct query: top 5 subdivisions by closed volume + median + DOM | Leaderboard with subdivision photos |
| 9 | **What this means — agent commentary** | 9:00–10:30 | Matt's analysis tying all data to actionable buyer + seller advice | Talking-head segment OR animated text overlay on B-roll |
| 10 | **CTA + closing card** | 10:30–11:15 | static | "Subscribe + comment" CTA → locked Ryan Realty closing card |

Total: ~11 minutes. Adjust ±90s based on data depth.

---

## 4. Composition scaffold

**Install target:** `/tmp/remotion-yt-{slug}-{YYYYMM}/`. Same Remotion 4.0.290 stack as short-form, but with `width={1920} height={1080}` and longer durations.

```tsx
// 11 scene blocks — each maps to a chapter from §3
import { Composition } from 'remotion'
import { YouTubeMarketReport } from './compositions/YouTubeMarketReport'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="YouTubeMarketReport"
    component={YouTubeMarketReport}
    durationInFrames={20250}      // 11:15 at 30fps
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ stats, photos, voPath, captionWords, chapters }}
  />
)
```

**Scene component pattern** mirrors `market-data-video/SKILL.md` §10 but at landscape dimensions. Reuse the same primitive components:
- `IntroBeat` (landscape variant — wider Amboqia title, scaled photo background)
- `StatBeat` (already supports `line_chart`, `gauge`, `histogram`, `multi_year_bars`, `leaderboard`, `takeaway`)
- `OutroBeat` (landscape variant)
- `KineticCaptions` (locked sentence-based caption renderer)

**Difference vs short-form:**
- Captions positioned at y 940–1040 (landscape safe zone), not 1480–1720
- Hero numbers larger (220px → 320px)
- Charts wider (W=920 → W=1620) so the multi-year line chart breathes
- Mid-roll talking-head segments — if Matt provides a recorded clip, embed via `<Video>` between chapters; otherwise use animated text + B-roll

---

## 5. VO spec (Victoria, narrative-only)

Same canonical settings as short-form (per `elevenlabs_voice/SKILL.md`):
- Voice: Victoria (`qSeXEcewz7tA0Q0qk9fH`)
- Model: `eleven_turbo_v2_5`
- Settings: stability 0.40, similarity 0.80, style 0.50, speaker_boost true
- One continuous synth call (no per-segment stitching)
- Captions sync locked to VO word timestamps (per `market-data-video/SKILL.md` §18)
- Narrative-only — VO does not recite numbers that are on screen (per `market-data-video/SKILL.md` §17)

**Scripted length:** ~1,400–1,800 words ÷ Victoria's 150 wpm = ~9–12 min. Keeps each chapter at the durations in §3.

**Per-chapter sentence templates** — same structure as short-form §17 but expanded with 2–3 additional sentences per chapter for depth. Long-form is allowed to interpret the data ("with concessions running at 3% of price, sellers are clearly making it work for buyers — that's a different posture than two years ago"). Short-form is not.

---

## 6. YouTube SEO metadata (required pre-upload)

Every long-form upload includes:

### 6.1 Title
- **Length:** ≤70 characters (YouTube truncates above 70)
- **Pattern:** `{City} Oregon Real Estate Market Report — {Month} {Year} | Ryan Realty`
- **Example:** `Bend Oregon Real Estate Market Report — April 2026 | Ryan Realty`
- **Keyword priority:** city → state → "real estate" → "market report" → period → brand

### 6.2 Description (first 200 chars are critical — show above the fold)
```
{Median price + verdict in plain English}. Full Bend market analysis for April 2026 — closed sales, median price, days on market, top neighborhoods, and what it means for buyers and sellers.

CHAPTERS:
0:00 Introduction
0:45 Median Sale Price + 4-Year Trend
2:00 Where the Action Is — Price Segments
3:15 Months of Supply + Market Verdict
4:15 Days on Market — Distribution
5:30 Sale-to-List + Seller Concessions
6:30 Cash Buyers + Affordability
7:45 Top Neighborhoods
9:00 What This Means — Agent Commentary
10:30 Get the Full Report

DATA SOURCES:
• Spark MLS API
• Supabase market_stats_cache (computed daily)
• Census Bureau, NAHB

📊 Read the full written report: https://ryan-realty.com/market-report/bend/2026-04
📩 Get monthly reports in your inbox: https://ryan-realty.com/subscribe
🏡 Search Bend homes for sale: https://ryan-realty.com/search/bend

— Matt Ryan, Principal Broker
   Ryan Realty | Bend, Oregon
   541.213.6706
   matt@ryan-realty.com

#BendOregon #RealEstate #BendOregon #MarketReport #CentralOregon
```

### 6.3 Tags (≤500 chars total, comma-separated)
```
bend oregon real estate, bend oregon market report, central oregon real estate,
bend oregon homes for sale, bend market report april 2026, bend oregon median home price,
deschutes county real estate, ryan realty, matt ryan, bend or, market analysis,
real estate market 2026, oregon real estate, bend median price, bend home sales
```

### 6.4 Thumbnail
- 1280×720 minimum
- Headline number featured BIG (e.g. "$699K" in Amboqia 200px)
- Bend skyline / mountain in background
- "Bend April 2026" eyebrow text
- Ryan Realty logo bottom-right

### 6.5 Chapters
- YouTube auto-detects chapters when descriptions include timestamps in `M:SS Title` format (matches §6.2 description block)
- First chapter MUST start at `0:00` exactly
- Each chapter ≥10 seconds (YouTube requirement)

### 6.6 End screens + cards
- **End screen** (last 20 seconds): subscribe button + "watch next" pointing at the previous month's report
- **Cards** at chapter transitions: link to the written blog post for any chapter the viewer wants more depth on

---

## 7. Upload flow

Upload via YouTube Data API v3:

```bash
POST /youtube/v3/videos?part=snippet,status,contentDetails
Authorization: Bearer {YT_OAUTH_TOKEN}
```

```json
{
  "snippet": {
    "title": "{title from §6.1}",
    "description": "{description from §6.2}",
    "tags": ["bend oregon real estate", "..."],
    "categoryId": "22",                 // People & Blogs
    "defaultLanguage": "en"
  },
  "status": {
    "privacyStatus": "private",         // upload as PRIVATE first
    "selfDeclaredMadeForKids": false,
    "embeddable": true,
    "publicStatsViewable": true
  }
}
```

**Then upload thumbnail** to the same video ID.

**Surface to Matt:**
```
YouTube long-form ready for review (PRIVATE):
https://youtu.be/{videoId}

On "go" → flip to PUBLIC + ping the channel subscribers.
```

**On Matt's "go":**
```bash
PATCH /youtube/v3/videos?part=status
{ "id": "{videoId}", "status": { "privacyStatus": "public" } }
```

This locks the publish-on-approval pattern from CLAUDE.md draft-first rule.

---

## 8. Pre-render QA gate

Run after the Remotion render, before YouTube upload:

- [ ] Duration in [8:00, 12:00] window
- [ ] First 30 seconds: hook + title card complete
- [ ] Every chapter has a corresponding timestamp in the description
- [ ] Captions burned in + SRT/VTT exported (`out/{slug}/captions.srt`)
- [ ] All numbers on screen trace to verified data sources
- [ ] No banned words in caption stream OR script
- [ ] Audio: no clipping, no silence gaps >3s, RMS levels match short-form
- [ ] Outro: Ryan Realty logo + phone (per `listing_reveal/SKILL.md` locked closing card)
- [ ] Thumbnail rendered (1280×720, headline number featured)
- [ ] All JSON-LD VideoObject fields populated for the blog embed

If any fail, halt and fix before upload.

---

## 9. Cross-references

This skill is the long-form sibling to `market-data-video/SKILL.md`. They share:
- The same data pull (cache-first, SFR-default)
- The same brand tokens (NAVY, GOLD, Amboqia, AzoSans, Geist)
- The same VO voice + settings
- The same chart layouts (line_chart, gauge, histogram, leaderboard)
- The same banned-word rules

They differ in:
- Resolution (1920×1080 vs 1080×1920)
- Duration (8–12 min vs 30–60s)
- Number of beats (10 chapters vs 7 beats)
- Caption position (y 940–1040 vs y 1480–1720)
- Hero number scale (320px vs 220px)

When updating shared rules (e.g. voice settings, brand colors, banned words), update the canonical source file (per `market-data-video/SKILL.md` §22) and let both skills reference it.

---

## 10. See also

- `video_production_skills/monthly-market-report-orchestrator/SKILL.md` — orchestrator that calls this skill
- `video_production_skills/market-data-video/SKILL.md` — short-form sibling + canonical data dictionary (§22 has every Supabase table + column the long-form video can pull from)
- `video_production_skills/media-sourcing/SKILL.md` — single decision skill for image / video / audio sources (cinematic motion via Kling, drone footage via Google 3D Tiles, ambient audio via Veo native or ElevenLabs SFX, etc.)
- `video_production_skills/elevenlabs_voice/SKILL.md` — canonical Victoria settings
- `video_production_skills/render_pipeline/SKILL.md` — canonical render command + concurrency rule
- `video_production_skills/captions/SKILL.md` — caption safe zone, sync, font
- `video_production_skills/quality_gate/SKILL.md` — pre-publish QA gate
- `video_production_skills/listing_reveal/SKILL.md` — locked closing-card spec (referenced for the outro)
- `video_production_skills/VIRAL_GUARDRAILS.md` — retention-curve research that informed the 8–12 min target
- `social_media_skills/blog-post/SKILL.md` — paired blog post that embeds this video
- YouTube Data API: https://developers.google.com/youtube/v3
