# Asset Locations — Rendered MP4s, Build Sources, Reference Material

**Purpose.** Rendered MP4s are too large to commit to the repo. This file is the index of where they live on Matt's Mac. Use it when you need to watch a reference cut before scaffolding a similar build, audit a stat against the rendered version, or pull a still for a thumbnail.

**Inventoried:** 2026-04-26. If a file goes missing, that's expected — these directories evolve. Always re-list before assuming a path is current.

---

## Rendered final videos (the canonical references)

### Market reports — `~/Documents/Claude/Projects/BRAND MANAGER/`
Built with [`market_report_video/generate_market_report.sh`](market_report_video/generate_market_report.sh):
- `Redmond_Market_Report_April_2026_v3.mp4` (12.4 MB) — current Redmond cut. Reference for the 7–8 stat-card register.
- `Redmond_Market_Report_April_2026_v2_compressed.mp4` (12.6 MB)
- `Redmond_Market_Report_April_2026_v1.mp4` (38.5 MB) — uncompressed master
- `Sisters_Market_Report_April_2026_v3.mp4` (57.9 MB) — current Sisters cut, longer/higher-res variant
- `Sisters_Market_Report_April_2026_v2.mp4` (9.9 MB) — compressed delivery
- `Sisters_Market_Report_April_2026.mp4` (10.0 MB) — v1
- `sisters_market_report.mp4`, `sisters_market_report_9x16.mp4` — pre-v3 prototypes (HTML→Playwright pipeline, deprecated)

### Listing Reels — `~/Documents/Claude/Projects/BRAND MANAGER/`
- `56111_SchoolHouse_Pending_Reel.mp4` (8.2 MB) — Schoolhouse v5 viral reel (final cut). Watch this before any new listing-tier viral build. Master skill §8 logs the v1→v5.9 lessons that produced it.

### Listing Reels — `~/Documents/Claude/Projects/SOCIAL MEDIA MANAGER/`
- `56111_SchoolHouse_Pending/SchoolHouse_Pending_Reel_1080x1920.mp4` (8.2 MB) — same final, mirrored
- `56111_SchoolHouse_Pending/SchoolHouse_VirtualTour_Full_9x16.mp4` (109 MB) — full virtual tour cut (v3 cinematic — the one Matt rejected as too long)
- `56111_SchoolHouse_Pending/SchoolHouse_VirtualTour_Short_9x16.mp4` (76.8 MB) — shorter cinematic
- `56111_SchoolHouse_Pending/ai_clips/01..15` — per-beat AI i2v intermediates from v4b (the slop round). **Reference only.** Do not reuse these — they are the locked example of why AI on interiors is banned (master skill §4 + §8). 

### Tumalo Reservoir Rd — `~/Documents/Claude/Projects/SOCIAL MEDIA MANAGER/`
- `Tumalo_Reel1_DreamTour.mp4` (223 KB) — early prototype
- `Tumalo_Reel2_QuickFacts.mp4` (156 KB) — early prototype

Brand asset IDs and the canonical Tumalo per-shot reel beat-by-beat are in [`brand_assets/SKILL.md`](brand_assets/SKILL.md) ("Tumalo Reservoir Rd Asset ID Reference").

### Friday hype + meme drafts — `~/Documents/Claude/Projects/SOCIAL MEDIA MANAGER/`
- `Friday_Hype_Reel_April18.mp4` (3.9 MB)
- `Friday_Hype_Reel_v2_April18.mp4` (3.3 MB)
- `drafts/2026-04-17_meme-hype-reel-v4.mp4` (6.5 MB) — current accepted draft
- `drafts/2026-04-17_meme-hype-reel-v3.mp4` (13.8 MB) — superseded
- `drafts/2026-04-17_meme-hype-reel.mp4` (2.9 MB) — v1

### Logo animations — `~/Documents/Claude/Projects/BRAND MANAGER/Logo_Animations/`
- `ryan_realty_logo_particles.mp4` (47.7 MB)
- `ryan_realty_particles.mp4` (29.9 MB)
- **Banned in viral cuts** per master skill §5. Reserved for cinematic / brand-credibility cuts only.

### Bend market update + carousel — `~/Documents/Claude/Projects/BRAND MANAGER/Market_Update_Video_2026_Apr/`
- `Bend_Market_Update_2026_v1.mp4` (26.7 MB)
- `Bend_Market_Update_2026_v1_1.mp4` (28.1 MB)
- `owned_clips_preview/slide1..7.mp4` — per-slide owned source clips

