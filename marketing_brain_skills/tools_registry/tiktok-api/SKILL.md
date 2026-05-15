---
name: tools_registry-tiktok-api
description: Use this skill when a task involves "TikTok API", "TikTok video list", "TikTok profile metrics", "TikTok audience", "snapshot-channels-tiktok", "tiktok_auth", "completion_rate TikTok", "TikTok OAuth", "TikTok open_id", "fields param", "Research API TikTok", or any task that reads or writes Ryan Realty's own TikTok account via the TikTok Open Platform API v2. This skill governs own-account ingestion and (future) publishing. For competitor TikTok scraping, use the Apify tool skill instead.
---

# TikTok API v2 Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's channel-snapshot and (future) publishing layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/tools_registry/apify/SKILL.md` — competitor TikTok scraping (separate tool, separate scope)

---

## Scope

**Use TikTok API v2 for:**

| Use case | Why this API |
|---|---|
| Own-account video list with engagement metrics (views, likes, comments, shares) | Official OAuth-gated endpoint — only way to read own-account stats reliably |
| Own-account profile metrics (follower count, following count, cumulative likes, video count) | `user.info.stats` scope; no scraping needed |
| Bootstrapping `open_id` for a token row | Required by many v2 endpoints; fetched via `/v2/user/info/` |
| Token lifecycle management (exchange code, refresh) | OAuth 2.0 token endpoints |
| Future: publishing videos to `@ryanrealtybend` | Content Posting API — separate tier, not yet wired |

**Do NOT use TikTok API v2 for:**

| Data source | Use instead |
|---|---|
| Competitor TikTok profiles and videos | `clockworks/free-tiktok-scraper` via Apify (see `tools_registry/apify/SKILL.md`) |
| `completion_rate`, reach, traffic-source breakdown, audience demographics | Research API tier (paid, requires application approval — not currently subscribed) |
| Ryan Realty's own Meta / YouTube / Instagram metrics | Their respective tool skills in this registry |

**The division is strict:** own-account reads via official API; competitor reads via Apify scraping. Never flip them.

---

## Authentication

### Env vars

| Variable | Purpose | Where stored |
|---|---|---|
| `TIKTOK_CLIENT_KEY` | App's client key from TikTok Developer portal | `.env.local`, Vercel env |
| `TIKTOK_CLIENT_SECRET` | App's client secret | `.env.local`, Vercel env |
| `TIKTOK_REDIRECT_URI` | OAuth callback URL (`/api/auth/tiktok/callback`) | `.env.local`, Vercel env |

### Token table — `public.tiktok_auth` (Supabase)

The OAuth access token is persisted in Supabase, not in Redis or env vars. Row `id = 'default'` is the singleton row for Ryan Realty's own account.

| Column | Type | Notes |
|---|---|---|
| `id` | text | `'default'` — singleton |
| `access_token` | text | Bearer token; short-lived (~24h) |
| `refresh_token` | text | Long-lived; used to regenerate access_token |
| `expires_at` | timestamptz | Refresh if within 5 minutes of expiry |
| `open_id` | text | **Added 2026-05-13.** Required by many v2 endpoints. Older rows have NULL — see backfill logic below. |
| `updated_at` | timestamptz | Updated on every token refresh or open_id backfill |

### open_id backfill (critical for older rows)

`open_id` was added to the `tiktok_auth` table on 2026-05-13. Rows created before that date have `NULL`. The `getValidToken()` helper in `app/api/cron/marketing-snapshot-tiktok/route.ts` handles this automatically:

```ts
// If open_id is NULL, fetch from /v2/user/info/ and persist back
let openId = data.open_id
if (!openId) {
  openId = await fetchOpenIdFromTikTok(accessToken)
  await supabase
    .from('tiktok_auth')
    .update({ open_id: openId, updated_at: new Date().toISOString() })
    .eq('id', 'default')
}
```

Any new code that needs `open_id` must call `getValidToken()` — do not read `open_id` directly from the row without the backfill guard.

### OAuth scopes granted

The current app has been authorized with these scopes:

