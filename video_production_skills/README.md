---
name: video-production-skills-index
description: Master index of every video skill in the Ryan Realty system. Use this BEFORE any video task to pick the right skill. Maps every video format and capability to its canonical skill file. Read this even before VIDEO_PRODUCTION_SKILL.md if you're not sure which skill to load.
---

# Ryan Realty — Video Production Skills Index

**This is the routing layer.** Every agent doing any video task reads this first. It tells you exactly which skill to load. The actual rules live in the skill files this index points at.

**Last consolidated:** 2026-04-29.

---

## How to use this index

1. Identify what you're building (format) or what you need to know how to do (capability).
2. Open the linked skill.
3. That skill will tell you which other skills to load alongside (the master rules, the quality gate, the relevant capability skills).

If you're not sure, default to reading **`VIDEO_PRODUCTION_SKILL.md`** first — it's the master rules and tells you what every video must satisfy regardless of format.

---

## Trigger phrase router (canonical)

Use these exact mappings so one prompt always routes to one primary skill:

| User says | Primary skill | Required input normalization |
|---|---|---|
| "Create a listing video for this address." | [`listing-tour-video/SKILL.md`](./listing-tour-video/SKILL.md) | Resolve address to `ListingKey` before render steps. |
| "Create a market report for this city or this subdivision." | [`market-data-video/SKILL.md`](./market-data-video/SKILL.md) | `city` is always monthly by default (previous full month if month not specified). Never auto-fallback to YTD unless user explicitly asks YTD. Always SFR-only (`PropertyType='A'`). Market composition must include advanced charts (no duplicate label/value stat slides). `subdivision` routes to neighborhood/subdivision mode described in that skill and [`neighborhood-overview/SKILL.md`](./neighborhood-overview/SKILL.md). |
| "Create a news clip for this topic." | [`news-video/SKILL.md`](./news-video/SKILL.md) | Normalize topic to verifiable primary sources plus local/Bend relevance angle. |
| "Create a What's going on this weekend? clip for this city." | [`weekend-events-video/SKILL.md`](./weekend-events-video/SKILL.md) | Normalize to city + date window (Fri-Sun unless overridden). |
| "Go ahead and publish it." / "Publish this now." | [`publisher/SKILL.md`](./publisher/SKILL.md) | Require explicit approval state, target channels (or defaults by format), and per-platform captions before dispatch. |

If the ask is specifically "short viral listing reel" rather than tour, route to [`listing_reveal/SKILL.md`](./listing_reveal/SKILL.md).

---

## Constitution layer (read before any video build)

| Document | Purpose |
|---|---|
| [`VIDEO_PRODUCTION_SKILL.md`](./VIDEO_PRODUCTION_SKILL.md) | Master hard-constraint rules. Length, hook, retention, brand, captions, voice, quality gate. Read first. |
| [`ANTI_SLOP_MANIFESTO.md`](./ANTI_SLOP_MANIFESTO.md) | Hard ship/no-ship gate. 12 rules. Banned content, banned openings, AI disclosure, fair-housing, voice rules. |
| [`VIRAL_GUARDRAILS.md`](./VIRAL_GUARDRAILS.md) | 100-point virality scorecard. Format minimums (listing 85, market 80, neighborhood 80, meme 75). |

## Operational quick-refs

| Document | Use when |
|---|---|
| [`API_INVENTORY.md`](./API_INVENTORY.md) | Picking an API. Status, cost, untapped capability. |
| [`VISUAL_STRATEGY.md`](./VISUAL_STRATEGY.md) | Need a creative brief per content type before scaffolding. |
| [`WORKFLOWS.md`](./WORKFLOWS.md) | Need step-by-step build pipeline per content type. |
| [`publisher/SKILL.md`](./publisher/SKILL.md) | Need to publish approved content with platform-aware best practices. |
| [`AGENT_HANDOFF.md`](./AGENT_HANDOFF.md) | Picking up an in-flight build from another session. |
| [`CAPTION_AUDIT.md`](./CAPTION_AUDIT.md) | Diagnosing or preventing caption violations. |
| [`ASSET_LOCATIONS.md`](./ASSET_LOCATIONS.md) | Looking up a previously rendered MP4. |
| [`VIRAL_VIDEO_CONSTRAINTS.md`](./VIRAL_VIDEO_CONSTRAINTS.md) | Production checklist (compact form of master rules). |
| [`VIRAL_SCORECARD_QUICKREF.md`](./VIRAL_SCORECARD_QUICKREF.md) | Publish-day scorecard run. |

