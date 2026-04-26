---
name: post_scheduler
description: Drains post_queue every 5 minutes and publishes to IG, FB, TikTok, YouTube, and LinkedIn via their APIs with retry and human-review gating.
---

# Post Scheduler

## What it is

The `post_scheduler` is a cron-driven worker that drains the `post_queue` table and calls each
platform's publishing API. It runs every 5 minutes. Posts in `pending_human_review` status are
skipped until Matt approves them at `/admin/post-queue`. Posts that pass review are published at
their scheduled window. Failures are written to `post_failures` with exponential backoff up to 3
retries, then an alert is sent to Matt via Resend.

## Trigger

```
GET /api/cron/post-scheduler
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: */5 * * * *   (vercel.json)
```

The route is also invokable manually for testing:
```
GET /api/cron/post-scheduler?force=true&post_id=<uuid>
```

## Inputs

Reads from `post_queue` WHERE:
```sql
status = 'approved'
AND review_status != 'pending_human_review'
AND review_status != 'rejected'
AND scheduled_at <= now()
AND retries < 3
ORDER BY scheduled_at ASC
LIMIT 10;   -- batch cap per cron run
```

Each `post_queue` row contains:

| Field | Type | Description |
|---|---|---|
| `id` | uuid | Post identifier |
| `platform` | text | 'instagram' \| 'facebook' \| 'tiktok' \| 'youtube' \| 'linkedin' |
| `media_type` | text | 'reel' \| 'image' \| 'video' \| 'short' |
| `media_url` | text | CDN URL of finalized media file |
| `caption` | text | Platform-formatted caption |
| `scheduled_at` | timestamptz | Optimal publish window |
| `review_status` | text | 'pending_human_review' \| 'approved' \| 'rejected' |
| `hashtag_set` | text[] | Platform-specific hashtag array |
| `cover_url` | text | Thumbnail URL (TikTok, YouTube) |
| `platform_metadata` | jsonb | Per-platform extras (YT chapter markers, LI text block, etc.) |

## Outputs

| Artifact | Destination |
|---|---|
| Published post ID | `post_queue.platform_post_id` (updated on success) |
| Success status | `post_queue.status = 'published'` |
| Failure record | `post_failures` row with error + next retry time |
| Performance baseline | `post_performance` row created with 0 metrics (updated by `performance_loop`) |

## Pipeline

### Per-post publish flow

1. **Lock the row** (prevent double-publish from concurrent cron runs)
   ```sql
   UPDATE post_queue SET status = 'publishing', started_at = now()
   WHERE id = $post_id AND status = 'approved'
   RETURNING *;
   ```
   If zero rows updated: another worker grabbed it. Skip.

2. **Dispatch to platform handler** (see per-platform section below).

3. **On success:**
   ```sql
   UPDATE post_queue
   SET status = 'published',
       platform_post_id = $returned_id,
       published_at = now()
   WHERE id = $post_id;

   INSERT INTO post_performance
     (post_queue_id, platform, published_at, reach, impressions,
      saves, shares, comments, follows, ctr, completion_rate)
   VALUES ($post_id, $platform, now(), 0, 0, 0, 0, 0, 0, 0, 0);
   ```

4. **On failure:**
   ```sql
   UPDATE post_queue
   SET status = 'approved',   -- reset so retry cron picks it up
       retries = retries + 1,
       last_error = $error_message,
       next_retry_at = now() + (power(2, retries) * interval '1 minute')
   WHERE id = $post_id;

   INSERT INTO post_failures
     (post_queue_id, platform, error_code, error_message,
      http_status, attempt_number, occurred_at)
   VALUES ($post_id, $platform, $error_code, $error_message,
           $http_status, retries + 1, now());
   ```
   After `retries = 3`: set `status = 'dead'` and send Resend alert to Matt.

### Per-platform details

#### Instagram (Meta Graph API)

**Reel / video:**
```
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
  params: media_type=REELS, video_url=<url>, caption=<text>, share_to_feed=true
  -> returns: { id: <creation_id> }

POST https://graph.facebook.com/v22.0/{ig-user-id}/media_publish
  params: creation_id=<creation_id>
  -> returns: { id: <post_id> }
```

