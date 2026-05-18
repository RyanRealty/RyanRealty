---
name: market_pulse_short
description: Produces a 9-15 second weekly market data short for a chosen geography (city, neighborhood, or subdivision), showing median price, DOM, and months of supply, with ElevenLabs Victoria VO and Remotion animation, targeting IG Reels, TikTok, and YouTube Shorts.
action_types:
  - content:market_pulse_short
output_type: video
target_platforms: ['ig_reel', 'fb_reel', 'tt', 'yt_short']
asset_destination: data/asset-library/manifest.json and Supabase asset-library bucket per asset-library-map.md §2
auto_inputs: [market stats from Supabase market_pulse_live and market_stats_cache]
required_inputs: [geography_type, geography_slug]
optional_inputs: [reference_date (default: most recent week), property_type (default: A for SFR)]
estimated_runtime_min: 8
cost_usd_estimate: $0.00 (Supabase only) + ElevenLabs VO per char
thumbnail_uri: out/proof/2026-05-17/exemplars/market_pulse_short/sample.jpg
example_outputs: []
    label: Bend SFR weekly pulse (9:16, 12s)
    surface: ig_reel
  - uri: out/proof/2026-05-17/exemplars/market_pulse_short/redmond_srf_weekly_9x16.mp4
    label: Redmond SFR weekly pulse (9:16, 10s)
    surface: tiktok
  - uri: out/proof/2026-05-17/exemplars/market_pulse_short/northwest_crossing_weekly_9x16.mp4
    label: NW Crossing neighborhood weekly pulse (9:16, 11s)
    surface: yt_short
---

# Market Pulse Short Producer

**Scope:** This producer builds ultra-short (9-15 second) weekly market data videos for a single geography, displaying three key metrics: median sale price, median days on market (DOM), and months of supply (MoS). It targets the `content:market_pulse_short` action type only. It does NOT produce full monthly market reports (monthly-market-report-orchestrator handles that). It does NOT include listings photography or property-level data. It does NOT produce long-form YouTube market reports (youtube-long-form-market-report handles that). The ultra-short format is designed for feed algorithm feed-through and high-frequency posting cadence (weekly), not deep narrative. Data accuracy is absolute: every figure traces to a live Supabase query with the MoS formula and thresholds enforced per CLAUDE.md §0.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/proof/2026-05-17/exemplars/market_pulse_short/`

---

## 1. What it makes

A single 9-15 second 1080x1920 portrait MP4 per geography per week. The video contains:

**Beat 1 (0-3s):** Hook frame. Location name animates in with Amboqia Boriango display type on navy background. One line: "[City / Neighborhood] Market Pulse."

**Beat 2 (3-7s):** Three stat cards animate in sequentially (stagger 0.5s each). Each card shows metric label (Geist 400) and value (Amboqia display). Cards use cream pill on navy background.
- Median Sale Price: `$XXX,000`
- Days on Market: `XX days`
- Months of Supply: `X.X mo`

**Beat 3 (7-12s):** Market verdict pill animates in. Verdict is determined by MoS thresholds per CLAUDE.md §0:
- MoS less than or equal to 4.0 = "Seller's Market" (navy pill, cream text)
- MoS 4.1-6.0 = "Balanced Market" (cream pill, navy text)
- MoS greater than or equal to 6.1 = "Buyer's Market" (navy pill, gold `#faf8f4` text)

ElevenLabs Victoria VO runs across all three beats. VO carries narrative context, not number recitation (per market-data-video SKILL.md §17 narrative-only rule). Numbers appear on screen; VO carries the meaning.

Burned-in captions synced to forced-alignment timestamps.

---

## 2. Input contract (auto / required / optional)

### Auto-resolved

| field | source | method |
|---|---|---|
| `median_sale_price` | Supabase `market_pulse_live` or `market_stats_cache` | SELECT filtered by geography and reference_date |
| `median_dom` | Same tables | Same query |
| `months_of_supply` | Computed from `active_listings` / (`closed_last_6_months` / 6) | Formula applied to raw counts from Supabase |
| `active_listings` | Supabase `market_pulse_live`.`active_count` or `listings` count | SELECT WHERE StandardStatus='Active' |
| `closed_last_6_months` | Supabase `listings` | COUNT WHERE CloseDate in last 6 months AND property_type filter |

### Required

```typescript
interface MarketPulseShortPayload {
  geography_type: "city" | "neighborhood" | "subdivision"; // determines which filter to apply
  geography_slug: string; // e.g. "bend", "northwest-crossing", "tetherow"
}
```

### Optional

```typescript
interface MarketPulseShortOptions {
  reference_date?: string;       // ISO date; default: most recent Sunday (week ending)
  property_type?: string;        // default: "A" (SFR only, per CLAUDE.md data accuracy rules)
  include_yoy?: boolean;         // default: false (adds YoY arrow to each stat if true)
}
```

