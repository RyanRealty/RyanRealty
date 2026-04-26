# Content Pipeline — End-to-End Automated Production

**When to use.** Any content-production task that flows from idea → publish. This is the master operating system for the social pipeline. Every other skill in this directory plugs into this 6-stage flow.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) (length, hook, cuts, brand rules, quality gate). The pipeline does not override the master rules — it executes them.

---

## Core principle

**Matt never touches a tool.** No CapCut, no Canva manual edits, no browser uploads, no copy-pasting captions. Matt gives creative direction ("make a Friday hype reel about this week's market data") and reviews a draft. The pipeline produces and publishes.

---

## Architecture: 6 stages

```
DIRECT  ─►  GENERATE  ─►  PRODUCE  ─►  DRAFT  ─►  PUBLISH  ─►  MONITOR
(Matt)      (AI APIs)     (Remotion +   (review     (all ch.)    (feedback
                          ffmpeg)       link)                    loop)
```

### 1. DIRECT — Matt's input

One of:
- Content idea ("Friday hype reel with this week's data")
- Content type ("listing video for 19496 Tumalo Reservoir")
- Strategic goal ("grow IG followers by 500 this month")
- Nothing (pipeline runs the calendar autonomously — see `../social_calendar/`)

### 2. GENERATE — AI assets

| Asset | Tool | Skill |
|-------|------|-------|
| Real listing photos | Rich at Framed Visuals → Aryeo → Drive | [`../brand_assets/SKILL.md`](../brand_assets/SKILL.md) |
| Stat-card backgrounds | DALL·E (`OPENAI_API_KEY`) or Grok Imagine (`XAI_API_KEY`) | [`../ai_platforms/SKILL.md`](../ai_platforms/SKILL.md) |
| Photo-to-video motion | Kling 3.0 via Replicate (`REPLICATE_API_TOKEN`) or Veo 3.1 via Vertex AI | [`../ai_platforms/SKILL.md`](../ai_platforms/SKILL.md) |
| Avatar talking-head | Synthesia (`SYNTHESIA_API_KEY`) | [`../news_video/SKILL.md`](../news_video/SKILL.md) |
| Music | Royalty-free (incompetech, Pixabay CC) | — |
| VO | ElevenLabs (future) | Master skill §7.2 (chained `previous_text`) |
| Copy | Claude (this agent) + brand voice enforcement | `brand-voice:enforce-voice` |

### 3. PRODUCE — programmatic post

**This replaces CapCut and manual Canva entirely.** PIL is BANNED for video frames (looks amateurish — locked rule from AGENT_HANDOFF.md). Use:

- **Remotion** — primary engine. React + TypeScript compositions under `listing_video_v4/src/` (or future `video/<name>/src/`). All listing video, all viral cuts, all $1M+ luxury renders.
- **ffmpeg** — for the simpler stat-card / market-report register (see [`../market_report_video/SKILL.md`](../market_report_video/SKILL.md)). Also for final encode + audio mux + blackdetect QA on every Remotion render.
- **PIL** — only for static images (stat cards exported as PNG, gradient backgrounds). Never for video frames.

Output specs auto-generated from one master render:

| Platform | Aspect | Max Duration | Resolution |
|----------|--------|--------------|------------|
| IG Reels | 9:16 | 90s | 1080×1920 |
| IG Stories | 9:16 | 60s (15s segments) | 1080×1920 |
| IG Feed Post | 4:5 | 60s | 1080×1350 |
| TikTok | 9:16 | 10min | 1080×1920 |
| FB Reels | 9:16 | 90s | 1080×1920 |
| YouTube Shorts | 9:16 | 60s | 1080×1920 |
| Google Business | 16:9 or 1:1 | photo only | 1200×900 |

### 4. DRAFT — review before publish

Pipeline saves to `drafts/YYYY-MM-DD_<slug>.mp4` + `drafts/YYYY-MM-DD_<slug>_captions.md`. Sends Matt a draft link with thumbnail, per-platform captions, posting time, hashtag set. States: `draft` → `approved` → `revision` (iterate) → `killed`.

**Never publish without Matt's approval.** Draft stage is mandatory.

### 5. PUBLISH — all channels

| Channel | API | ENV |
|---------|-----|-----|
| IG Reels | Meta Graph `POST /{ig-user-id}/media` then `media_publish` | `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID` |
| FB Reels | Meta Graph `POST /{page-id}/video_reels` | `META_PAGE_ACCESS_TOKEN`, `META_FB_PAGE_ID` |
| TikTok | TikTok Content Posting API (OAuth2) | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| YouTube Shorts | YouTube Data API v3 `videos.insert` (resumable) | Google OAuth or Service Account |
| Google Business | Local Posts API `accounts.locations.localPosts.create` | Google Service Account |
| LinkedIn | LinkedIn Marketing API | NOT KEYED — future |