**Image:**
```
POST https://graph.facebook.com/v22.0/{ig-user-id}/media
  params: image_url=<url>, caption=<text>
POST https://graph.facebook.com/v22.0/{ig-user-id}/media_publish
  params: creation_id=<creation_id>
```

Auth: `META_ACCESS_TOKEN` (long-lived page token, 60 days). Refresh via:
```
GET https://graph.facebook.com/v22.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```
Token refresh is automated: cron `/api/cron/refresh-meta-token` runs every 50 days.

Rate limit: 200 API calls / hour per user token. Scheduler batches 10 posts max per run.

Optimal windows: Tue/Wed/Thu 8-10am, 6-8pm PT. Encoded in `post_queue.scheduled_at` by
`social_calendar` skill.

#### Facebook (Meta Graph API)

**Reel:**
```
POST https://graph.facebook.com/v22.0/{page-id}/video_reels
  params: upload_phase=start, video_size=<bytes>
  -> returns: { video_id, upload_url }
// Upload binary to upload_url via PUT
POST https://graph.facebook.com/v22.0/{page-id}/video_reels
  params: upload_phase=finish, video_id=<id>, description=<caption>
```

**Photo/image:**
```
POST https://graph.facebook.com/v22.0/{page-id}/photos
  params: url=<image_url>, message=<caption>
```

Auth: same page token as Instagram (`META_ACCESS_TOKEN`).
Rate limit: 200 calls / hour, shared with IG on same app.

#### TikTok (Content Posting API v2)

**Direct post flow** (video already uploaded to CDN):
```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
  Header: Authorization: Bearer <TIKTOK_ACCESS_TOKEN>
  Body: {
    post_info: { title, privacy_level: "PUBLIC_TO_EVERYONE",
                 disable_duet: false, disable_comment: false },
    source_info: { source: "PULL_FROM_URL", video_url: <url>,
                   cover_image_url: <cover_url> }
  }
  -> returns: { data: { publish_id } }
```

Poll status:
```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
  Body: { publish_id }
  -> returns: { data: { status: "PUBLISH_COMPLETE" | "PROCESSING_UPLOAD" | "FAILED" } }
```

Auth: OAuth 2.0. Access token expires in 24 hours. Refresh via:
```
POST https://open.tiktokapis.com/v2/oauth/token/
  Body: { client_key, client_secret, grant_type: "refresh_token", refresh_token }
```
Refresh cron: `/api/cron/refresh-tiktok-token` runs every 20 hours.
Token stored in `tiktok_auth` table (already exists in repo).

Rate limit: 100 videos / day per app. Schedule max 8 TikTok posts / day.

Optimal windows: 7-9am, 12-3pm, 7-9pm PT.

#### YouTube (Data API v3)

**Shorts / regular upload:**
```
POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
  Header: Authorization: Bearer <YOUTUBE_ACCESS_TOKEN>
  Header: X-Upload-Content-Type: video/*
  Body: {
    snippet: { title, description, tags, categoryId: "37" },  // 37 = Real Estate
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false }
  }
  -> returns: upload session URI in Location header

// PUT video bytes to session URI
```

Chapter markers injected into `description` field for long-form (16:9) videos:
```
00:00 Intro
00:15 Property tour
01:20 Neighborhood
02:00 Stats
```
Markers come from `post_queue.platform_metadata.chapters`.

Auth: OAuth 2.0, `googleapis` package (already in `package.json`).
Tokens in Supabase `oauth_tokens` table:
```sql
SELECT access_token, refresh_token, expires_at
FROM oauth_tokens WHERE platform = 'youtube';
```
Refresh via `google.auth.OAuth2.refreshAccessToken()`.

Rate limit: 10,000 units / day quota. Video upload = 1,600 units. Max ~6 uploads/day.

Optimal windows: Fri 12pm PT (Shorts), Thu 3pm PT (long-form).

#### LinkedIn (Marketing API)