---

## 3. Tool stack (cite tool-inventory.md)

Per `marketing_brain_skills/research/tool-inventory.md`:

| tool | purpose | env var / path | status |
|---|---|---|---|
| Supabase MCP (`execute_sql`) | Pull market stats from `market_pulse_live` and `market_stats_cache` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Active |
| Remotion (`npx remotion render`) | Animate stat cards, verdict pill, VO sync | `cd listing_video_v4` | Active |
| ElevenLabs API (`/v1/text-to-speech`, `/v1/forced-alignment`) | Victoria VO synthesis + word timestamps | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH` | Active |
| ffmpeg (static-ffmpeg) | Mux audio + video | PATH via static-ffmpeg symlink | Active |
| `lib/asset-library.mjs` | Register render in asset library | local lib | Active |

No external API calls beyond Supabase and ElevenLabs. All market data comes from the verified Supabase tables per CLAUDE.md §0.

---

## 4. Platform stack (cite platform-bible.md)

Per `marketing_brain_skills/research/platform-bible.md`:

| platform | section | key constraints |
|---|---|---|
| Instagram Reels | §2 | 9:16, 9-15s, hook by 0.4s, no logo in frame for viral variant, captions required |
| Facebook Reels | §6 | 9:16, same rules as IG Reels |
| TikTok | §10 | 9:16, hook by 0.4s, captions required, geo hashtags in caption |
| YouTube Shorts | §12 | 9:16, max 60s (well within 9-15s), no watermark |

Logo in frame: per platform-bible.md §26, no Ryan Realty logo or text in any frame of the viral short. The brand is carried by the visual system (navy/cream palette, Amboqia display type) and the account handle `@ryanrealtybend`.

---

## 5. The recipe (end-to-end testable, numbered steps with exact tool calls)

**Step 1. Read and validate the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2. Load mandatory references**

Before any data query or render:
- `CLAUDE.md` §0 (Data Accuracy) and §1.5 (MoS formula and thresholds) and §0.5 (Draft-First)
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `video_production_skills/elevenlabs_voice/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
- `video_production_skills/market-data-video/SKILL.md` §22 (Supabase data dictionary for market stats tables)

**Step 3. Pull market stats from Supabase (live query required)**

For city-level:

```sql
SELECT
  mp.median_sale_price,
  mp.median_dom,
  mp.active_count,
  mp.reference_date,
  mp.geography_slug
FROM market_pulse_live mp
WHERE mp.geography_slug = '<geography_slug>'
  AND mp.property_type = '<property_type>'
ORDER BY mp.reference_date DESC
LIMIT 1;
```

If `market_pulse_live` returns 0 rows for this geography, fall back to `market_stats_cache`:

```sql
SELECT
  msc.median_close_price,
  msc.median_days_on_market,
  msc.active_listings,
  msc.period_end
FROM market_stats_cache msc
WHERE msc.geography = '<geography_slug>'
  AND msc.property_type = '<property_type>'
ORDER BY msc.period_end DESC
LIMIT 1;
```

Record which table was queried in `citations.json`.

**Step 4. Compute months of supply**

Per CLAUDE.md §0 mandatory formula: `MoS = active_listings / (closed_last_6_months / 6)`.

Query for closed_last_6_months if not in the cached tables:

```sql
SELECT COUNT(*) AS closed_6mo
FROM listings
WHERE "City" = '<city>'
  AND "PropertyType" = '<property_type>'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= (CURRENT_DATE - INTERVAL '6 months')
  AND "CloseDate" < CURRENT_DATE;
```

Compute: `MoS = active_listings / (closed_6mo / 6.0)`. Round to 1 decimal place.

Determine verdict:
- MoS less than or equal to 4.0: "Seller's Market"
- MoS 4.1-6.0: "Balanced Market"
- MoS greater than or equal to 6.1: "Buyer's Market"

Verify verdict pill text matches MoS value before rendering. A "Seller's Market" pill next to 4.3 months is a data compliance failure per CLAUDE.md §0 reconcile-narrative-to-data rule.

Write MoS computation to `citations.json`:

```json
{
  "figure": "2.1 mo",
  "source": "Computed: Supabase listings",
  "filter": "City='<city>' PropertyType='<property_type>' CloseDate past 6 months + active_listings from market_pulse_live",
  "formula": "active_listings / (closed_6mo / 6)",
  "active_listings": <N>,
  "closed_6mo": <N>,
  "value": 2.1,
  "fetched_at": "<iso>"
}
```

**Step 5. Round currency per brand rules**

Median sale price rounds to the nearest thousand: `$474,500` becomes `$475,000`, displayed as `$475K` in the on-screen pill (or `$475,000` if under 1M). Per CLAUDE.md brand voice: round to nearest thousand, never change the narrative. Never display `$500K` if actual is `$474,500`.

