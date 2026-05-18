---
name: test-minimal-producer
description: Produces a single IG Reel from a market data snapshot for a given city. Triggered by content:test_minimal action_type.
action_types:
  - content:test_minimal
output_type: video
target_platforms:
  - ig_reel
  - fb_reel
asset_destination: out/test-minimal/
auto_inputs:
  - city name from action row target
  - market stats from Supabase market_stats_cache
required_inputs:
  - city slug (e.g. bend)
optional_inputs:
  - override_period (defaults to current month)
estimated_runtime_min: 10
cost_usd_estimate: $0.05-$0.20
thumbnail_uri: https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/test-minimal/thumb.jpg
example_outputs:
  - uri: https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/test-minimal/bend-2026-04.mp4
    label: Bend market reel April 2026
    surface: ig_reel
  - uri: https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/test-minimal/sisters-2026-03.mp4
    label: Sisters market reel March 2026
    surface: fb_reel
  - uri: https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/test-minimal/redmond-2026-02.mp4
    label: Redmond market reel February 2026
    surface: ig_reel
---

# Test Minimal Producer

**Scope:** Produces a 30-45s IG/FB Reel from a single city market data snapshot.
Pulls median price, days on market, and months of supply from Supabase.
Renders with Remotion and synthesizes VO via ElevenLabs Victoria voice.
Does NOT publish. Does NOT handle neighborhoods or subdivisions.
Use market-data-video for those surfaces.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** out/test-minimal/bend-2026-04/

---

## 1. What it makes

A 30-45s portrait (1080x1920) Reel containing:

- Hook overlay with city name and a lead stat (first 1.0s on screen).
- Three data beats: median price, days on market, months of supply.
- VO narrated by Victoria (ElevenLabs eleven_turbo_v2_5).
- Captions synced to forced-alignment timestamps.
- No logo. No brokerage name. No agent name. No phone number.

Output files:

```
out/test-minimal/<city>-<period>/
  reel.mp4
  citations.json
  scorecard.json
  contact-sheet.html
```

---

## 2. Input contract (auto / required / optional)

### Auto (pulled without asking Matt)

| field | source |
|---|---|
| city | action row `target` field (e.g. `city:bend`) |
| market stats | Supabase `market_stats_cache` WHERE city = slug AND period = current month |

### Required (Matt must supply or action row must contain)

| field | type | notes |
|---|---|---|
| city | string | slug: bend, redmond, sisters, sunriver, la-pine |

### Optional

| field | default | notes |
|---|---|---|
| override_period | current YYYY-MM | Override the stats period for reruns |

---

## 3. Tool stack (with cost and known bugs, citing tool-inventory.md)

Per tool-inventory.md:

| tool | purpose | env var | cost | known issues |
|---|---|---|---|---|
| Supabase MCP | Pull market stats + update action row | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | $0 | Row-level policy on market_stats_cache requires service role key |
| ElevenLabs API | VO synthesis via Victoria voice | ELEVENLABS_API_KEY | ~$0.05 per clip | turbo_v2_5 required for IPA phoneme tags |
| Remotion CLI | Video render | none (local) | $0 | concurrency=1 required to avoid Chrome OOM |
| ffmpeg | Post-process: audio mix, duration verify, blackdetect | PATH | $0 | Use static-ffmpeg symlink at listing_video_v4/node_modules |
| scripts/validate-producer.mjs | Self-validation before ship | none | $0 | Run before surfacing to Matt |

---

## 4. Platform stack (with format spec, citing platform-bible.md)

Per platform-bible.md:

| surface | aspect | length | hook | caption |
|---|---|---|---|---|
| ig_reel | 9:16 1080x1920 | 30-45s | Motion by frame 12 (0.4s) | Full-sentence, white Geist 500, no pill |
| fb_reel | 9:16 1080x1920 | 30-45s | Same as IG | Same spec |

No logo in frame. No brokerage name. No agent credit.

---

## 5. The recipe (end-to-end, testable)

**Step 1. Read the action row from Supabase.**
Query marketing_brain_actions by id. Confirm status is pending.
Immediately UPDATE status to in_production and executed_at to now() via Supabase MCP.