---

## Format skills — pick the one matching your task

| You want to build | Use this skill | Length | Notes |
|---|---|---|---|
| Listing launch package (text + 3 reel scripts + email + MLS copy) | [`listing_launch/SKILL.md`](./listing_launch/SKILL.md) | n/a (text pipeline) | Text-only — produces scripts other skills render |
| 60–90s branded listing tour video | [`listing-tour-video/SKILL.md`](./listing-tour-video/SKILL.md) | 60–90s | Supabase + Wan i2v + Remotion. Outputs both branded + MLS-unbranded. |
| 40–48s social listing reel (16-beat, vertical) | [`listing_reveal/SKILL.md`](./listing_reveal/SKILL.md) | 40–48s | Tumalo formula. Requires depth_parallax on 4 named beats. |
| Monthly city market report video | [`market-data-video/SKILL.md`](./market-data-video/SKILL.md) | 30–60s | 12 scenes, full SQL trace, **Spark × Supabase reconciliation gate** (mandatory). |
| Quick stat-card market reel (fast variant) | [`data_viz_video/SKILL.md`](./data_viz_video/SKILL.md) | 30–60s | JSON-snapshot engine. Citation pill on every metric. |
| Daily news clip (national + Bend angle) | [`news-video/SKILL.md`](./news-video/SKILL.md) | 30–45s | Victoria VO + word-level captions. Ships daily. |
| 30s neighborhood Photorealistic 3D Tiles flyover | [`neighborhood-overview/SKILL.md`](./neighborhood-overview/SKILL.md) | 30s hard cap | Google ToS limit. ECEF math. |
| 60–90s neighborhood / area guide | [`neighborhood_tour/SKILL.md`](./neighborhood_tour/SKILL.md) | 60–90s | Earth Studio + ElevenLabs + GreatSchools/Walk Score. 19 Bend neighborhoods. |
| 15–30s lifestyle / community entertainment reel | [`lifestyle-community/SKILL.md`](./lifestyle-community/SKILL.md) | 15–30s | **Zero houses, zero branding in frame**. 5 modes (LIST, POV, MYTH vs REALITY, HYPE, QUESTION→DATA). |
| Weekend events roundup clip for a city | [`weekend-events-video/SKILL.md`](./weekend-events-video/SKILL.md) | 20–45s | City-scoped "what's going on this weekend" event recap. |
| Three.js massing model for new development | [`development-showcase/SKILL.md`](./development-showcase/SKILL.md) | 28–30s | Architectural 3D, no photos. |
| Synthesia avatar weekly market update (Mon 5 AM) | [`avatar_market_update/SKILL.md`](./avatar_market_update/SKILL.md) | 60s | FTC AI disclosure mandatory. 180-word script max. |
| Earth Studio space-to-front-door descent intro | [`earth_zoom/SKILL.md`](./earth_zoom/SKILL.md) | 8–12s | Component, not standalone. Feeds listing_reveal Beat 0 + neighborhood_tour opener. |
| Trend-jacking meme / reaction reel | [`meme_content/SKILL.md`](./meme_content/SKILL.md) | 15–25s | Fair-use log per clip. AzoSans Medium only. |

---

## Capability skills — load on demand alongside a format skill

| You need to | Use this skill |
|---|---|
| Pick which AI generation tool / model | [`ai_platforms/SKILL.md`](./ai_platforms/SKILL.md) |
| Animate a still photo (camera moves, cinemagraph) | [`photo-hero-drift/SKILL.md`](./photo-hero-drift/SKILL.md) |
| Apply 2.5D parallax to an exterior still | [`depth_parallax/SKILL.md`](./depth_parallax/SKILL.md) |
| Use DepthFlow GLSL pipeline for depth-rich stills | [`depthflow_pipeline/SKILL.md`](./depthflow_pipeline/SKILL.md) |
| Pick a transition between beats | [`cinematic_transitions/SKILL.md`](./cinematic_transitions/SKILL.md) |
| Sync cuts to music beats | [`audio_sync/SKILL.md`](./audio_sync/SKILL.md) |
| **Generate VO via ElevenLabs (Victoria voice)** | [`elevenlabs_voice/SKILL.md`](./elevenlabs_voice/SKILL.md) ← NEW |
| **Render captions on a video** | [`captions/SKILL.md`](./captions/SKILL.md) ← NEW |
| **Run the Remotion render command** | [`render_pipeline/SKILL.md`](./render_pipeline/SKILL.md) ← NEW |
| Publish approved content to platform-specific channels | [`publisher/SKILL.md`](./publisher/SKILL.md) |
| Run the 6-phase quality gate before publish | [`quality_gate/SKILL.md`](./quality_gate/SKILL.md) |
| Get brand colors, fonts, photo selection rules | [`brand_assets/SKILL.md`](./brand_assets/SKILL.md) |
| Build through the full 6-stage content pipeline | [`content_pipeline/SKILL.md`](./content_pipeline/SKILL.md) |
| Use Gaussian Splatting (luxury $1M+) | [`gaussian_splat/SKILL.md`](./gaussian_splat/SKILL.md) |