**Step 6. Write VO script (narrative-only)**

Template for a Seller's Market geography:
- Line 1 (hook): "[City] is still moving fast this week."
- Line 2 (MoS context): "With just [X.X] months of supply, buyers have limited options and sellers hold the advantage."
- Line 3 (CTA): "Ask us what is active in [city] right now."

For Balanced Market:
- Line 1: "[City] is finding its balance."
- Line 2: "At [X.X] months of supply, buyers and sellers are on more equal footing than they have been."

For Buyer's Market:
- Line 1: "[City] has shifted. More inventory, more negotiating room."
- Line 2: "At [X.X] months of supply, buyers have options worth exploring."

Note: VO does not recite median price or DOM dollar amounts that are already on screen (narrative-only rule). MoS is mentioned in VO because it contextualizes the verdict, and VO is the interpretation layer.

Brand voice check per `marketing_brain_skills/brand-voice/voice_guidelines.md`: no em-dashes, no banned words, no exclamation marks in body, sentence case for all lines.

**Step 7. Synthesize VO with Victoria**

Per `video_production_skills/elevenlabs_voice/SKILL.md`:

```json
{
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.40,
    "similarity_boost": 0.80,
    "style": 0.50,
    "use_speaker_boost": true
  }
}
```

Chain with `previous_text`. Save MP3 to `out/market_pulse_short/<slug>/vo.mp3`. Save forced-alignment to `vo_alignment.json`.

**Step 8. Render with Remotion**

```bash
cd /Users/matthewryan/RyanRealty/listing_video_v4
npx remotion render src/index.ts MarketPulseShort \
  out/market_pulse_short/<slug>/market_pulse_9x16.mp4 \
  --codec h264 \
  --concurrency 1 \
  --crf 22 \
  --image-format=jpeg \
  --jpeg-quality=92 \
  --props '{"geographyLabel":"<label>","medianPrice":"$<XXX>K","medianDom":"<N> days","monthsOfSupply":"<X.X> mo","verdict":"<Seller|Balanced|Buyer>'\''s Market","voMp3":"out/market_pulse_short/<slug>/vo.mp3","alignment":"out/market_pulse_short/<slug>/vo_alignment.json"}'
```

**Step 9. Run QA gate, register in asset library, surface draft**

Per §8. Write `citations.json` and `scorecard.json`. Register in asset library. Update action row to 'ready'. Surface per §6.

---

## 6. Asset library wiring (cite asset-library-map.md)

Per `marketing_brain_skills/research/asset-library-map.md`:

- **Draft location:** `out/market_pulse_short/<geography_slug>_<date>/` (gitignored).
- **After approval:** Supabase Storage `asset-library` at `market-pulse-short/<date>/<geography_slug>/market_pulse_9x16.mp4`.
- **Manifest entry:** `lib/asset-library.mjs register()` with `geography_slug`, `reference_date`, `median_price`, `median_dom`, `mos`, `verdict`, `created_at`.

---

## 7. Publishing flow

