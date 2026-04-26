---
name: automated-content-pipeline
description: Ryan Realty: Fully Automated Social Content Pipeline
---
# Ryan Realty: Fully Automated Social Content Pipeline

## When to Use

Use this skill for ALL content creation, publishing, and monitoring tasks. This is the master pipeline. Every piece of content flows through this system. Matt gives direction. The agent executes everything.

## Core Principle

**Matt never touches a tool.** No CapCut. No Canva manual edits. No browser uploads. No copy-pasting captions into apps. Matt gives creative direction ("make a Friday hype reel about this week's market data") and reviews a draft link. That's it.

---

## Architecture: 6 Stages

```
DIRECT  ─►  GENERATE  ─►  PRODUCE  ─►  DRAFT  ─►  PUBLISH  ─►  MONITOR
(Matt)      (AI APIs)     (ffmpeg)     (review)    (all ch.)    (feedback)
```

### Stage 1: DIRECT (Matt's Input)

Matt provides one of:
- A content idea ("Friday hype reel with this week's data")
- A content type ("listing video for 19496 Tumalo Reservoir")
- A strategic goal ("grow IG followers by 500 this month")
- Nothing (agent runs the content calendar autonomously)

The agent handles everything from here.

### Stage 2: GENERATE (AI Asset Creation)

**Image Generation (starting frames):**
- Real listing photos from Rich/Framed Visuals (preferred for listings)
- DALL-E via OpenAI API (abstract/conceptual visuals, stat card backgrounds)
- Grok Imagine via xAI API (alternative image gen)
- Midjourney (browser-only, not automatable yet — skip for now)

**Video Generation (motion from stills):**
- PRIMARY: Kling 3.0 via Replicate API (`REPLICATE_API_TOKEN` — keyed)
- SECONDARY: Google Veo 3.1 via Vertex AI (`GOOGLE_*` keys — keyed)
- FUTURE: fal.ai aggregator (one key, all models — needs signup)

**Audio Generation:**
- Royalty-free music library (incompetech.com, Pixabay — CC licensed)
- ElevenLabs for voiceover (needs API key — future)
- Suno for original music (needs API key — future)

**Text/Copy Generation:**
- Claude (this agent) writes all copy
- Brand voice enforcement skill runs on every piece
- Copy writing rules from memory enforced automatically

### Stage 3: PRODUCE (Programmatic Post-Production)

**This replaces CapCut entirely.** All editing is Python + ffmpeg:

- PIL/Pillow: Stat cards, text overlays, typography, gradient backgrounds
- ffmpeg zoompan: Ken Burns motion on static frames
- ffmpeg drawtext: Animated text overlays with precise timing
- ffmpeg concat: Scene stitching with crossfade/cut transitions
- ffmpeg filter_complex: Audio overlay, fade-in/out, volume normalization
- Beat analysis: Energy detection on audio for cut timing
- Resolution: 1080x1920 (9:16 vertical), 30fps, H.264, AAC audio

**Output specs per platform (auto-generated from one source):**

| Platform | Aspect | Max Duration | Resolution | Format |
|----------|--------|-------------|------------|--------|
| IG Reels | 9:16 | 90s | 1080x1920 | MP4 H.264 |
| IG Stories | 9:16 | 60s (15s segments) | 1080x1920 | MP4 H.264 |
| IG Feed Post | 4:5 | 60s | 1080x1350 | MP4 H.264 |
| TikTok | 9:16 | 10min | 1080x1920 | MP4 H.264 |
| FB Reels | 9:16 | 90s | 1080x1920 | MP4 H.264 |
| YouTube Shorts | 9:16 | 60s | 1080x1920 | MP4 H.264 |
| Google Business | 16:9 or 1:1 | Photo only | 1200x900 | JPEG/PNG |

The agent generates all platform variants from one master render. Aspect ratio crops, duration trims, and caption reformats happen automatically.

### Stage 4: DRAFT (Review Before Publish)

After production, the agent:

1. Saves the rendered video to `SOCIAL MEDIA MANAGER/drafts/YYYY-MM-DD_[slug].mp4`
2. Saves the platform captions to `SOCIAL MEDIA MANAGER/drafts/YYYY-MM-DD_[slug]_captions.md`
3. Sends Matt a link: "Here's the draft. [View video](computer:///path/to/draft.mp4)"
4. Includes: thumbnail preview, caption for each platform, posting time recommendation, hashtag set
5. Waits for Matt's approval ("looks good" / "change X")