### Historical Oregon carousel — `~/Documents/Claude/Projects/BRAND MANAGER/Historical_Oregon_Carousel/`
This is the source folder for `market_report_video/`. Per-stage build outputs:
- `02_animated_clips/01..07_clip.mp4` (~70–94 MB each) — raw animated stage
- `04_final_renders/01..07_final.mp4` (~20–43 MB each) — composited finals
- `bend_unsplash/Bend_Market_Reel_v2..v5.mp4` (20–52 MB) — version progression
- `bend_unsplash/animated/slide1..7_*.mp4` — per-slide intermediates (multiple iterations)
- `bend_unsplash/final/`, `final_v2/`, `final_v4/`, `final_v5/`, `final_v6/`, `overlays_v3/` — per-version renders
- `study_v2/animated/01_i2v.mp4`, `study_v2/final/01_final.mp4` — study round outputs

### Misc carousel — `~/Documents/Claude/Projects/BRAND MANAGER/2026-04_Bend_SFR_Carousel/`
- `raw_clips/slide1_v1..v3.mp4` — slide-1 iteration history

---

## Build sources (NOT in this repo — read but don't move)

### Sisters market report build files — `~/Documents/Claude/Projects/BRAND MANAGER/sisters_market_report_build/`
This is the HTML+Playwright pipeline (the predecessor to `market_report_video/`'s ffmpeg approach):
- `build_v5.py` — 398-line build script. Generates self-contained HTML prototype with 12 scenes + CSS animations.
- `render_10fps.py` — **Use this.** 10 fps capture → 30 fps output. Smoother than 5 fps.
- `render_animated.py` — 5 fps capture → 30 fps. Proven working, choppy.
- `photo_data_v3.json` — 10 base64-encoded Unsplash photos (4.2 MB)
- `stacked_logo_b64.txt` — base64 of white stacked logo (184 KB)
- `stacked_logo_white_600.png` — white transparent logo PNG (600×393)
- `render_scenes.py` / `render_smooth.py` / `render_final.py` — FAILED approaches (kept for the lessons log).

The HTML+Playwright pipeline is **deprecated** for new market reports — use [`market_report_video/generate_market_report.sh`](market_report_video/generate_market_report.sh) (pure ffmpeg) instead. The HTML pipeline is preserved only for the in-flight Sisters cut and as historical reference.

### BRAND MANAGER intelligence dump (read before any marketing work)
- `Ryan_Realty_Marketing_Intelligence.md` — buyer psychology, listing copy, content mix
- `Organic_Growth_Intelligence.md` — IG/TikTok/FB algorithm playbook (organic only)
- `Paid_Ads_Intelligence.md` — Meta Ads, Google Ads playbook
- `Canva_CapCut_Intelligence.md` — design/video production capabilities

### Brand assets
- `Ryan Realty Brand Voice & Tone Guide.docx` — definitive voice doc
- `Ryan_Realty_Unified_Brand_Kit.md` — colors, fonts, logo specs
- `Brand_Kit_Social_Channels.md` — social channel brand specs
- `brand_asset_inventory_2026-04-15.md` — full asset inventory

### SOCIAL MEDIA MANAGER skills (the originals)
- `.claude/skills/ryan-realty/` — 21 skills mirrored / consolidated into this repo's `video_production_skills/`. Source remains for compatibility with the standalone agent flow.

### Photography source (Rich at Framed Visuals)
- Drive folder `images-for-web-or-mls` — folder ID `1r4UL-qZjzmBmb5IC-Lp0OdLWunxDQdJn`
- Aryeo delivery email: `from:rich@framedvisuals.co [address]` in Gmail
- Snowdrift Visuals 19-neighborhood library: Drive `06_Marketing & Brand > Marketing > Media > Web Site > Area Guides`

---

## When to use this file

- **Before scaffolding a new build:** watch the closest existing reference. Match the register without copying.
- **When debugging a render issue:** compare the suspect render against the last known-good version listed here.
- **When auditing a stat against the rendered version:** open the rendered MP4, scrub to the stat card, confirm the value matches the source trace (per `CLAUDE.md` §0).
- **When pulling a thumbnail / first-frame still:** `ffmpeg -i <path> -ss 00:00:00 -vframes 1 thumb.png`.

---

## What's NOT inventoried here

- Per-photo source files (PNG/JPG) — too many; lives in Drive (`images-for-web-or-mls`) or per-build `01_source_photos/` folders.
- Synthesia avatar render outputs — those land in `~/Downloads/` first, then archived to Drive `06_Marketing & Brand > Marketing > Avatar Videos > [Season]/`.
- Scheduled / pending content in `drafts/` — fluid; check the directory directly when needed.

If you need something not listed: re-run `find ~/Documents/Claude/Projects -name "*.mp4" -mtime -30` to find anything rendered in the last 30 days.