| Scope | What it unlocks |
|---|---|
| `user.info.basic` | `open_id`, `union_id`, `avatar_url`, `display_name` |
| `user.info.profile` | Extended profile fields |
| `user.info.stats` | `follower_count`, `following_count`, `likes_count`, `video_count` |
| `video.list` | Own-account video list with per-video engagement metrics |
| `video.upload` | Upload a video to the Content Posting API (future) |
| `video.publish` | Publish a staged video (future) |

Research API scopes (`research.video.query`, etc.) are NOT granted — they require a separate application and approval process.

---

## CRITICAL GOTCHA — `fields` goes in the query string, NOT the body

**This is the #1 source of silent 400 errors on `POST /v2/video/list/`.**

`POST /v2/video/list/` takes `fields` as a **URL query parameter**, not as a key in the JSON body. `max_count` and `cursor` DO go in the body.

```ts
// CORRECT — fields in query string
const fields = 'id,title,video_description,view_count,like_count,comment_count,share_count,duration,create_time,cover_image_url'
const resp = await fetch(
  `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ max_count: 20, cursor }),   // NO fields here
  }
)
```

```ts
// WRONG — fields in body returns 400 Bad Request with no useful error message
body: JSON.stringify({ max_count: 20, fields: '...' })
```

Verified live 2026-05-13. The same pattern applies to `GET /v2/user/info/` — `fields` is a query param there too (the method is GET, so the body distinction is moot, but document it here for consistency).

---

## Endpoint patterns

Base URL: `https://open.tiktokapis.com/v2`

### `POST /v2/oauth/token/` — token exchange and refresh

Content-Type: `application/x-www-form-urlencoded` (NOT JSON).

**Exchange auth code for tokens:**

```ts
const body = new URLSearchParams({
  client_key: TIKTOK_CLIENT_KEY,
  client_secret: TIKTOK_CLIENT_SECRET,
  code,
  grant_type: 'authorization_code',
  redirect_uri: TIKTOK_REDIRECT_URI,
})
await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
})
```

**Refresh an existing token:**

```ts
const body = new URLSearchParams({
  client_key: TIKTOK_CLIENT_KEY,
  client_secret: TIKTOK_CLIENT_SECRET,
  refresh_token: storedRefreshToken,
  grant_type: 'refresh_token',
})
```

Response shape: `{ access_token, refresh_token, expires_in, token_type, scope? }`.

Canonical implementation: `lib/tiktok.ts` — `exchangeCodeForToken()`, `refreshAccessToken()`.

### `GET /v2/user/info/` — profile metrics and open_id

Fields available under current scopes:

| Field | Scope required |
|---|---|
| `open_id`, `union_id`, `avatar_url`, `display_name` | `user.info.basic` |
| `follower_count`, `following_count`, `likes_count`, `video_count` | `user.info.stats` |

```ts
// Fetch stats for the daily snapshot
const fields = 'follower_count,following_count,likes_count,video_count'
await fetch(
  `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
)
// Response: { data: { user: { follower_count, following_count, likes_count, video_count } }, error? }
```

All account metrics are **current snapshots**, not daily deltas. The brain computes deltas by comparing consecutive `marketing_channel_daily` rows.

### `POST /v2/video/list/` — own-account video list

Paginated. Returns videos newest-first. `cursor` is an opaque integer (not a page number or offset).

**Fields available under `video.list` scope at current tier:**

```
id, title, video_description, view_count, like_count, comment_count,
share_count, duration, create_time, cover_image_url
```

**Fields that require Research API (NOT available):**

```
play_duration_seconds, completion_rate, reach, profile_views,
audience_demographics, traffic_source_breakdown, video_impressions
```

Pagination pattern (from `app/api/cron/marketing-snapshot-tiktok/route.ts`):

```ts
let cursor: number | undefined = undefined
let hasMore = true

