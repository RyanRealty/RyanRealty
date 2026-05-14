---
name: tools_registry-youtube-data
description: Use this skill when a task involves YouTube Analytics, YouTube Data API, YouTube channel ingestion, per-video retention, average view percentage, watch time, YouTube upload, snapshot-channels-youtube, diagnose-performance on YouTube, or any question about YouTube OAuth scopes, impressions-at-video-dimension, or the daily YouTube cron ingestor. Covers authentication, the two-API architecture (Data + Analytics), the critical scope and impressions gotchas, endpoint patterns, quota cost, and failure modes.
---

# YouTube Data + Analytics Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's ingestion and (future) publishing layer. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/tools_registry/supabase/SKILL.md` — destination for all ingested rows

---

## Scope

**YouTube Data API v3** and **YouTube Analytics API v2** serve different purposes and require separate OAuth scopes. They are never interchangeable — confirm which one you need before writing a call.

| API | What it returns | Required scope |
|---|---|---|
| YouTube Data API v3 | Channel metadata, video list, snippet, statistics (public view/like/comment counts), content details (duration), upload resumable session | `youtube.readonly` or `youtube.upload` |
| YouTube Analytics API v2 | Private analytics metrics: views, watch time, average view percentage, CTR, subscriber churn, card click rate — all date-ranged | `yt-analytics.readonly` |

**Use this tool for:**

| Use case | API to call |
|---|---|
| Pulling channel-level daily analytics (views, watch time, subscribers, retention, CTR) | YouTube Analytics API v2 |
| Pulling per-video analytics (views, watch time, average view percentage, subscribers gained) | YouTube Analytics API v2 with `dimensions=video` |
| Getting video metadata (title, publishedAt, duration) for the ingestor | YouTube Data API v3 `/videos` |
| Listing a channel's recent videos | YouTube Data API v3 `/search` or `/playlistItems` |
| Uploading a video (future publishing) | YouTube Data API v3 upload endpoint with `youtube.upload` scope |

**Do NOT use YouTube Data API for:**

| Data you want | Why not | Use instead |
|---|---|---|
| Audience retention, average view percentage, CTR | Not in Data API v3 — only public `statistics` (views, likes, comments) | YouTube Analytics API v2 |
| Ryan Realty competitor channel stats | Data API quota is only 10k units/day; costly for repeated pulls | Apify `apify/youtube-channel-scraper` (see apify/SKILL.md) |

---

## CRITICAL GOTCHA #1 — Analytics requires its own scope

`youtube.upload` alone does NOT grant access to the YouTube Analytics API. The scopes are entirely separate. Calling the Analytics API with only `youtube.upload` in the token returns:

```
403 ACCESS_TOKEN_SCOPE_INSUFFICIENT
```

**Required scope set for Ryan Realty (all four active as of 2026-05-13 re-auth):**

```
https://www.googleapis.com/auth/youtube.upload        # video upload (future)
https://www.googleapis.com/auth/youtube.readonly      # channel + video metadata
https://www.googleapis.com/auth/yt-analytics.readonly # Analytics API v2
https://www.googleapis.com/auth/youtube.force-ssl     # channel profile writes
```

The re-auth to add `yt-analytics.readonly` was performed 2026-05-13. If a new OAuth flow is built (new Google Cloud project, new OAuth client, refreshed consent screen), all four scopes must be included. A token that is missing `yt-analytics.readonly` will silently succeed at Data API calls and fail only when the first Analytics call fires — a confusing failure mode.

---

## CRITICAL GOTCHA #2 — Impressions are channel-level only; not available at video dimension

The YouTube Analytics API v2 exposes `impressions` and `impressionsClickThroughRate` **only at the channel level** (`ids=channel==MINE`, no `dimensions` parameter). Requesting these metrics at the video dimension (`dimensions=video`) returns:

```
400 Unknown identifier (impressions) given in field parameters.metrics
```

This was verified live 2026-05-13. The ingestor (`lib/youtube.ts` `getYouTubeTopVideoMetrics`) explicitly excludes `impressions` and `impressionsClickThroughRate` from the per-video Analytics query for this reason.

**Architecture consequence:** the ingestor runs two separate Analytics queries per day:

1. **Account scope** — `ids=channel==MINE`, no `dimensions`, includes impressions + CTR.
2. **Video scope** — `ids=channel==MINE`, `dimensions=video`, excludes impressions + CTR.