1. Matt approves.
2. Content engine publishes to IG Reel first (primary), then FB Reel.
3. TikTok and YouTube Shorts queued via `post_scheduler` (TikTok OAuth: check status; YT OAuth: active).
4. Caption written per platform-bible.md §2 (IG Reels) and §10 (TikTok): geography name + market condition statement + 3-5 geo hashtags (e.g. #BendOregon #BendRealEstate #CentralOregon). No exclamation marks.
5. Scheduling: weekly post. Optimal window per platform-bible.md: Tue-Fri 7-9am PT or 6-8pm PT for IG. TikTok: Tue 7-9am PT or Fri 5-7pm PT.
6. Posting cadence: one geography per week per platform. The brain's `market_trigger` automation emits the `content:market_pulse_short` action row on the Monday or Tuesday morning cron.

---

## 8. QA gate (format-specific checks)

| check | pass condition | tool |
|---|---|---|
| Duration | 9-15s | ffprobe |
| Codec | h264 video, aac audio | ffprobe |
| Black frames | 0 sequences (pix_th=0.05) | ffmpeg blackdetect |
| File size | Under 100 MB | stat |
| Aspect ratio | 1080x1920 | ffprobe |
| Verdict pill matches MoS | Seller's if MoS<=4.0, Balanced if 4.1-6.0, Buyer's if >=6.1 | automated check: compute MoS from citations.json and compare to verdict string in props |
| Numbers carry units | Price shows "$" and "K" or full dollar sign, DOM shows "days", MoS shows "mo" | grep rendered frame props |
| Banned words | 0 hits | grep VO script and on-screen strings |
| No logo in frame | 0 occurrences of Ryan Realty logo/text/phone | frame scrub |
| citations.json | MoS formula entry, active_listings, closed_6mo, median_price source, median_dom source | file valid, required fields present |
| Contact sheet | HTML with video embedded, verification trace table | file exists |

Viral scorecard minimum: 80. Write `scorecard.json`. For a pure data short under 15s, hook engineering is critical: stat-reveal by 1.0s earns 10% more scroll-stop than text-only hooks per VIRAL_GUARDRAILS.md.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| market_pulse_live 0 rows | Geography not in live table | Fall back to market_stats_cache. If also 0 rows, surface to Matt: "No market data found for <geography>. This geography may not be in the cache yet." Kill action row. |
| Fewer than 10 closed sales in 6-month window | Low-confidence MoS | Surface to Matt: "Only <N> closed SFR sales in <geography> over the last 6 months. MoS computed from a thin sample. Recommend combining with adjacent geography or skipping this week." Do not ship a low-confidence MoS without Matt's sign-off. |
| MoS verdict mismatch | Computed MoS 4.2 but verdict string says "Seller's Market" | Auto-fix: recompute verdict from MoS value and update props. Re-render. |
| ElevenLabs 429 | Rate limit during VO synthesis | Retry after 30s x 3. If still failing, generate video without VO, flag in contact sheet. |
| Remotion prop validation error | Component crashes on unexpected prop format | Log the exact prop sent and the error message. Surface to Matt. |
| Banned word in VO | Grep hit | Auto-fix with voice_guidelines.md approved phrasing. Re-validate. 2 auto-fix attempts max, then surface to Matt. |
| QA fails after 2 iterations | Specific failure | Surface to Matt with failure reason, scorecard, frame. Kill action row. |

---

## 10. Mandatory references

1. `CLAUDE.md` §0 (Data Accuracy) - MoS formula enforced; every figure traces to a live Supabase query; verdict pill must match MoS number per thresholds.
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last) - render to `out/`; no commit until Matt's explicit approval.
3. `design_system/ryan-realty/SKILL.md` - navy/cream palette, Amboqia display for stat cards and hook, Geist body for labels, no logo in viral variants.
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - VO script enforcement; no banned words; no "approximately" for market stats; sentence case.
5. `marketing_brain_skills/research/tool-inventory.md` - Supabase MCP (Active), ElevenLabs (Active, ~99k chars remaining per API_INVENTORY.md).
6. `marketing_brain_skills/research/platform-bible.md` - §2 IG Reels spec; §10 TikTok spec; §12 YouTube Shorts spec; §26 logo-is-a-closer doctrine.
7. `marketing_brain_skills/research/asset-library-map.md` - storage destination, manifest path, object naming conventions.
8. `marketing_brain_skills/research/bend-market-bible.md` - geography slugs, city boundaries, neighborhood context for VO narrative.
9. `automation_skills/content_engine/SKILL.md` - all content:* actions route through here; this producer is dispatched by the engine.
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer; weekly cadence, no-logo rule, caption formats.
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate; ElevenLabs Victoria only; source-verified data only.
12. `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard minimum 80; scorecard.json per render; hook engineering at 0.4s and 1.0s.

Additional references:
- `video_production_skills/elevenlabs_voice/SKILL.md` - Victoria voice ID `qSeXEcewz7tA0Q0qk9fH`, stability 0.40, similarity 0.80, style 0.50.
- `video_production_skills/market-data-video/SKILL.md` §22 - Supabase data dictionary (market_pulse_live, market_stats_cache column reference).
- `marketing_brain_skills/producers/REGISTRY.md` - Section B row `market_pulse_short`, action_type `content:market_pulse_short`.

---

## 11. Tool gap suggestions

| gap | current workaround | suggested improvement |
|---|---|---|
| market_pulse_live not populated for all geographies | Fall back to market_stats_cache | Expand `market_trigger` nightly cron to populate market_pulse_live for all neighborhoods in bend-market-bible.md, not just cities |
| YoY stat comparison | Optional flag, off by default | When include_yoy=true, add signed arrow (up or down) per CLAUDE.md format (`+2.1% YoY`); pull prior-year same-week from market_stats_cache |
| Weekly cadence management | Brain's market_trigger emits rows; no dedup | Add a check in step 1: query marketing_brain_actions for any `content:market_pulse_short` with same geography_slug executed within the last 6 days; skip if found to prevent duplicate weekly posts |
| TikTok OAuth gap | TikTok OAuth table empty as of 2026-05-16 | Complete TikTok OAuth at `/api/tiktok/authorize/`; then route market_pulse_short to TikTok in step 3 of publishing flow |
| Ultra-short format scorecard calibration | Default 80 minimum | Consider a market_pulse_short-specific scorecard template in VIRAL_GUARDRAILS.md that weights hook and data-accuracy heavier for the 9-15s format |

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
