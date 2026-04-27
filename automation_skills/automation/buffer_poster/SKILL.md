---
name: buffer_poster
description: Schedules and publishes posts to IG, FB, TikTok, YouTube, LinkedIn, X, Pinterest, Threads via the Buffer API. Use when Matt wants one-click multi-platform distribution without wiring each platform's native API directly.
---

# Buffer Poster

## What it is

A thin wrapper around the Buffer Publish API that lets the autonomous content engine fire one
HTTP call per asset and have it land on every connected channel. Buffer handles each platform's
quirks (token refresh, image/video specs, hashtag rendering, scheduling windows). The wrapper
enforces our pre-publish gate (`ANTI_SLOP_MANIFESTO.md` + `VIRAL_GUARDRAILS.md` scorecard)
before any post leaves the building.

This skill is an alternative to `post_scheduler/`. Use Buffer when:
- We do not want to maintain OAuth flows for 7+ platforms ourselves.
- We are early in the channel-building phase and Buffer's UI is the source of truth for a
  human review pass.
- We want Buffer's analytics rollup across channels rather than aggregating native dashboards.

Use the native `post_scheduler/` when:
- We need lower latency (sub-5-minute posts vs Buffer's queue-aware scheduling).
- We need access to fields Buffer abstracts away (Reels' `share_to_feed`, YouTube Shorts'
  `notify_subscribers`, LinkedIn org vs personal posts, X poll attachments).
- Per-platform throughput exceeds Buffer's plan limits.

## Pre-publish gate (MANDATORY — same bar as post_scheduler)

Before any Buffer API call, verify:

1. **`ANTI_SLOP_MANIFESTO.md` enforcement** — banned-word grep clean, citations.json present
   if claims are made, AI disclosure pill present if AI assets used, fair-housing language
   scan clean, ElevenLabs (not generic TTS) for any VO.
2. **`VIRAL_GUARDRAILS.md` scorecard** — `scorecard.json` next to the asset, `total >=`
   format minimum (listing 85, market 80, neighborhood 80, meme 75, earth-zoom 85, default
   80), zero `auto_zero_hits`.
3. **`docs/MASTER_SPEC.md` data-accuracy check** — every stat in the caption traces to
   Supabase, ORMLS, NAR, Census, or a primary URL. If a number cannot be traced, the post is
   rejected back to `pending_human_review`.

A post that fails any gate is NOT sent to Buffer. It is written back to
`post_queue.review_status = 'rejected_pregate'` with the failing categories serialized in
`post_queue.gate_failures` and surfaced in `/admin/post-queue`.

## Buffer API surface (v2)

Base URL: `https://api.bufferapp.com/2/`. All requests use `Authorization: Bearer <TOKEN>`.

| Endpoint | Method | Use |
|---|---|---|
| `/profiles.json` | GET | List connected channel IDs once at boot, cache by service name |
| `/updates/create.json` | POST | Schedule or publish a post (multipart for media) |
| `/updates/<id>/destroy.json` | POST | Cancel a scheduled post that has not been sent |
| `/updates/<id>.json` | GET | Read status, sent_at, service_link |
| `/updates/<id>/update.json` | POST | Edit text/scheduled_at on a queued post |

Buffer rate limits: 60 req/min per access token at the Essentials/Team tier; 300 req/min on
Agency. We stay well under this by batching one cron tick per 5 minutes.

## Configuration

Set in `.env.local`:

```
BUFFER_ACCESS_TOKEN=<long-lived OAuth token from buffer.com/oauth>
BUFFER_PROFILE_INSTAGRAM=<profile id>
BUFFER_PROFILE_FACEBOOK=<profile id>
BUFFER_PROFILE_TIKTOK=<profile id>
BUFFER_PROFILE_YOUTUBE=<profile id>
BUFFER_PROFILE_LINKEDIN=<profile id>
BUFFER_PROFILE_X=<profile id>
BUFFER_PROFILE_PINTEREST=<profile id>
BUFFER_PROFILE_THREADS=<profile id>
```

The OAuth token is issued by Buffer once Matt connects his Buffer account at
`https://buffer.com/developers/api`. The token is long-lived; rotate it via the same console
if compromised.

## Trigger

```
GET /api/cron/buffer-poster
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: */5 * * * *   (vercel.json)
```

Manual test mode:
```
GET /api/cron/buffer-poster?force=true&post_id=<uuid>
```

## Worker flow

For each row in `post_queue` where `status='approved'` and `provider='buffer'` and
`scheduled_at <= now()` and `retries < 3`:

1. Run pre-publish gate (above). On fail → mark rejected_pregate, alert Matt, skip.
2. Resolve target Buffer profile IDs from `post_queue.platforms[]`.
3. For each platform:
   a. Build the Buffer payload — `text`, `media[picture]` or `media[video]`, `profile_ids[]`,
      `now=true` if scheduled_at is past, else `scheduled_at` ISO string.
   b. POST to `/updates/create.json`. On 2xx, write `buffer_update_id` and
      `published_at = now()` back to `post_queue`.
   c. On 4xx, parse Buffer's error message:
      - `Authorization` failures → mark `pending_token_refresh`, page Matt.
      - Rate limit (`429`) → exponential backoff, requeue.
      - Asset rejected (file too large, wrong aspect ratio, etc.) → mark
        `rejected_asset`, write the asset spec violation to `post_queue.gate_failures`,
        page Matt.
   d. On 5xx → exponential backoff, increment retries.
4. After all platforms attempted, write a `post_queue_dispatch` row with the
   per-platform outcome.

## Asset specs Buffer enforces (we mirror these in pre-flight)

| Platform | Image | Video |
|---|---|---|
| Instagram Feed | 1080×1080 (1:1) or 1080×1350 (4:5), JPG/PNG ≤ 8MB | MP4 H.264, ≤ 60s, 1080×1080 or 1080×1350, ≤ 100MB |
| Instagram Reels | n/a | MP4 H.264, 9:16, 1080×1920, 3–90s, ≤ 100MB |
| TikTok | n/a | MP4 H.264, 9:16, 1080×1920, 3–60s, ≤ 287MB |
| YouTube Shorts | n/a | MP4, 9:16, 1080×1920, ≤ 60s |
| Facebook | 1200×630 (link), 1080×1080 (feed) | MP4, ≤ 4GB, ≤ 240min |
| LinkedIn | 1200×627 (article), 1200×1200 (square) | MP4 H.264, ≤ 10 min, ≤ 5GB |
| X | 1200×675 or 1200×1200, ≤ 5MB | MP4 H.264, ≤ 140s, ≤ 512MB |
| Pinterest | 1000×1500 (2:3), ≤ 32MB | MP4, 9:16 or 1:1, ≤ 30 min, ≤ 2GB |
| Threads | 1080×1080, ≤ 8MB | MP4, ≤ 5min |

If the asset does not match the per-platform spec, the worker invokes
`automation_skills/automation/post_scheduler/asset_resize.ts` to derive the right variant
before posting (preserves the master, writes a `<asset>_<platform>.mp4` next to it).

## Captions, hashtags, mentions

Captions come from `post_queue.caption_per_platform` — a JSON map keyed by platform name.
This lets us write platform-native captions (longer for IG, hashtags front-loaded for TikTok,
single sentence for X) instead of one generic caption rendered everywhere. The trigger that
seeds the queue (`listing_trigger`, `market_trigger`, `trend_trigger`) is responsible for
producing per-platform variants — the Buffer poster does NOT rewrite captions.

If a row's `caption_per_platform` map is missing a key, Buffer poster falls back to
`post_queue.caption_default` and tags the dispatch row with `caption_fallback=true` so we can
audit which platforms got generic copy.

## Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Buffer token expired | `401 Unauthorized` from any endpoint | Mark all pending Buffer rows `pending_token_refresh`, send Matt a Resend email with the buffer.com/oauth re-auth link |
| Profile disconnected | `403 The Buffer profile id <X> does not exist or has been disabled` | Mark the row's platform-specific dispatch as `disconnected`, continue with other platforms, alert Matt |
| Asset rejected | `400 The media is not a supported file type` etc. | Run `asset_resize.ts`, retry once. If still failing, surface in `/admin/post-queue` |
| Buffer service down | `5xx` for >10 min on health-check | Failover to native `post_scheduler` for IG/FB/TikTok/YouTube/LinkedIn (X/Pinterest/Threads remain queued) |

## Telemetry

Each dispatch writes to `post_queue_dispatch`:

| Field | Type | Description |
|---|---|---|
| `id` | uuid | Dispatch row id |
| `post_id` | uuid | FK to post_queue |
| `provider` | text | `'buffer'` |
| `platform` | text | `instagram_reels` / `tiktok` / etc. |
| `buffer_update_id` | text | Buffer's update id, used to fetch sent_at + service_link |
| `outcome` | text | `'sent'` / `'rejected_pregate'` / `'rejected_asset'` / `'failed_5xx'` / `'pending_token_refresh'` |
| `latency_ms` | integer | Round-trip to Buffer |
| `error_body` | text | Buffer's response body on failure |
| `created_at` | timestamptz | |

`/admin/post-queue` reads this table to show per-platform outcome at a glance.

## Why a thin wrapper, not Buffer's full SDK

We do not import `@bufferapp/api`. The wrapper is ~120 lines of typed `fetch` calls in
`app/api/cron/buffer-poster/route.ts`. Reasons:

- The official SDK is unmaintained (last release 2019) and has bundling issues on Edge runtime.
- The Buffer API surface we use is small (5 endpoints).
- We want to log every request/response body for compliance — easier with raw fetch.

## Open questions

1. **Multi-channel attribution.** Buffer reports analytics per platform; we want to roll
   up engagement to the source asset across platforms. Need to wire Buffer's analytics
   endpoint to our `content_performance` table so the `performance_loop` skill can score
   formats correctly.
2. **Threads token scope.** Threads via Buffer requires the Instagram-account-linked Threads
   profile. Confirm Buffer's coverage matches what Meta exposes.
3. **YouTube Shorts vs YouTube long-form.** Buffer routes both via the same profile id; we
   need to flag which is which in `post_queue.platforms[]` (`youtube_shorts` vs `youtube`).

## Related

- `automation_skills/automation/post_scheduler/SKILL.md` — native fallback worker.
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — gate that produces `scorecard.json`.
- `social_media_skills/platforms/*` — per-platform spec compliance and caption length rules.

## Implementation status

Skill is **scaffolded only** as of 2026-04-26. The worker route, schema migration, and
admin UI panel are NOT yet built. Next implementation steps in order:

1. Migration: `post_queue.provider` text, `post_queue_dispatch` table.
2. `app/api/cron/buffer-poster/route.ts` — worker.
3. `app/admin/post-queue/page.tsx` — review + retry UI.
4. Buffer OAuth setup walkthrough in `docs/setup/buffer-oauth.md`.
5. Backfill `caption_per_platform` for the next 14 days of queued posts.