**Video post:**
```
// Step 1: Register upload
POST https://api.linkedin.com/v2/assets?action=registerUpload
  Header: Authorization: Bearer <LINKEDIN_ACCESS_TOKEN>
  Body: {
    registerUploadRequest: {
      owner: "urn:li:person:{person-id}",
      recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
      serviceRelationships: [{ identifier: "urn:li:userGeneratedContent",
                               relationshipType: "OWNER" }]
    }
  }
  -> returns: { value: { asset, uploadMechanism } }

// Step 2: Upload binary to uploadMechanism.uploadUrl via PUT

// Step 3: Create post
POST https://api.linkedin.com/v2/ugcPosts
  Body: {
    author: "urn:li:person:{person-id}",
    lifecycleState: "PUBLISHED",
    specificContent: { "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: <caption> },
      shareMediaCategory: "VIDEO",
      media: [{ status: "READY", media: <asset-urn> }]
    }},
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
  }
```

**Image post (1:1 feed):**
Same flow but `recipes: ["urn:li:digitalmediaRecipe:feedshare-image"]`.

Auth: OAuth 2.0, access token in `oauth_tokens` table WHERE `platform = 'linkedin'`.
Refresh via standard LinkedIn refresh flow. Token expires 60 days.

Rate limit: 150 posts/day per person. Well within budget.

Optimal windows: Tue/Wed 8-10am, 12pm PT.

## Database schema

