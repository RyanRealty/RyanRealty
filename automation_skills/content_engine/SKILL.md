---
name: content_engine
description: >
  THE entry point for ALL content production at Ryan Realty. Invoke this skill whenever Matt
  says: "build a video", "create a video for", "make a market report video", "make a listing
  video for", "make a meme about", "make a neighborhood guide for", "build content about",
  "produce a social post", "fire the content engine", "kick off content for", "do a [format]
  for [topic]", "make a [format] video", "create a reel for", "listing reveal", "earth zoom",
  "news clip", "avatar update", "weekend events", "listing launch", "area guide", "depth
  parallax", "flyer", "just listed flyer", "open house flyer", "property one-sheet", or any
  request to produce a video, reel, image post, flyer, or social content.
  No format skill may be invoked directly — ALL content production routes through here first.
  NOT for pure code/data/text tasks with no content deliverable.
when_to_use: >
  Also fires on: "build me a [city] market report", "shoot a reel for [address]", "post about
  [topic]", "generate content for [listing]", "run the content pipeline for", "make something
  about [trend]", "content for [neighborhood]", "put together a video on [topic]". This
  orchestrator runs storyboard → build → QA → Matt review → publish → post-mortem in a
  closed loop and enforces every guardrail. If in doubt whether a request is content
  production, load this skill.
---

# Content Engine

## Purpose

Top-level orchestrator. Maps Matt's natural-language content requests to the right format
skill, then runs the closed-loop pipeline: storyboard → build → QA → Matt review → publish
→ post-mortem. Enforces data accuracy, draft-first, anti-slop, and viral guardrails at
every step.

## Closed-loop pipeline

```
RESEARCH → STORYBOARD → BUILD → QA PASS → MATT REVIEW → PUBLISH → POST-MORTEM
               ↑                               ↓
               └──────── feedback_loop ────────┘
```

## Format routing matrix

| Matt says | Format skill | Path |
|---|---|---|
| market report / market data / city stats | `data_viz_video` (primary) | `video_production_skills/data_viz_video/SKILL.md` |
| market report (ffmpeg stat-card path) | `market_report_video` (alt) | `video_production_skills/market_report_video/SKILL.md` |
| listing video / listing reveal / reel for [address] | `listing_reveal` | `video_production_skills/listing_reveal/SKILL.md` |
| listing launch / full launch package | `listing_launch` | `video_production_skills/listing_launch/SKILL.md` |
| earth zoom / zoom from space / aerial reveal | `earth_zoom` | `video_production_skills/earth_zoom/SKILL.md` |
| news clip / real estate news / breaking news | `news-video` (canonical) | `video_production_skills/news-video/SKILL.md` |
| avatar update / talking head / Synthesia | `news_video` (avatar path) | `video_production_skills/news_video/SKILL.md` |
| neighborhood guide / neighborhood tour / area guide | `neighborhood_tour` | `video_production_skills/neighborhood_tour/SKILL.md` |
| area guides / neighborhood reel (B-roll, no VO) | `area_guides` | `video_production_skills/area_guides/SKILL.md` |
| weekend events | `social_calendar` | `video_production_skills/social_calendar/SKILL.md` |
| avatar market update | `avatar_market_update` | `video_production_skills/avatar_market_update/SKILL.md` |
| meme video / meme reel / meme about [topic] | `meme_content` | `video_production_skills/meme_content/SKILL.md` |
| meme image / image post / carousel | `meme_lord` | `social_media_skills/meme_lord/SKILL.md` |
| depth parallax / parallax photo | `depth_parallax` | `video_production_skills/depth_parallax/SKILL.md` |
| depthflow / depthflow render | `depthflow_pipeline` | `video_production_skills/depthflow_pipeline/SKILL.md` |
| google maps flyover / 3D aerial / cinematic aerial | `google_maps_flyover` | `video_production_skills/google_maps_flyover/SKILL.md` |
| gaussian splat | `gaussian_splat` | `video_production_skills/gaussian_splat/SKILL.md` |
| flyer / just-listed flyer / open house / print one-sheet | `flyer-design` | `social_media_skills/flyer-design/SKILL.md` |
| list kit / at-active kit / full marketing package / all the listing assets | `list-kit` | `social_media_skills/list-kit/SKILL.md` |
| IG single post / just-listed post / just-sold post / coming-soon post / price-improvement post / featured listing / agent intro post / brag stat post / press feature post / market data card / S1–S10 by number | `ig-single-post` | `social_media_skills/ig-single-post/SKILL.md` |
| IG carousel / swipe post / listing carousel / Pattern A / Pattern B / Pattern C / Pattern D | `instagram-carousel` | `social_media_skills/instagram-carousel/SKILL.md` |
| coming-soon teaser / pre-active reel / coming-soon reel | `coming-soon-teaser` | `social_media_skills/coming-soon-teaser/SKILL.md` |
| TikTok listing tour / TikTok tour for <address> / TikTok-optimized listing | `tiktok-listing-tour` | `video_production_skills/tiktok-listing-tour/SKILL.md` |
| YouTube long-form / YT walkthrough / YouTube walkthrough / yt longform listing | `youtube-long-form-walkthrough` | `video_production_skills/youtube-long-form-walkthrough/SKILL.md` |
| open-house stories / open-house frames / IG stories for the open house | `open-house-stories` | `social_media_skills/open-house-stories/SKILL.md` |
| under-contract post / pending post / pending announcement | `under-contract-announcement` | `social_media_skills/under-contract-announcement/SKILL.md` |
| sold post / sold deal / closing post / LinkedIn sold / sold summary | `sold-deal-summary` | `social_media_skills/sold-deal-summary/SKILL.md` |
| LinkedIn document carousel / LinkedIn PDF / LinkedIn doc carousel / linkedin carousel | `linkedin-document-carousel` | `social_media_skills/linkedin-document-carousel/SKILL.md` |
| agent coop / agent-to-agent email / coop eflyer / agent eflyer | `agent-coop-eflyer` | `social_media_skills/agent-coop-eflyer/SKILL.md` |
| postcard / farm mailer / direct mail postcard / neighbor postcard | `postcard-farm-mailer` | `social_media_skills/postcard-farm-mailer/SKILL.md` |
| yard sign / sign rider / yard sign rider | `yard-sign-rider` | `social_media_skills/yard-sign-rider/SKILL.md` |
| neighbor note / neighbor outreach / handwritten neighbor card | `neighbor-outreach-note` | `social_media_skills/neighbor-outreach-note/SKILL.md` |

