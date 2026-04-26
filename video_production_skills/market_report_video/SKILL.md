# Market Report Video — ffmpeg Stat-Card Generator

**When to use.** Producing a city-specific or neighborhood-specific market report Reel built from photo backgrounds + animated stat cards. Default output is a 9:16 vertical MP4 sized for Instagram / TikTok / Reels / Shorts. The path of least resistance for monthly market data drops where the visual is "stat in the middle, photo Ken-Burnsing behind it."

This skill is the lighter-weight sibling of `listing_video_v4` (Remotion). When the deliverable is a stat-driven city report — not a listing tour — `generate_market_report.sh` produces in seconds what would take half a day to scaffold in Remotion.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §0–§6 (length, hook, cuts, retention, brand rules, quality gate). Every rule there applies. The data accuracy rule from the repo `CLAUDE.md` (Section 0) supersedes everything — no stat ships without a verified source trace.

---

## Files in this skill

- `generate_market_report.sh` — the ffmpeg pipeline (Bash, ~400 lines). Reads JSON config OR inline flags. Renders intro card → N stat cards (Ken Burns photo + headline + value + context overlays) → outro card. Produces 1080×1920 H.264 MP4.
- `market_report_config_example.json` — reference config showing structure, tier ordering of stats, and per-city pointers.
- `media_asset_catalog.json` — per-city photo inventory (Snowdrift Visuals + Unsplash fallbacks) for Bend, Redmond, Sisters, La Pine, Sunriver, Prineville.

## Hard rules baked into the script (do not override)

- Resolution: 1080×1920, 30 fps, H.264.
- Ken Burns max zoom: **1.08×**. ZOOM_INC reaches exactly 1.08 at the last frame of the clip.
- Stat card duration: **4 seconds** (120 frames) — at the cap from the master skill (§1, "no beat over 4s"). Do not extend.
- Intro / outro cards: **3 seconds** each.
- Text fade-in: 0.5s. No abrupt pop-ins.
- Brand colors: navy `#102742`, gold `#C9A84C`, white `#FFFFFF`, semi-transparent black shadow. Fixed in the script.
- Font tiers: headline 52pt, value 84pt (gold), context 36pt, brand 48pt.

## Workflow

1. **Pull and verify data first.** Open the corresponding `<city>_ytd_stats.md` (lives next to the script in BRAND MANAGER, not committed here — see [ASSET_LOCATIONS.md](../ASSET_LOCATIONS.md)). Re-run the Supabase query, print the row count + filter, and confirm every stat in the config matches the source. **No trace, no ship.**
2. **Write the config.** Copy `market_report_config_example.json` → `<city>_<period>_config.json`. Edit `city`, `date_label`, `phone`, `output_file`, `photos` (3–10 paths), and `stat_cards` (5–8). Order stats Tier 1 → Tier 3 (lead with the strongest).
3. **Render.** `./generate_market_report.sh --config <city>_<period>_config.json`. Inline flags also supported for one-off runs (see `--help`).
4. **Run the master quality gate (§6):** `ffmpeg -i out.mp4 -vf "blackdetect=d=0.03:pix_th=0.05" -an -f null -` — must return zero black sequences. Confirm length sits in 30–45s for 7–10 stat cards. Frame-grab every stat boundary and confirm the value matches the verified source.
5. **Compress and ship.** `ffmpeg -i out.mp4 -c:v libx264 -crf 24 -preset medium -c:a copy -movflags +faststart out_c.mp4`.

## When NOT to use this skill

- Any listing video — use `listing_video_v4/` (Remotion). Listings need per-photo motion judgment, cinemagraphs, and beat-aligned cuts that Bash + ffmpeg can't deliver.
- $1M+ luxury reports — register requires Remotion + cinematic transitions skill. This skill ships the "stat report" register only.
- Anything with VO chained between scenes — the audio path here is single-file overlay only. Use Remotion + `audio_sync/` for VO chains with `previous_text`.

## Source trace (mandatory before render)

Per repo `CLAUDE.md` §0, every figure in the rendered video must trace to one of:
- Live Supabase pull (table + filter + date window documented in the config's `_note` field, OR in a sibling `*_trace.md`).
- ORMLS / NAR / Case-Shiller / OHCS / Census / BLS / FRED — primary source URL documented.

Reject any stat card whose value cannot be traced. Cut it from the config. Don't estimate.

## Known limits

- The script depends on `DejaVuSans-Bold.ttf` at `/usr/share/fonts/truetype/dejavu/`. On macOS, install via Homebrew or update `FONT_PATH` to a local Helvetica/Arial path.
- No audio bed by default. To add a music track, mux post-render: `ffmpeg -i out.mp4 -i music.mp3 -c:v copy -c:a aac -shortest out_audio.mp4`. Keep the bed under -18 LUFS so on-screen text reads as the primary signal.
- Pre-rendered references: `Redmond_Market_Report_April_2026_v3.mp4`, `Sisters_Market_Report_April_2026_v3.mp4`, `Sisters_Market_Report_April_2026_v2_compressed.mp4` — all live in `~/Documents/Claude/Projects/BRAND MANAGER/` (see [ASSET_LOCATIONS.md](../ASSET_LOCATIONS.md)). Watch one before scaffolding a new city to set expectations on pacing and density.