Any new code that queries per-video Analytics must follow this split. Never add `impressions` or `impressionsClickThroughRate` to a query that also includes `dimensions=video`.

Note: the `videoRows()` function in the route still emits `impressions` and `impressions_click_through_rate` metric rows from the `YouTubeVideoMetrics` interface (values resolve to 0 from the `-1` column index). These rows are architectural placeholders — the values are not meaningful until a future Data API–side query populates them separately.

---

## Authentication

### OAuth 2.0 — Google Cloud

| Variable | Source |
|---|---|
| `YOUTUBE_CLIENT_ID` | Google Cloud Console → Credentials → OAuth 2.0 Client |
| `YOUTUBE_CLIENT_SECRET` | Same OAuth client |
| `YOUTUBE_REDIRECT_URI` | `/api/youtube/callback` (Vercel-hosted) |

**Refresh token storage:** `public.youtube_auth` in Supabase (`id='default'` row). Columns: `access_token`, `refresh_token`, `expires_at`, `updated_at`.

**Authorization URL:** `/api/youtube/authorize` — initiates the Google OAuth consent flow. Visit this when the token is missing or after scope changes.

**Token lifecycle:**

```ts
// lib/youtube.ts — canonical implementation
export async function getYouTubeAccessToken(): Promise<string>
// Reads youtube_auth.access_token. If token is within 60s of expiry,
// calls refreshYouTubeToken(refresh_token) → updates the row → returns
// new access_token. Throws if youtube_auth row is missing.
```

All callers pass the resolved `accessToken` string directly into fetch headers. No caller re-implements refresh logic — always call `getYouTubeAccessToken()`.

---

## Locked most-important metric: `average_view_percentage`

Per the platform playbook (`social_media_skills/platform-best-practices/SKILL.md`), the single most important YouTube metric is **`average_view_percentage`** (audience retention).

**Rationale:** YouTube's recommendation algorithm (Suggested + Browse features) optimizes for watch time and retention. After an initial test window, videos above the channel's baseline retention get expanded distribution; videos below get suppressed. Impressions and CTR determine whether a viewer clicks — but retention determines whether the algorithm keeps showing the video at all.

**How it is stored:** `marketing_channel_daily` rows with `metric='average_view_percentage'`, `scope='video'`, `scope_id=<videoId>`. The account-level version (`scope='account'`, `scope_id=''`) represents the channel average across all content for that day.

**How diagnose.ts uses it:** `lib/marketing-brain/diagnose.ts` detects retention anomalies at the video level. A video whose `average_view_percentage` is significantly above the channel baseline for that content type signals an opportunity (`capitalize_on_spike`). Severity thresholds live in `diagnose.ts`.

**How generate-briefs.ts uses it:** when `diagnose.ts` returns a `capitalize_on_spike` finding on the YouTube channel at high severity, `generate-briefs.ts` emits a `content:market_youtube_longform` action row, assigned to the `video_production_skills/youtube-long-form-market-report` producer.

---

## Endpoint patterns

### YouTube Analytics API v2

Base URL: `https://youtubeanalytics.googleapis.com/v2`

**Account-level daily metrics (channel==MINE, no dimensions):**

```
GET /reports
  ?ids=channel==MINE
  &startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,
           averageViewDuration,averageViewPercentage,cardClickRate,
           cardImpressions,annotationClickThroughRate,likes,comments,shares,
           impressions,impressionsClickThroughRate
Authorization: Bearer {accessToken}
```

**Per-video metrics (dimensions=video, impressions excluded):**

```
GET /reports
  ?ids=channel==MINE
  &startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &metrics=views,estimatedMinutesWatched,averageViewDuration,
           averageViewPercentage,subscribersGained
  &dimensions=video
  &sort=-views
  &maxResults=15
Authorization: Bearer {accessToken}
```

Response shape:

```ts
{
  columnHeaders: { name: string; columnType: string; dataType: string }[]
  rows: (string | number)[][] // first element of each row is the dimension value
}
```

When no data exists for the date (new channel, zero activity, or date is too recent), `rows` is omitted entirely — treat as empty array, not as an error.

### YouTube Data API v3

Base URL: `https://www.googleapis.com/youtube/v3`

**Channel metadata:**

```
GET /channels?mine=true&part=snippet,statistics
Authorization: Bearer {accessToken}
```

**Video metadata (batch by 50 IDs):**

```
GET /videos
  ?id={comma-separated-video-ids}
  &part=snippet,statistics,contentDetails
Authorization: Bearer {accessToken}
```