**Step 2. Load mandatory references.**
Before touching any deliverable, read:
CLAUDE.md §0 (Data Accuracy), CLAUDE.md §0.5 (Draft-First Commit-Last),
design_system/ryan-realty/SKILL.md, marketing_brain_skills/brand-voice/voice_guidelines.md,
marketing_brain_skills/research/tool-inventory.md,
marketing_brain_skills/research/platform-bible.md,
marketing_brain_skills/research/asset-library-map.md,
marketing_brain_skills/research/bend-market-bible.md,
automation_skills/content_engine/SKILL.md,
social_media_skills/platform-best-practices/SKILL.md,
video_production_skills/ANTI_SLOP_MANIFESTO.md,
video_production_skills/VIRAL_GUARDRAILS.md.

**Step 3. Pull and verify market stats from Supabase.**
Run via Supabase MCP:
```sql
SELECT city, period, median_list_price, median_dom, months_of_supply
FROM market_stats_cache
WHERE city = '<slug>' AND period = '<YYYY-MM>'
  AND property_type = 'A'
LIMIT 1;
```
If zero rows returned: surface blocker to Matt and set status to killed.
Print the raw result. Every figure in the deliverable must equal the figure in this row.
Compute months_of_supply verification: active_listings / (closed_last_6_months / 6).
Thresholds: under 4 is seller, 4-6 balanced, above 6 buyer.

**Step 4. Synthesize VO via ElevenLabs.**
POST to /v1/text-to-speech/{voice_id} with voice_id=qSeXEcewz7tA0Q0qk9fH,
model_id=eleven_turbo_v2_5, stability=0.40, similarity_boost=0.80, style=0.50,
use_speaker_boost=true. Chain previous_text across all lines.
Save to out/test-minimal/<city>-<period>/vo.mp3.
Then POST to /v1/forced-alignment to get word-level timestamps.
Save to out/test-minimal/<city>-<period>/alignment.json.

**Step 5. Render video via Remotion CLI.**
```bash
cd listing_video_v4
npx remotion render src/index.ts TestMinimal \
  out/../out/test-minimal/<city>-<period>/reel.mp4 \
  --codec h264 --concurrency 1 --crf 22 \
  --image-format=jpeg --jpeg-quality=92
```

**Step 6. Run QA gate.**
```bash
ffprobe -v error -show_entries format=duration out/.../reel.mp4
```
Confirm duration in 30-45s range.
Run ffmpeg blackdetect:
```bash
ffmpeg -i out/.../reel.mp4 -vf blackdetect=d=0.1:pix_th=0.05 -f null - 2>&1 | grep black_start
```
Zero results required.
Grep captions and VO script for banned words (ANTI_SLOP_MANIFESTO.md list).
Confirm no logo, no brokerage name, no agent name in any frame via keyframe extract.

**Step 7. Write citations.json.**
One entry per figure:
```json
[
  {
    "figure": "$475,000",
    "source": "Supabase market_stats_cache",
    "filter": "city='bend' AND period='2026-04' AND property_type='A'",
    "column": "median_list_price",
    "value": 475000,
    "fetched_at": "2026-05-17T10:00:00Z"
  }
]
```

**Step 8. Score against VIRAL_GUARDRAILS.md.**
Score 1-10 across all 10 categories. Minimum 80 for market data format.
Write scorecard.json next to the render.

**Step 9. Build contact-sheet.html.**
HTML page with embedded video player, verification trace table, and approval prompt.
Follow contact-sheet spec in TEMPLATE.md §6.

**Step 10. UPDATE action row to ready.**
```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/test-minimal/...", "scorecard": {...}}'::jsonb
WHERE id = '<action_id>';
```

**Step 11. Surface to Matt.**
Print the contact-sheet path and wait for explicit approval before committing anything.

---

## 6. Asset library wiring (storage path, naming convention, reuse query, citing asset-library-map.md)

Per asset-library-map.md:

Storage bucket: Supabase asset-library at social-drops/<period>/<city>-market-reel/reel.mp4.

Local scratch path: out/test-minimal/<city>-<YYYY-MM>/ (gitignored).

After Matt approves, copy to public/v5_library/<city>/market-<period>.mp4 and register in
data/asset-library/manifest.json with tags: [market, city:<slug>, period:<YYYY-MM>, surface:ig_reel].