**Draft states:**
- `draft` — waiting for review
- `approved` — ready to publish
- `revision` — needs changes (agent iterates)
- `killed` — don't publish

### Stage 5: PUBLISH (All Channels)

On approval, the agent publishes to every relevant channel via API:

**Instagram Reels:**
- Meta Graph API: POST /{ig-user-id}/media (media_type=REELS)
- Then POST /{ig-user-id}/media_publish
- ENV: `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`
- Video must be at a publicly accessible HTTPS URL (upload to Supabase Storage or R2 first)

**Facebook Reels:**
- Meta Graph API: POST /{page-id}/video_reels
- ENV: `META_PAGE_ACCESS_TOKEN`, `META_FB_PAGE_ID`

**TikTok:**
- TikTok Content Posting API (OAuth2 flow required)
- ENV: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`
- NOTE: OAuth access token needs to be obtained once via browser redirect, then refreshed programmatically

**YouTube Shorts:**
- YouTube Data API v3: videos.insert (resumable upload)
- ENV: Google OAuth or Service Account
- Tags: #BendOregon #RealEstate #CentralOregon #Shorts

**Google Business Profile:**
- Local Posts API: accounts.locations.localPosts.create
- ENV: Google Service Account credentials
- Photo or text post only (no video on GBP)

**LinkedIn (future):**
- Not yet keyed. Would need LinkedIn Marketing API access.

**Post-Publish Checklist (automated):**
- [ ] DM CTA included in caption
- [ ] Hashtags: 5-15 per platform
- [ ] First comment with additional hashtags (IG strategy)
- [ ] Cross-post timing: IG first, then TikTok 2hrs later, FB 4hrs later
- [ ] Log post ID and timestamp to Supabase

### Stage 6: MONITOR (Performance Feedback Loop)

**Daily (automated via scheduled task):**
- Pull IG insights for all posts from last 7 days (plays, reach, shares, saves, DMs, avg watch time)
- Pull TikTok analytics (views, likes, shares, comments, completion rate)
- Store in Supabase `social_metrics_weekly` table

**Weekly (Monday morning):**
- Agent generates performance report
- Top performer and worst performer identified
- Completion rate, share rate, save rate ranked
- Recommendations for next week's content mix

**Monthly:**
- Follower growth across all channels
- Content pillar performance breakdown
- Best posting times analysis
- Format comparison (which video styles perform best)

**Feedback into content creation:**
- High-performing formats get repeated
- Low-performing formats get retired or iterated
- Hook styles, caption approaches, visual treatments tracked
- All learnings stored in analytics skill output files

---

## API Keys Status

| Service | ENV Var | Status | Used For |
|---------|---------|--------|----------|
| Meta Graph (IG+FB) | META_PAGE_ACCESS_TOKEN | KEYED | Publish + Insights |
| Meta IG Account | META_IG_BUSINESS_ACCOUNT_ID | KEYED | IG Publishing |
| Meta FB Page | META_FB_PAGE_ID | KEYED | FB Publishing |
| TikTok | TIKTOK_CLIENT_KEY/SECRET | KEYED (needs OAuth) | TikTok Publishing |
| Replicate (Kling) | REPLICATE_API_TOKEN | KEYED | Video Generation |
| OpenAI (DALL-E) | OPENAI_API_KEY | KEYED | Image Generation |
| Google (GBP+YT) | GOOGLE_SERVICE_ACCOUNT_* | KEYED | GBP Posts + YT Shorts |
| Supabase | SUPABASE_URL/KEY | KEYED | Metrics Storage |
| Upstash Redis | UPSTASH_REDIS_* | KEYED | Rate Limiting |
| Inngest | INNGEST_* | KEYED | Job Queuing |
| xAI (Grok) | XAI_API_KEY | KEYED | Image Generation |
| Synthesia | SYNTHESIA_API_KEY | KEYED | Avatar Video |
| fal.ai | FAL_KEY | KEYED | Video Model Aggregator |
| ElevenLabs | — | NOT KEYED | AI Voiceover |
| Runway | — | NOT KEYED | Alt Video Gen |

---

## Content Format Templates

These are repeatable, schedulable content formats the agent can produce autonomously:

### 1. Friday Hype Reel (Weekly)
- Pull week's market data from Supabase
- 32 beat-synced stat cards, 60 seconds
- City-by-city breakdown, shoutouts, DM CTA
- Publish Friday afternoon

### 2. Listing Launch Package (Per Listing)
- Listing photos from Rich/Framed Visuals
- Kling 3.0 image-to-video: 5s cinematic push on hero shot
- Stat card overlay: price, beds, baths, acreage
- 7 story frames + 1 reel + 1 feed post
- Cross-post to all channels

### 3. Market Commentary (Weekly)
- Data pull from Supabase (median price, days on market, inventory)
- Text-on-gradient stat cards with trends
- 30-45 second reel
- Education pillar content

### 4. Neighborhood Spotlight (Weekly)
- Snowdrift Visuals footage from 19 neighborhoods
- Area stats from Supabase
- 45-60 second tour-style reel
- Lifestyle pillar content

### 5. Quick Tip / Education (2x Weekly)
- Text-only or stat-card format
- 15-30 seconds
- Buying/selling tips, rate updates, process explainers

### 6. Trending Format (As Needed)
- Agent monitors trending audio and formats
- Adapts proven viral formats to real estate content
- Speed: concept to published in under 1 hour

---

## File Storage Convention

```
SOCIAL MEDIA MANAGER/
  drafts/                    # Pre-approval content
    2026-04-18_friday-hype.mp4
    2026-04-18_friday-hype_captions.md
  published/                 # Post-approval archive
    2026-04-18_friday-hype/
      ig_reel.mp4
      tiktok.mp4
      fb_reel.mp4
      yt_short.mp4
      captions.md
      metrics.json           # Performance data
  calendars/                 # Monthly content schedules
    2026-05.md
  audio/                     # Licensed music library
    audio_log.md             # What was used where
  analytics/                 # Performance reports
    weekly/
    monthly/