**Retired / archive only (do not route to):** `market_report_video` is canonical only when
Matt explicitly requests the ffmpeg stat-card path. `news_video` (underscore) is the avatar
path — use `news-video` (hyphen) for standard news clips.

## Procedure

**Step 1 — Parse intent**
Extract: format type, topic/address/city, target platforms (if stated), any constraints
("skip storyboard", "just build it", "no VO", "publish to IG only").

**Step 2 — Route to format skill**
Match intent to the routing matrix above. Load that skill's SKILL.md. If ambiguous between
two formats, ask Matt one clarifying question before proceeding.

**Step 3 — Research**
Pull all data the format skill requires before touching the BEATS array:
- Market stats: Supabase `listings` table + Spark API (per CLAUDE.md data accuracy rules)
- Listing data: Spark API (`SPARK_API_BASE_URL` + `SPARK_API_KEY`)
- News: WebSearch (24-72h window)
- Generate `citations.json` stub — one entry per figure, source named

**Step 4 — Cost gate**
Estimate render + API cost (ElevenLabs chars, Replicate credits, Supabase reads). Write to
`out/<slug>/gate.json`. If estimate > $5: surface to Matt for approval before proceeding.

**Step 5 — Storyboard pass**
Unless Matt said "skip storyboard" or "just build it": present a 30-second skim of the
proposed BEATS array, VO script, and overlay plan. Wait for Matt's "go" before building.

**Step 6 — Build**
Invoke format skill. Render to `out/<format>/<slug>/` (gitignored — never to
`public/v5_library/` directly). All stats must be verified before render starts.

**Step 7 — QA pass**
Branch on deliverable type:

- **Video / motion:** Auto-invoke `video_production_skills/quality_gate/SKILL.md`. Run:
  - `ffprobe` duration check (30–60s)
  - `ffmpeg blackdetect` (zero sequences at pix_th=0.05)
  - Frame extracts at 0%, 25%, 50%, 85% — visual confirm motion, register shifts, kinetic reveal
  - Banned-word grep across VO script + captions
  - Verify every on-screen number appears in `citations.json`
  - Viral scorecard (VIRAL_GUARDRAILS.md §3) — format minimum must be met

- **Static flyer / one-sheet:** Auto-invoke the gate in `social_media_skills/flyer-design/SKILL.md`.
  - **Photography:** Multi-photo layout with **distinct** alternates (hero + filmstrip); intentional
    hero crop / zoom (no distant “postage stamp”); never duplicate the same file three ways.
  - **`design_review_checklist.json`:** every line item `pass` before the draft is described as
    ready (trained-eye self-audit — “ready” still means **draft for Matt**, not distributed).
  - Verify mobile readability, `citations.json`, `fonts_used.json`, `provenance.json`,
    `design_scorecard.json`.

If QA fails: fix and re-render (max 2 auto-iterations). After 2 failures: report to Matt
with specific failure reason. Do NOT present a broken draft.

**Step 8 — Present to Matt (mandatory contact sheet)**