```sql
CREATE TABLE IF NOT EXISTS post_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid REFERENCES listings(id) ON DELETE SET NULL,
  run_id              uuid REFERENCES automation_runs(id),
  platform            text NOT NULL,
    -- 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin'
  media_type          text NOT NULL,
    -- 'reel' | 'image' | 'video' | 'short'
  media_url           text NOT NULL,
  caption             text NOT NULL,
  cover_url           text,
  hashtag_set         text[],
  platform_metadata   jsonb,
  scheduled_at        timestamptz NOT NULL,
  review_status       text NOT NULL DEFAULT 'pending_human_review',
    -- 'pending_human_review' | 'approved' | 'rejected'
  status              text NOT NULL DEFAULT 'approved',
    -- 'approved' | 'publishing' | 'published' | 'dead'
  platform_post_id    text,
  published_at        timestamptz,
  retries             integer NOT NULL DEFAULT 0,
  last_error          text,
  next_retry_at       timestamptz,
  started_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  format_tag          text,   -- 'listing_reveal' | 'data_viz_video' | 'meme' | etc.
  topic_tags          text[]
);
CREATE INDEX IF NOT EXISTS post_queue_drain_idx
  ON post_queue (scheduled_at, status, review_status)
  WHERE status = 'approved'
    AND review_status = 'approved'
    AND retries < 3;
CREATE INDEX IF NOT EXISTS post_queue_listing_idx
  ON post_queue (listing_id, platform);

CREATE TABLE IF NOT EXISTS post_failures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_queue_id   uuid REFERENCES post_queue(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  error_code      text,
  error_message   text,
  http_status     integer,
  attempt_number  integer NOT NULL DEFAULT 1,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_failures_post_idx
  ON post_failures (post_queue_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text UNIQUE NOT NULL,
  access_token  text NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_performance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_queue_id   uuid REFERENCES post_queue(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  published_at    timestamptz NOT NULL,
  reach           bigint NOT NULL DEFAULT 0,
  impressions     bigint NOT NULL DEFAULT 0,
  saves           bigint NOT NULL DEFAULT 0,
  shares          bigint NOT NULL DEFAULT 0,
  comments        bigint NOT NULL DEFAULT 0,
  follows         integer NOT NULL DEFAULT 0,
  ctr             numeric(6,4) NOT NULL DEFAULT 0,
  completion_rate numeric(6,4) NOT NULL DEFAULT 0,
  score           numeric(8,4),   -- computed by performance_loop
  last_pulled_at  timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_performance_platform_idx
  ON post_performance (platform, published_at DESC);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 8 — Human review gate.** Every post enters `pending_human_review`. Auto-approve only
  unlocks after 30 days of a format running clean, controlled by `automation_config` table.
- **Fair housing safe.** Captions are validated at `repurpose_engine` step; scheduler does not
  re-validate but logs the source `run_id` for auditability.
- Posts that stay in `pending_human_review` for > 48 hours beyond their `scheduled_at` are
  flagged as stale in the admin dashboard — they are NOT auto-approved or auto-rejected.

## Error handling + observability

- **3 retries** with exponential backoff: 1 min, 2 min, 4 min between attempts.
- After 3 retries: `status = 'dead'`, Resend email to `ALERT_EMAIL` with post details.
- `post_failures` table is the dead-letter queue for forensics.
- Sentry alert on any HTTP 5xx from a platform API.
- Structured log per publish attempt:
  ```json
  { "skill": "post_scheduler", "post_id": "...", "platform": "instagram",
    "status": "published", "platform_post_id": "...", "ms": 1240 }
  ```

## Configuration

```typescript
export const POST_SCHEDULER_CONFIG = {
  // Max posts processed per cron run (prevent timeout)
  batch_size: 10,

  // Retry backoff base (minutes); actual = 2^attempt * base
  retry_backoff_base_minutes: 1,

  // Max retry attempts before marking dead
  max_retries: 3,

  // Hours post can wait past scheduled_at before flagged as stale
  stale_threshold_hours: 48,

  // Per-platform daily caps
  daily_caps: {
    instagram: 8,
    facebook: 8,
    tiktok: 6,
    youtube: 4,
    linkedin: 4,
  },

  // Optimal posting windows per platform (PT hour ranges)
  optimal_windows: {
    instagram: [{ days: [2,3,4], hours: [8,9,18,19] }],
    facebook:  [{ days: [2,3,4], hours: [9,10,19,20] }],
    tiktok:    [{ days: [1,2,3,4,5], hours: [7,8,12,13,14,19,20] }],
    youtube:   [{ days: [4], hours: [15] }, { days: [5], hours: [12] }],
    linkedin:  [{ days: [2,3], hours: [8,9,12] }],
  },
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `META_ACCESS_TOKEN` | Long-lived Meta page token (IG + FB) |
| `META_APP_ID` | Meta app ID |
| `META_APP_SECRET` | Meta app secret |
| `META_IG_USER_ID` | Instagram business account ID |
| `META_PAGE_ID` | Facebook page ID |
| `TIKTOK_CLIENT_KEY` | TikTok app client key |
| `TIKTOK_CLIENT_SECRET` | TikTok app client secret |
| `YOUTUBE_CLIENT_ID` | Google OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth client secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn app client secret |
| `LINKEDIN_PERSON_ID` | LinkedIn person URN ID |
| `ALERT_EMAIL` | Matt's email for failure alerts |
| `CRON_SECRET` | Bearer token for cron authorization |

## Manual override / kill switch

**Kill entire scheduler:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'post_scheduler_enabled';
```

**Kill one platform:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'post_scheduler_platform_tiktok_enabled';
-- keys: post_scheduler_platform_{instagram|facebook|tiktok|youtube|linkedin}_enabled
```

**Force-approve a post (bypass review queue):**
```sql
UPDATE post_queue SET review_status = 'approved' WHERE id = '<uuid>';
```

**Reschedule a failed post:**
```sql
UPDATE post_queue
SET status = 'approved', retries = 0, next_retry_at = now()
WHERE id = '<uuid>' AND status = 'dead';
```

**Admin UI spec:** `/admin/post-queue` shows all `pending_human_review` rows grouped by
listing. Each row has Approve / Reject buttons that call `PATCH /api/admin/post-queue/{id}`
with `{ action: 'approve' | 'reject' }`. (UI built separately by the dashboard skill.)

## See also

- `automation_skills/triggers/listing_trigger/SKILL.md` — writes to `post_queue`
- `automation_skills/automation/repurpose_engine/SKILL.md` — writes 8 platform variants
- `automation_skills/automation/performance_loop/SKILL.md` — reads `post_performance`
- `automation_skills/automation/ab_testing/SKILL.md` — writes A/B variant rows to `post_queue`
- `video_production_skills/social_calendar/SKILL.md` — determines `scheduled_at` windows