```

---

## Automation Schedule

| Task | Frequency | Day/Time | Trigger |
|------|-----------|----------|---------|
| Trending audio scout | Weekly | Monday 8am | Scheduled |
| Content calendar review | Weekly | Monday 9am | Scheduled |
| Friday Hype Reel | Weekly | Friday 10am | Scheduled |
| Market commentary | Weekly | Wednesday | Scheduled |
| Neighborhood spotlight | Weekly | Tuesday | Scheduled |
| Analytics pull | Daily | 11pm | Scheduled |
| Weekly performance report | Weekly | Monday 7am | Scheduled |
| Monthly deep review | Monthly | 1st of month | Scheduled |

---

## What Needs to Be Built (Priority Order)

### P0: Get Publishing Working
1. Upload video to Supabase Storage (or Cloudflare R2) to get public URL
2. Wire IG Reel publish via Meta Graph API
3. Wire FB Reel publish via Meta Graph API
4. Complete TikTok OAuth flow (one-time browser step, then programmatic refresh)
5. Wire TikTok publish via Content Posting API

### P1: Get Monitoring Working
6. Create `social_metrics_weekly` table in Supabase
7. Wire IG insights pull (daily cron)
8. Wire weekly performance report generator

### P2: Get Video Generation Working
9. Test Kling 3.0 via Replicate for listing photo-to-video
10. Test Veo 3.1 via Google AI Studio for alternative
11. Build batch generation script (multiple angles per listing)

### P3: Get Full Automation Working
12. Build content calendar auto-execution
13. Wire scheduled tasks for recurring formats
14. Build draft-review-approve-publish flow
15. Connect analytics feedback into content decisions

---

## Hard Rules

- Never publish without Matt's approval (draft stage is mandatory)
- Never use AI-generated video of houses/interiors/people (real photos only for real estate content; AI video for abstract/nature/data viz only)
- DM CTA on every post
- No logo in video frame
- No agent names in shoutouts
- Brand voice enforcement on every caption
- Copy writing rules checked on every text element
- Viral video quality gate cleared on every AI video clip
- All music must be royalty-free / CC licensed (business account safe)