Returns `snippet.title`, `snippet.publishedAt`, `contentDetails.duration` (ISO 8601 — parse with a duration parser), `statistics.viewCount/likeCount/commentCount`.

**Channel video list (use playlistItems over search to avoid quota cost):**

```
GET /playlistItems
  ?playlistId={uploadsPlaylistId}
  &part=snippet,contentDetails
  &maxResults=50
Authorization: Bearer {accessToken}
```

The uploads playlist ID is `UC` → `UU` prefix swap on the channel ID. **Prefer `/playlistItems` over `/search` for listing own channel videos** — `search.list` costs 100 quota units per call vs. 1 unit for `playlistItems.list`.

---

## Per-video data flow (verified 2026-05-13)

The daily ingestor writes to `public.marketing_channel_daily` (Supabase). A full backfill of 89 days × top-15 videos × 7 metrics per video = approximately 1,166 rows per video scope pass, plus 12 account-scope rows per day.

```
getYouTubeAccessToken()          ← read youtube_auth, auto-refresh if expired
  ↓
getYouTubeAnalyticsDay(date)     ← Analytics API, account scope, 12 metrics
  → upsertMetricRows()           ← 12 rows per day, scope='account', scope_id=''
  ↓
getYouTubeTopVideoMetrics(date)  ← Analytics API, video scope (5 metrics, no impressions)
                                    + Data API v3 /videos (title, publishedAt, duration)
  → upsertMetricRows()           ← up to 7 rows per video × top-15 videos
```

Cron schedule: `app/api/cron/marketing-snapshot-youtube/route.ts`, 06:30 UTC daily.

Backfill: call the route with `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`. The ingestor iterates day-by-day within the date range. Analytics data is available from the channel's creation date; the 30-day lookback window for the video ranking always anchors from the requested `endDate`.

---

## Quota cost (YouTube Data API v3)

YouTube Data API has a **10,000 unit daily quota** (default; can be increased via Google Cloud quota request). Analytics API has a separate, much higher quota.

| Endpoint | Cost |
|---|---|
| `channels.list` | 1 unit |
| `videos.list` (any number of IDs, up to 50) | 1 unit |
| `playlistItems.list` | 1 unit |
| `search.list` | 100 units — expensive; avoid for own-channel video listing |
| Analytics `reports.query` | 0 units (Analytics API has independent quota) |

**Budget at current usage:** the daily cron calls `channels.list` 0× (channel ID is hardcoded from first auth), `videos.list` once per 15-video batch (1 unit), and no `search.list`. Total per-day Data API cost: approximately 1 unit. Well within the 10k limit. If future features add `search.list` calls (competitor recon, etc.), route those through Apify instead.

---

## Future: publishing (`youtube.upload`)

`lib/youtube.ts` exports `uploadYouTubeVideoFromUrl()`, which implements the YouTube resumable upload protocol. It streams the source video URL directly to YouTube's session URL without buffering in memory (avoids Vercel 256 MB function limit).

**Upload flow:**

1. POST to `/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status` with JSON metadata → receive `location` header (session URL).
2. PUT the video stream to the session URL.
3. Response body contains `{ id: string }` — the new YouTube video ID.

**Action type:** `content:market_youtube_longform`. When `generate-briefs.ts` emits this action type, the assigned producer (`video_production_skills/youtube-long-form-market-report`) calls `uploadYouTubeVideoFromUrl()` as its publish step. The upload requires `youtube.upload` scope, which is already in the stored token.