---

## Hard rules summary (consolidated 2026-04-29)

These resolve the contradictions previously found across the constitution docs. The master skill, manifesto, guardrails, and CLAUDE.md all agree on these as of consolidation:

| Topic | Canonical answer |
|---|---|
| Listing video length | 30–45s social reels; 60s branded tours; 90–110s luxury |
| Brand palette | Navy `#102742`, Navy-deep `#0a1a2e`, Cream `#faf8f4`, Sand `#e8e2d4`, Fir `#2e4a3a` (sparing), Sky `#8fb8d4` (sparing) |
| Charcoal hex | `#1A1A1A` |
| ElevenLabs voice ID | `qSeXEcewz7tA0Q0qk9fH` (Victoria — locked permanent 2026-04-27) |
| ElevenLabs settings | stability 0.40, similarity_boost 0.80, style 0.50, speaker_boost true — Updated 2026-05-07 per Matt directive; canonical source: video_production_skills/elevenlabs_voice/SKILL.md |
| ElevenLabs model | `eleven_turbo_v2_5` for production; `eleven_v3` only when an SSML phoneme tag is needed |
| CRF | `--crf 22` |
| Caption body font min | 48px |
| Min beats per 45s | 12 minimum |
| Interior beat min | 3.5s |
| AI on interiors | Cinemagraph isolation only (Kling 2.1 Motion Regions or Remotion mask-image). Full-frame i2v on interiors is BANNED. |
| Ken Burns | Deprecated for hero shots. Cinemagraph + slow Remotion pan replace it. |
| Depth parallax scope | Exteriors only. |
| Photo-to-video model | Kling 2.1 Master is primary for hero exteriors; Wan 2.5 i2v is fallback or wide/atmospheric. |
| PIL for video frames | BANNED. Remotion is the only video frame engine. PIL allowed only for static social cards (non-video). |
| CapCut | BANNED (zero-manual-tools policy). |

---

## Retired / archived (do not use)

| Old skill | Status | Successor |
|---|---|---|
| `_retired/area_guides/` | Retired 2026-04-29 (CapCut, wrong hex, logo-in-frame violations) | `neighborhood_tour/` (long-form) or `lifestyle-community/` (short-form) |
| `_retired/market_report_video/` | Retired 2026-04-29 (ffmpeg-only, off-brand fonts, predates Remotion) | `market-data-video/` |
| `_retired/news_video_avatar_synthesia/` (was `news_video/` underscore) | Retired 2026-04-29 (was confusingly named — was actually a Synthesia avatar skill) | `avatar_market_update/` |
| `_research_archive/BLONDE_WATERFALL_DECONSTRUCTION.md` | Moved 2026-04-29 (competitor research, not a skill) | seeded `depth_parallax/SKILL.md` |
| `_strategy_reference/google_maps_flyover/` | Moved 2026-04-29 (After Effects creative brief, not a build skill) | n/a — strategy reference only |

---

## What lives elsewhere

- **`/Users/matthewryan/RyanRealty/social_media_skills/`** — social-platform skills (algorithms, hooks, posting, content calendar). The video skills are HERE; the social skills are THERE.
- **`/Users/matthewryan/RyanRealty/automation_skills/`** — automation triggers and pipelines (post scheduler, performance loop, repurpose engine).
- **`/Users/matthewryan/RyanRealty/CLAUDE.md`** — repo-wide rules (data accuracy mandate, draft-first, video build hard rules inline).
- **`/Users/matthewryan/Documents/Claude/Projects/MARKETING/CLAUDE.md`** — marketing-project session routing (points back here for video work).

If you're working in the marketing Cowork project and someone asks for a video, the routing is:
**MARKETING/CLAUDE.md → this README → the right skill file.**