while (hasMore) {
  const body: Record<string, unknown> = { max_count: 20 }
  if (cursor !== undefined) body.cursor = cursor

  const resp = await fetch(
    `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await resp.json()
  // data.data.videos[], data.data.has_more, data.data.cursor
  hasMore = data.data?.has_more ?? false
  cursor = data.data?.cursor
}
```

Safety cap: bail at 200 videos to prevent runaway pagination. Daily ingestor further stops pagination once `create_time` falls outside the 30-day window.

**Note on cumulative stats:** `view_count`, `like_count`, etc. are **cumulative totals at call time**, not daily increments. The daily cron captures a point-in-time snapshot; deltas are computed by the brain across consecutive rows. This also means backfill runs stamp the same cumulative values across multiple date rows — useful for establishing a per-video baseline row, not for reconstructing historical daily deltas.

### `POST /v2/research/video/query/` — Research API (tier-gated)

NOT currently subscribed. This endpoint unlocks `completion_rate`, `reach`, cross-account search, and demographic breakdowns. Requires a separate Research API application to TikTok, paid tier.

This endpoint is documented here so future producers know it exists and know to surface a budget decision to Matt before wiring it in.

---

## Rate limits and tier

| Tier | Limit | Current status |
|---|---|---|
| Free / Basic (own-account reads) | ~100 RPM generously for `video.list`, `user/info` | Active |
| Research API | Paid; separate application required | Not subscribed |
| Content Posting API | Requires `video.upload` + `video.publish` scopes + sandbox approval | Scopes granted; not yet wired |

At current usage (one daily cron, ~2 API calls per run — one for user stats, one paginated video list), Ryan Realty is well within the free tier. Rate limits only matter if a new producer starts polling intra-day.

Pagination safety: never call `video.list` in a tight loop without a cursor. Each page (up to 20 items) counts as one API call.

---

## Cost

The TikTok Open Platform API is **free at the current tier** for own-account reads. No per-call cost, no compute unit model (that's Apify's model, not TikTok's).

**Research API tier** cost is TBD — Matt decision pending. That tier unlocks `completion_rate`, the platform-playbook's locked most-important metric. Until the budget call is made, `completion_rate` is not ingested and not surfaced in brain diagnoses.

---

## Where results land

Daily ingestion writes to `public.marketing_channel_daily` in Supabase (`dwvlophlbvvygjfxcrhm`), via the shared `upsertMetricRows()` helper from `lib/marketing-brain/snapshot.ts`.

**Row schema per metric:**

| Column | Example value |
|---|---|
| `date` | `'2026-05-15'` |
| `channel` | `'tiktok'` |
| `scope` | `'account'` or `'video'` |
| `scope_id` | `''` (account) or `'<video_id>'` |
| `metric` | `'followers_count'`, `'views'`, `'likes'`, etc. |
| `value` | numeric |
| `source` | `'tiktok_business_api_v2'` |
| `metadata` | jsonb — video rows carry `description`, `title`, `created_at`, `duration_seconds`, `cover_image_url` |

**Account-scope metrics (daily snapshot):**

- `followers_count` — current follower total
- `following_count`
- `likes_count` — cumulative profile likes
- `video_count` — total public videos

**Video-scope metrics (per video, last 30 days):**

- `views`, `likes`, `comments`, `shares`

---

## Existing implementation

| File | Purpose |
|---|---|
| `lib/tiktok.ts` | Core OAuth and Content Posting API helpers: `getAuthorizationUrl`, `exchangeCodeForToken`, `refreshAccessToken`, `getUserInfo`, `initVideoUpload`, `uploadVideoChunk`, `publishVideo`, `getVideoStatus`, `directPostVideo` |
| `app/api/cron/marketing-snapshot-tiktok/route.ts` | Daily ingestor: `getValidToken` (with open_id backfill), `fetchUserStats`, `fetchRecentVideos`, row builders, pagination loop |

Read these files before writing any new TikTok API call. The `getValidToken()` function in the cron route is the canonical token-fetch pattern — do not re-implement auth inline. The `refreshAccessToken()` function in `lib/tiktok.ts` is the canonical refresh helper.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `fields` in request body | 400 Bad Request, no detailed error body | Move `fields` to query string (`?fields=...`); see CRITICAL GOTCHA section above |
| Access token expired | 401 on `/v2/video/list/` or `/v2/user/info/` | `getValidToken()` auto-refreshes via stored `refresh_token`. If refresh also fails (401 on token endpoint), the OAuth flow must be re-run at `/api/auth/tiktok/authorize` |
| `open_id` NULL on existing row | Endpoints that require `open_id` fail or behave unexpectedly | `getValidToken()` auto-backfills via `/v2/user/info/?fields=open_id` and persists to `tiktok_auth`. Only an issue on rows created before 2026-05-13. |
| No `tiktok_auth` row | `Error: No TikTok auth row found` on cold start | Matt must complete the OAuth flow at `/api/auth/tiktok/authorize` to create the initial row |
| `refresh_token` missing or expired | Refresh attempt fails; ingestor returns 500 | Refresh tokens also expire (typically 365 days). Re-run the OAuth flow. Token-heartbeat cron should alert if the ingestor returns non-200 three days in a row. |
| 429 rate limit | `Too many requests` from TikTok | Back off with exponential delay. Current daily cron is nowhere near limits — this would only fire if multiple processes hit the API simultaneously. |
| Research API scope error | 403 or `access_denied` error code when requesting `completion_rate` or `reach` | These fields are tier-gated. Do not request them with the current token; they will not succeed. Upgrade path: Matt approves Research API tier application. |
| Content Posting API not wired | `initVideoUpload` / `publishVideo` exist in `lib/tiktok.ts` but no publisher cron calls them | Expected state — the publisher layer is planned, not live. Do not invoke the upload helpers without a publisher cron that handles the full init → upload chunks → publish → poll-status lifecycle. |

---

## Pending decisions

| Decision | Blocking | Detail |
|---|---|---|
| Research API tier subscription | `completion_rate` ingestion | Per platform-best-practices, `completion_rate` is TikTok's locked most-important algorithmic signal. Currently tier-gated. Matt approves budget before this is wired. |
| Content Posting API go-live | TikTok publisher cron | OAuth scopes are already granted (`video.upload`, `video.publish`). The `lib/tiktok.ts` helpers are scaffolded. The missing piece is the publisher cron at `app/api/cron/marketing-publisher-tiktok/` and Matt's approval to begin posting. |

---

## Used by

| Consumer | How |
|---|---|
| `app/api/cron/marketing-snapshot-tiktok/route.ts` | Daily ingestion — runs at 06:30 UTC, writes account + video metrics to `marketing_channel_daily` |
| `marketing-brain:diagnose-performance` (channel=`'tiktok'`) | Reads `marketing_channel_daily` for TikTok rows; surfaces trend analysis and anomalies |
| Future publisher | TikTok Content Posting API via `lib/tiktok.ts` — not yet wired |

---

## Pre-flight checklist (before any new TikTok API call)

```
[ ] TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET confirmed in .env.local
[ ] tiktok_auth row with id='default' exists in Supabase (run OAuth flow if missing)
[ ] Using getValidToken() from the cron route — not reading the token row directly
[ ] fields param is in the QUERY STRING (?fields=...), not the JSON body
[ ] Not requesting completion_rate, reach, or any Research API field with current scopes
[ ] Pagination loop has a safety cap (200 items) and a time-window break
[ ] Results write to marketing_channel_daily via upsertMetricRows() — not a custom table
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `app/api/cron/marketing-snapshot-tiktok/route.ts` | Canonical ingestor — read before writing any new TikTok ingestion code |
| `lib/tiktok.ts` | Core helpers: OAuth, token refresh, Content Posting API scaffolding |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Competitor TikTok scraping via `clockworks/free-tiktok-scraper` |
| `social_media_skills/platform-best-practices/SKILL.md` | TikTok cadence target (5/wk), locked metric (`completion_rate`), algorithm brief |
| `lib/marketing-brain/snapshot.ts` | Shared `upsertMetricRows()`, `MetricRow`, `IngestorResult` types |
| https://developers.tiktok.com/doc/ | Official v2 API reference |
| https://developers.tiktok.com/doc/tiktok-api-v2-video-list | `video.list` endpoint — fields, pagination, scope requirements |
| https://developers.tiktok.com/doc/research-api-get-started | Research API overview — upgrade path for `completion_rate` |