Reuse query before rendering fresh:
```
"Has this city had a market reel in the last 30 days?"
SELECT * FROM asset_library WHERE tags @> ARRAY['city:bend', 'market']
  AND created_at > now() - interval '30 days';
```
If a recent reel exists, surface it to Matt for potential repurpose instead of full render.

---

## 7. Publishing flow (platforms in order, scheduling, OAuth status)

1. Matt approves via contact sheet reply.
2. Producer calls automation_skills/automation/publish/SKILL.md publisher.
3. Publisher posts to ig_reel via Meta Graph API (token in FACEBOOK_PAGE_TOKEN).
4. Publisher posts to fb_reel via same page token.
5. Scheduling: post within 24h of approval unless Matt specifies a scheduled_for time.
6. OAuth status: Meta Page Token active per API_INVENTORY.md (verified 2026-05-06).

---

## 8. QA gate (format-specific checks)

Per video_production_skills/VIRAL_GUARDRAILS.md and ANTI_SLOP_MANIFESTO.md:

- Duration: 30-45s (ffprobe check).
- No black frames (ffmpeg blackdetect strict pix_th=0.05).
- Motion at frame 0 (no static first frame).
- On-screen text by frame 30 (1.0s).
- No logo, no Ryan Realty text, no phone anywhere.
- No banned words in VO script or captions.
- All numbers carry units.
- citations.json present with one entry per figure.
- scorecard.json present with score above 80.
- File under 100 MB.
- h264 codec, aac audio, faststart flag.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| Zero rows from market_stats_cache | Query returns empty | Surface to Matt: which city, which period, no data available. Set status to killed. |
| ElevenLabs 429 rate limit | HTTP 429 on TTS call | Retry once after 5s. If still failing, surface to Matt with the error. |
| Remotion OOM | Process killed during render | Reduce concurrency (already at 1). Close other Chrome instances. Report to Matt. |
| Blackdetect hit | ffmpeg reports black_start | Inspect the flagged timestamp. Fix the composition transition. Re-render. Max 2 auto-iterations. |
| Score below 80 | scorecard.json total under 80 | Identify lowest-scoring categories. Fix hook or retention structure. Re-render. Max 2 iterations. |
| Banned word in VO | Grep hit on ANTI_SLOP_MANIFESTO list | Rewrite the VO line. Re-synthesize. Never ship with a banned word. |

---

## 10. Mandatory references

All of these must be read in full before executing this producer:

- CLAUDE.md §0 (Data Accuracy, outranks everything)
- CLAUDE.md §0.5 (Draft-First, Commit-Last, outranks everything)
- design_system/ryan-realty/SKILL.md (brand visual system)
- marketing_brain_skills/brand-voice/voice_guidelines.md (voice enforcement)
- marketing_brain_skills/research/tool-inventory.md (tool capabilities and costs)
- marketing_brain_skills/research/platform-bible.md (2026 platform specs)
- marketing_brain_skills/research/asset-library-map.md (storage and reuse)
- marketing_brain_skills/research/bend-market-bible.md (Central Oregon market context)
- automation_skills/content_engine/SKILL.md (content routing bus)
- social_media_skills/platform-best-practices/SKILL.md (2026 platform rule layer)
- video_production_skills/ANTI_SLOP_MANIFESTO.md (banned content gate)
- video_production_skills/VIRAL_GUARDRAILS.md (scorecard and format minimums)

---

## 11. Tool gap suggestions (what would make this 10x better)

1. Kling v2.1 Master via Replicate: animate the stats card as a cinematic reveal instead
   of a static text overlay. Cost: ~$0.10 per 5s clip. Impact: retention at 50% mark
   would likely improve 15-25 points on the viral scorecard.

2. Mapbox static satellite tile for the city: gives a geographic anchor in the hook frame.
   Currently using a stock photo. A real aerial of Bend is more specific and credible.
   Cost: under $0.01 per tile. Impact: differentiation from generic market content.

3. Automated A/B caption variant: render two versions of the hook text (stat-first vs
   question-first) and let the platform algorithm select the winner. Currently we ship
   one variant. Impact: 10-20% engagement lift based on platform-best-practices.md data.