Video must be at a publicly accessible HTTPS URL before IG Reels publish — upload to Supabase Storage or Cloudflare R2 first.

**Cross-post timing:** IG first → TikTok 2 hrs later → FB 4 hrs later. Logs post ID + timestamp to Supabase `social_posts` table.

### 6. MONITOR — performance loop

**Daily (cron):** Pull IG / TikTok insights → write to Supabase `social_metrics_weekly`.

**Weekly (Mon 7am):** Generate performance report. Top performer + worst performer. Completion rate, share rate, save rate ranked. Recommendations for next week's content mix.

**Monthly:** Follower growth across all channels. Pillar performance breakdown. Best posting times. Format comparison.

**Feedback loop:** High-performing formats get repeated. Low-performing formats get retired. Hook styles, caption approaches, visual treatments tracked.

---

## Content format library (repeatable, schedulable)

| # | Format | Cadence | Spec |
|---|--------|---------|------|
| 1 | Friday Hype Reel | Weekly Fri 10am | 32 beat-synced stat cards, 60s, city-by-city, DM CTA |
| 2 | Listing Launch Package | Per listing | See [`../listing_launch/SKILL.md`](../listing_launch/SKILL.md) |
| 3 | Market Commentary | Weekly Wed | Stat cards + trend, 30–45s — see [`../market_report_video/SKILL.md`](../market_report_video/SKILL.md) |
| 4 | Neighborhood Spotlight | Weekly Tue | See [`../area_guides/SKILL.md`](../area_guides/SKILL.md) |
| 5 | Quick Tip / Education | 2× weekly | Text-only or stat-card, 15–30s |
| 6 | Trending Format | As needed | Audio scout (Mon) → adapt → publish in <1 hr |

---

## File storage convention

```
SOCIAL MEDIA MANAGER/
  drafts/                  # pre-approval
    2026-04-18_friday-hype.mp4
    2026-04-18_friday-hype_captions.md
  published/               # post-approval archive
    2026-04-18_friday-hype/
      ig_reel.mp4
      tiktok.mp4
      fb_reel.mp4
      yt_short.mp4
      captions.md
      metrics.json         # performance data
  calendars/2026-05.md
  audio/audio_log.md       # licensed music tracking
  analytics/weekly/, monthly/
```

---

## Automation schedule

| Task | Frequency | When |
|------|-----------|------|
| Trending audio scout | Weekly | Mon 8am |
| Content calendar review | Weekly | Mon 9am |
| Friday Hype Reel | Weekly | Fri 10am |
| Market commentary | Weekly | Wed |
| Neighborhood spotlight | Weekly | Tue |
| Analytics pull | Daily | 11pm |
| Weekly performance report | Weekly | Mon 7am |
| Monthly deep review | Monthly | 1st of month |

---

## Hard rules

- Never publish without Matt's approval
- Never use AI-generated video of houses / interiors / people for listing content (real photos only — Synthesia is the carve-out for talking-head, see [`../news_video/SKILL.md`](../news_video/SKILL.md))
- DM CTA on every post
- No logo / phone / URL / agent name in video frame for viral cuts
- Brand voice enforcement on every caption
- Copy-writing rules checked on every text element (no em dashes, no banned words)
- Quality gate cleared on every AI clip before stitch ([`../quality_gate/SKILL.md`](../quality_gate/SKILL.md))
- Music must be royalty-free / CC-licensed (business-account safe)
- Data accuracy rule from repo `CLAUDE.md` §0 supersedes everything for any stat-bearing content

---

## What needs to be built (priority order)

**P0 — Get publishing working**
1. Upload video to Supabase Storage / Cloudflare R2 → public URL
2. Wire IG Reel publish via Meta Graph
3. Wire FB Reel publish via Meta Graph
4. Complete TikTok OAuth (one-time browser step)
5. Wire TikTok publish via Content Posting API

**P1 — Get monitoring working**
6. Create `social_metrics_weekly` Supabase table
7. Wire IG insights pull (daily cron)
8. Wire weekly performance report

**P2 — Video generation**
9. Test Kling 3.0 via Replicate for listing photo-to-video
10. Test Veo 3.1 via Google AI Studio for alternative
11. Build batch generation script (multiple angles per listing)

**P3 — Full automation**
12. Content calendar auto-execution
13. Scheduled tasks for recurring formats
14. Draft → review → approve → publish flow
15. Analytics feedback into content decisions