Generate an HTML contact sheet at `out/proof/<YYYY-MM-DD>/<batch-slug>/contact-sheet.html` (or
`out/proof/<YYYY-MM-DD>/contact-sheet.html` if it's the day's only batch). The contact sheet must
include, per deliverable in the batch:

- The rendered image embedded inline (`<img>` at native or scaled-to-viewport).
- Videos embedded with HTML5 `<video controls>` so Matt can play them in-browser.
- Carousels shown as a slide grid with slide numerals.
- Captions in a readable `<pre>` block (monospace, copyable).
- A verification trace block (one row per figure: source · filter · value · fetched_at).
- File paths shown alongside each deliverable.
- A status pill per deliverable (DRAFT / APPROVED / REVISIONS NEEDED / BLOCKED).
- An approval prompt at the bottom listing the structured chat replies Matt should send
  (`approve <slug>`, `revise <slug>: <feedback>`, `ship all`, `kill <slug>`).

Surface BOTH links to Matt — file:// for guaranteed access, and localhost for one-click open:

```
Draft ready — contact sheet:
  → http://localhost:<port>/proof/<YYYY-MM-DD>/<batch>/contact-sheet.html
  → file:///Users/matthewryan/RyanRealty/out/proof/<YYYY-MM-DD>/<batch>/contact-sheet.html

Open the link, review each card, then reply with one of:
  • approve <slug>          — commits + pushes that deliverable to public/
  • approve all             — commits + pushes everything in the batch
  • revise <slug>: <note>   — feedback I'll act on
  • kill <slug>             — drop that deliverable from the batch
```

Then stop. Do not commit. Do not push. Wait.

**Per "Contact sheet required" (locked 2026-05-14):** never describe a draft via file paths
alone. Matt approves from the visual review. Every content draft surface must include the HTML
contact sheet AND a clickable link. Brand the contact sheet to v2 (navy `#102742` on cream
`#faf8f4`, Geist body, Amboqia headlines).

**Step 9 — On approval: publish**
Invoke `video_production_skills/content_pipeline/SKILL.md` with platform defaults (see
table below). Copy render to `public/v5_library/`. Commit + push to `main` immediately.

**Step 10 — On rejection: feedback loop**
Capture Matt's rejection reason in writing. Write a rule update or note to the relevant
format SKILL.md. Return to Step 5 with adjusted brief.

**Step 11 — Post-mortem (48h after publish)**
Check platform analytics. Write performance note to `automation_skills/content_engine/log.md`.
Feed signal back to format skill's reference files.

## Hard constraints — immutable

1. ALL content production routes through this orchestrator. No agent invokes a format skill
   directly without this skill running first.
2. Storyboard pass is mandatory. Skip only when Matt explicitly says "skip storyboard" or
   "just build it."
3. QA pass is mandatory after every render. Cannot be skipped under any circumstance.
4. Matt approval is mandatory before publish. Silence is not approval. A passing scorecard
   is not approval. A successful build is not approval.
5. Feedback loop runs on every rejection. No silent retries without capturing the reason.
6. Every stat ships with a verification trace. No trace, no ship.
7. Render target is always `out/` first. `public/v5_library/` only after Matt approval.
8. Static flyers must pass `flyer-design` photography + typography + `design_review_checklist`
   gates before Matt sees them. Never describe a flyer as “client-ready” or “for distribution.”

## Platform defaults (when Matt doesn't specify)

| Format | Default platforms |
|---|---|
| `listing_reveal`, `listing_launch` | IG Reels, TikTok, YT Shorts, FB Reels, LinkedIn, X |
| `data_viz_video`, `market_report_video` | IG Reels, TikTok, YT Shorts, FB Reels, LinkedIn |
| `news-video` | IG Reels, TikTok, X, Threads |
| `earth_zoom` | IG Reels, TikTok, YT Shorts |
| `meme_content` | IG Reels, TikTok, X, Threads |
| `neighborhood_tour`, `area_guides` | IG Reels, YT Shorts, FB Reels, Pinterest |
| `avatar_market_update` | YT (long), LinkedIn, FB Feed |
| `social_calendar` | IG Reels, FB Feed, GBP Event post |
| `meme_lord` (image) | IG Feed, FB Feed, X, Threads |
| `flyer-design` (static) | IG Feed, FB Feed, LinkedIn, email/PDF handout |

Matt can override: "publish to ONLY {platform list}" or "build but don't publish."

## See also

- `video_production_skills/quality_gate/SKILL.md` — QA pass (Step 7)
- `video_production_skills/content_pipeline/SKILL.md` — publish routing (Step 9)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content rules
- `video_production_skills/VIRAL_GUARDRAILS.md` — scorecard + format minimums
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master hard constraints
- `social_media_skills/flyer-design/SKILL.md` — static flyers + design review gate
- `automation_skills/triggers/listing_trigger/SKILL.md` — automated listing pipeline