**Metadata fields available:** `snippet.title`, `snippet.description`, `snippet.tags[]`, `snippet.categoryId` (26 = Howto & Style, which is what real estate content typically uses), `status.privacyStatus` (`public`/`private`/`unlisted`), `status.selfDeclaredMadeForKids`, `status.containsSyntheticMedia` (required if ElevenLabs VO or AI-generated footage is present).

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Missing `yt-analytics.readonly` scope | `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` on any Analytics call | Re-authorize at `/api/youtube/authorize`. All four scopes must be included in the consent screen. |
| `impressions` in video-dimension query | `400 Unknown identifier (impressions) given in field parameters.metrics` | Remove `impressions` and `impressionsClickThroughRate` from the per-video metrics list. Query these at account scope only. |
| `youtube_auth` row missing | `Error: YouTube not connected — visit /api/youtube/authorize` on `getYouTubeAccessToken()` | First-time setup: complete OAuth flow at `/api/youtube/authorize`. |
| Token expired, no refresh token | `401` on Analytics or Data API call; refresh token is null in DB | Re-authorize. Google invalidates refresh tokens after 6 months of non-use or if the OAuth client is rotated. |
| Quota exceeded | `403 quotaExceeded` from Data API v3 | Quota resets at midnight Pacific. Do not add `search.list` calls without first budgeting the 100-unit cost. Request a quota increase from Google Cloud Console if the channel grows and needs more frequent video list pulls. |
| New video not yet in Analytics | Analytics rows return zero or empty for video uploaded within 24–48h | Expected behavior — YouTube Analytics processing lag. The ingestor tolerates empty rows (`rows` absent = all-zeros). Backfill once data is available. |
| Analytics zero-row response misread as error | Ingestor throws instead of returning zeros | Callers must check for missing `rows` key before indexing — `json.rows?.[0] ?? []` pattern (already in `getYouTubeAnalyticsDay`). |
| Upload stream failure (Vercel timeout) | `Error: YouTube upload failed: 5xx` | Long-form videos approaching 300s Vercel function limit. Workaround: upload from a local script or a background queue instead of a Vercel function. The resumable session URL is valid for 7 days — can be resumed from a different execution context. |

---

## Existing implementation

**Canonical implementation:** `lib/youtube.ts`. Read it before writing any new YouTube API call. Do not re-implement token refresh, the Analytics query shape, or the upload pattern.

Key exports:

| Function | What it does |
|---|---|
| `getYouTubeAccessToken()` | Reads + auto-refreshes the stored OAuth token |
| `getYouTubeAnalyticsDay(date, accessToken)` | Account-level daily Analytics — 12 metrics |
| `getYouTubeTopVideoMetrics(endDate, accessToken, limit)` | Per-video Analytics (top N by views, 30-day window) + Data API metadata |
| `uploadYouTubeVideoFromUrl(options)` | Resumable upload from a URL — returns the new video ID |

**Cron entry point:** `app/api/cron/marketing-snapshot-youtube/route.ts` (daily 06:30 UTC). Auth: `Authorization: Bearer $CRON_SECRET`. Backfill via `?startDate=&endDate=` query params.

**Brain dependencies:**

| File | How it uses YouTube data |
|---|---|
| `lib/marketing-brain/diagnose.ts` | Queries `marketing_channel_daily` for YouTube `average_view_percentage` anomalies; emits `capitalize_on_spike` findings |
| `lib/marketing-brain/generate-briefs.ts` | Translates high-severity YouTube spikes into `content:market_youtube_longform` action rows |

---

## Pre-flight checklist (before any new YouTube API call)

```
[ ] Confirm which API: Data API v3 (metadata/upload) vs Analytics API v2 (metrics)
[ ] Confirm all four OAuth scopes are in the stored token — especially yt-analytics.readonly
[ ] impressions + impressionsClickThroughRate are NOT in any dimensions=video query
[ ] Token resolved via getYouTubeAccessToken() — never pass raw env vars as the token
[ ] Quota budget checked: no search.list calls without accounting for 100 units each
[ ] New video uploads: set containsSyntheticMedia=true if ElevenLabs VO or AI footage present
[ ] Empty rows handled: rows absent from Analytics response = zeros, not error
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/youtube.ts` | Canonical implementation — token refresh, Analytics queries, upload |
| `app/api/cron/marketing-snapshot-youtube/route.ts` | Daily ingestor cron — account + video scope, upsert pattern |
| `lib/marketing-brain/diagnose.ts` | Retention anomaly detection; YouTube severity thresholds |
| `lib/marketing-brain/generate-briefs.ts` | `capitalize_on_spike` → `content:market_youtube_longform` action row |
| `marketing_brain_skills/tools_registry/supabase/SKILL.md` | `marketing_channel_daily` table schema; upsert pattern |
| `video_production_skills/youtube-long-form-market-report/SKILL.md` | Producer for the `market_youtube_longform` action type |
| `social_media_skills/platform-best-practices/SKILL.md` | Platform rule layer — why `average_view_percentage` is the locked primary metric |
| `CLAUDE.md` "Marketing Brain Architecture" | Status flow, action-type categories, approval gates |
| https://developers.google.com/youtube/v3/docs | YouTube Data API v3 reference |
| https://developers.google.com/youtube/analytics/data_model | YouTube Analytics API v2 — metrics, dimensions, filters |
| https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas | Quota monitor + increase requests |
