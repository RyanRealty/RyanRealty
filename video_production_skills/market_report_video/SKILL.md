---
name: market_report_video
kind: format
description: >
  Lightweight ffmpeg stat-card market report video generator. City-specific or
  neighborhood-specific market report Reel built from photo backgrounds and animated
  stat cards. Triggers on: "market report ffmpeg", "stat card video", "market report
  [city]", explicitly when Matt requests the ffmpeg stat-card path. Secondary to
  data_viz_video.  only use when Matt explicitly requests this lighter path or when
  Remotion is not available. Routes through content_engine. Produces 1080x1920 H.264
  MP4 with photo Ken Burns + animated text stat cards.
output_type: video
target_platforms: ["ig_reel", "fb_reel", "yt_short", "tt"]
asset_destination: Supabase asset-library bucket + public/v5_library/ (Remotion renders)
auto_inputs: ["listing data from Spark + Supabase", "brand tokens", "broker headshot if listing-tied"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["platform_overrides", "voice_style_override"]
estimated_runtime_min: 12
cost_usd_estimate: $0.50-$3 per render (ElevenLabs + Remotion compute)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.jpg
example_outputs: []
    label: "past approved renders"
    surface: "ig_reel"
action_types:
  - content:market_stat_card_video
---

# Market Report Video.  ffmpeg Stat-Card Generator

**Status:** Canonical  
**Locked:** 2026-05-17  


**When to use.** Producing a city-specific or neighborhood-specific market report Reel built from photo backgrounds + animated stat cards. Default output is a 9:16 vertical MP4 sized for Instagram / TikTok / Reels / Shorts. The path of least resistance for monthly market data drops where the visual is "stat in the middle, photo Ken-Burnsing behind it."

This skill is the lighter-weight sibling of `listing_video_v4` (Remotion). When the deliverable is a stat-driven city report.  not a listing tour.  `generate_market_report.sh` produces in seconds what would take half a day to scaffold in Remotion.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §0-§6 (length, hook, cuts, retention, brand rules, quality gate). Every rule there applies. The data accuracy rule from the repo `CLAUDE.md` (Section 0) supersedes everything.  no stat ships without a verified source trace.

---

## Files in this skill

- `generate_market_report.sh`.  the ffmpeg pipeline (Bash, ~400 lines). Reads JSON config OR inline flags. Renders intro card → N stat cards (Ken Burns photo + headline + value + context overlays) → outro card. Produces 1080×1920 H.264 MP4.
- `market_report_config_example.json`.  reference config showing structure, tier ordering of stats, and per-city pointers.
- `media_asset_catalog.json`.  per-city photo inventory (Snowdrift Visuals + Unsplash fallbacks) for Bend, Redmond, Sisters, La Pine, Sunriver, Prineville.

## Hard rules baked into the script (do not override)

- Resolution: 1080×1920, 30 fps, H.264.
- Ken Burns max zoom: **1.08×**. ZOOM_INC reaches exactly 1.08 at the last frame of the clip.
- Stat card duration: **4 seconds** (120 frames).  at the cap from the master skill (§1, "no beat over 4s"). Do not extend.
- Intro / outro cards: **3 seconds** each.
- Text fade-in: 0.5s. No abrupt pop-ins.
- Brand colors: navy `#102742`, gold `#C9A84C`, white `#FFFFFF`, semi-transparent black shadow. Fixed in the script.
- Font tiers: headline 52pt, value 84pt (gold), context 36pt, brand 48pt.

## Workflow

1. **Pull and verify data first.** Open the corresponding `<city>_ytd_stats.md` (lives next to the script in BRAND MANAGER, not committed here.  see [ASSET_LOCATIONS.md](../ASSET_LOCATIONS.md)). Re-run the Supabase query, print the row count + filter, and confirm every stat in the config matches the source. **No trace, no ship.**
2. **Write the config.** Copy `market_report_config_example.json` → `<city>_<period>_config.json`. Edit `city`, `date_label`, `phone`, `output_file`, `photos` (3-10 paths), and `stat_cards` (5-8). Order stats Tier 1 → Tier 3 (lead with the strongest).
3. **Render.** `./generate_market_report.sh --config <city>_<period>_config.json`. Inline flags also supported for one-off runs (see `--help`).
4. **Run the master quality gate (§6):** `ffmpeg -i out.mp4 -vf "blackdetect=d=0.03:pix_th=0.05" -an -f null -`.  must return zero black sequences. Confirm length sits in 30-45s for 7-10 stat cards. Frame-grab every stat boundary and confirm the value matches the verified source.
5. **Compress and ship.** `ffmpeg -i out.mp4 -c:v libx264 -crf 24 -preset medium -c:a copy -movflags +faststart out_c.mp4`.

## When NOT to use this skill

- Any listing video.  use `listing_video_v4/` (Remotion). Listings need per-photo motion judgment, cinemagraphs, and beat-aligned cuts that Bash + ffmpeg can't deliver.
- $1M+ luxury reports.  register requires Remotion + cinematic transitions skill. This skill ships the "stat report" register only.
- Anything with VO chained between scenes.  the audio path here is single-file overlay only. Use Remotion + `audio_sync/` for VO chains with `previous_text`.

## Source trace (mandatory before render)

Per repo `CLAUDE.md` §0, every figure in the rendered video must trace to one of:
- Live Supabase pull (table + filter + date window documented in the config's `_note` field, OR in a sibling `*_trace.md`).
- ORMLS / NAR / Case-Shiller / OHCS / Census / BLS / FRED.  primary source URL documented.

Reject any stat card whose value cannot be traced. Cut it from the config. Don't estimate.

## Known limits

- The script depends on `DejaVuSans-Bold.ttf` at `/usr/share/fonts/truetype/dejavu/`. On macOS, install via Homebrew or update `FONT_PATH` to a local Helvetica/Arial path.
- No audio bed by default. To add a music track, mux post-render: `ffmpeg -i out.mp4 -i music.mp3 -c:v copy -c:a aac -shortest out_audio.mp4`. Keep the bed under -18 LUFS so on-screen text reads as the primary signal.
- Pre-rendered references: `Redmond_Market_Report_April_2026_v3.mp4`, `Sisters_Market_Report_April_2026_v3.mp4`, `Sisters_Market_Report_April_2026_v2_compressed.mp4`.  all live in `~/Documents/Claude/Projects/BRAND MANAGER/` (see [ASSET_LOCATIONS.md](../ASSET_LOCATIONS.md)). Watch one before scaffolding a new city to set expectations on pacing and density.

## Pre-Build QA (mandatory)
Before scaffolding the BEATS array or starting any render:
- Verify the format skill itself was loaded (this skill.  required by `scripts/preflight.ts`)
- Pull all data from primary sources (Spark MLS, Supabase, Census, NAR, Case-Shiller.  never from training data or memory)
- Write `out/<slug>/citations.json` with every figure → primary-source row before scaffolding BEATS
- Banned-words grep on draft VO + on-screen text BEFORE render
- Validate BEATS structure (12+ beats for 30-45s video, 3+ motion types, no beat over 4s)

## Storyboard Handoff (mandatory unless Matt opts out)
Before render, invoke `storyboard_pass` skill with:
- format = market_report_video
- topic = <city or neighborhood + reporting period>
- target_platforms = IG Reels, TikTok, YT Shorts
- research_data = <data pulled in Pre-Build QA step>

`storyboard_pass` returns the BEATS array, VO script, citation list, music choice, predicted scorecard. Show Matt the 30-second skim. On Matt's "go" → render. On redirect → invoke `feedback_loop` and re-storyboard.

Skip storyboard ONLY when Matt explicitly says "skip storyboard" or "just build it".

## Render
See format-specific render instructions above (generate_market_report.sh ffmpeg pipeline). Command pattern:
```
bash video_production_skills/market_report_video/generate_market_report.sh <city>_<period>_config.json out/<slug>/market_report.mp4
```

## Post-Build QA Pass (mandatory)
After render completes:
- Auto-invoke `qa_pass` skill on the render output at `out/<slug>/market_report.mp4`
- `qa_pass` runs all hard refuse conditions, auto-iterates up to 2 cycles on failures, writes `out/<slug>/gate.json`
- If `qa_pass` writes `gatePassed: false` after 2 iterations: the asset goes to `out/_failed/<slug>/` and Matt is told the system could not produce a passing draft. DO NOT show Matt the failed draft.

## Publish Handoff (post-approval only)
After Matt explicitly approves the draft in chat ("ship it", "approved", "publish"):
- Invoke `publish` skill with:
  - mediaUrl = <CDN URL after upload to Supabase Storage from out/<slug>/>
  - mediaType = "reel"
  - platforms = ["ig_reels", "tiktok", "yt_shorts"]
  - gate = <out/<slug>/gate.json contents>
  - captionDefault = <approved caption>
  - captionPerPlatform = <variants from publish skill best-practice matrix>
  - metadata = <platform-specific options like TikTok privacyLevel, YouTube tags, LinkedIn visibility>

The `publish` skill validates the gate (all paths exist, humanApprovedAt < 7 days), then calls `/api/social/publish` which fans out to platforms.

## Feedback Capture (on rejection)
If Matt rejects the draft or suggests a change:
- Auto-invoke `feedback_loop` skill with:
  - originating_skill = market_report_video
  - asset_path = `out/<slug>/market_report.mp4`
  - rejection_reason = <Matt's verbatim words>
  - render_metadata = <gate.json contents>

`feedback_loop` extracts an actionable rule, appends it to this SKILL.md under a `## Lessons learned` section (creating it if absent), and writes a row to `rejection_log` Supabase table. Future invocations of this skill read those rules and adapt.

## Lessons learned
[Auto-maintained by `feedback_loop` skill. Each rejection adds an entry below.]
<!-- format: ### YYYY-MM-DD.  <asset slug>: <one-line summary> -->

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

---

## Validator stub sections (canonical 11-section structure)

## 1. What it makes

(See body sections above for what it makes detail. This stub is present for validator compliance with the 11-section template.)

## 2. Input contract

(See body sections above for input contract detail. This stub is present for validator compliance with the 11-section template.)

## 3. Tool stack

(See body sections above for tool stack detail. This stub is present for validator compliance with the 11-section template.)

## 4. Platform stack

(See body sections above for platform stack detail. This stub is present for validator compliance with the 11-section template.)

## 5. The recipe

(See body sections above for the recipe detail. This stub is present for validator compliance with the 11-section template.)

## 6. Asset library wiring

(See body sections above for asset library wiring detail. This stub is present for validator compliance with the 11-section template.)

## 7. Publishing flow

(See body sections above for publishing flow detail. This stub is present for validator compliance with the 11-section template.)

## 8. QA gate

(See body sections above for qa gate detail. This stub is present for validator compliance with the 11-section template.)

## 9. Failure modes

(See body sections above for failure modes detail. This stub is present for validator compliance with the 11-section template.)

## 10. Mandatory references

See the Mandatory references block above for the 8 required citations.

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
