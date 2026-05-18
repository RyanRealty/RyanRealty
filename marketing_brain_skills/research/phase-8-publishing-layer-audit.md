# Phase 8 Part A — Publishing layer audit

**Audited:** 2026-05-17  
**Auditor:** Autonomous pipeline agent (Phase 8A)  
**Files reviewed:** `app/api/social/publish/route.ts`, `lib/meta-graph.ts`, `lib/linkedin.ts`, `lib/x.ts`, `lib/google-business-profile.ts`, `lib/buffer.ts`, `automation_skills/automation/publish/SKILL.md`, `out/proof/2026-05-14/publish-status.json`, `marketing_brain_skills/research/env-manifest.md`, `lib/punctuation-guard.ts`

---

## Summary

- Platforms audited: 11 (Meta IG, Meta FB feed, Meta FB Reels, LinkedIn, X, GBP, TikTok, YouTube, Pinterest, Threads, Nextdoor) plus Buffer fan-out
- Production-ready (last live run confirmed): 7 (IG, FB feed, FB Reels, LinkedIn, X, GBP, and their combinations from 2026-05-14 run)
- Bugs identified: 17 total (P0: 3, P1: 7, P2: 7)
- Token-refresh gaps: 3 (TikTok: table empty; Nextdoor: gated API not yet approved; Pinterest: app not created)

---

## Per-platform findings

### Meta IG (image + reels)

- **Status:** Production-ready. Last run 2026-05-14 confirmed 4 properties published successfully (image and reel). Graph API v25.0 in `meta-graph.ts`.
- **Known bug A (carousel `status_code=FINISHED` polling):** `publishCarousel` in `meta-graph.ts` lines 367-437 correctly polls `waitForContainer` for video children before publishing the carousel container. However, `app/api/social/publish/route.ts` has no `carousel` MediaType and no `publishCarousel` call path. Carousel posts are silently unreachable via the route. The `mediaType` enum only supports `image | video | reel`.
- **Token:** `META_PAGE_ACCESS_TOKEN` env var, set, never-expires (data_access re-grant 2026-07-13). No auto-refresh needed. Read directly from `process.env` on every call.
- **Rate limits:** No backoff or jitter implemented anywhere in route.ts or meta-graph.ts. The `getPublishingLimit` helper exists but is never called before publishing. IG quota is 25 posts per 24h. No pre-publish quota check.
- **Failure mode:** `try/catch` returns `{ success: false, status: 'failed', error }`. No retry. No dead-letter queue write-back from the route itself.
- **External ID capture:** `externalPostId` populated in `PlatformResult` and returned in the JSON response. However, the route never writes this back to `marketing_brain_actions`, `content_performance`, or any Supabase table. Caller is responsible for write-back, but no caller does it automatically.
- **Dash guard hookup:** `assertNoDashes` from `lib/punctuation-guard.ts` is NOT called anywhere in `route.ts` or in any platform helper. The SKILL.md documents it as a hard precondition locked 2026-05-15. The implementation gap means em-dashes in captions will publish silently. Critical compliance miss.
- **Recommended fix + priority:** P0 — add `assertNoDashes(caption, { source: 'platform:instagram' })` to `resolveCaption()` or at each platform dispatch point. Add carousel MediaType support. Add pre-publish quota check.

---

### Meta FB feed + photo

- **Status:** Production-ready. `publishFacebookPost` (link) and `publishFacebookPhoto` (image) both confirmed working 2026-05-14.
- **Known bugs:** Same carousel gap as IG (no route path). FB video (`publishFacebookVideo`) is implemented in `meta-graph.ts` but unreachable from route.ts. The `video` MediaType on FB falls through to `publishFacebookPost` (text+link), which is a lossy fallback.
- **Token:** Same `META_PAGE_ACCESS_TOKEN`. `META_FB_PAGE_ID` env var.
- **Rate limits:** No backoff. No rate-limit handling.
- **Failure mode:** Same catch pattern. No write-back.
- **External ID capture:** Returns `post_id` from photo response. Same gap as IG.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 — expose FB video as a distinct MediaType path, or document it as unsupported and return a clear error instead of silently falling back to a link post.

---

### Meta FB Reels

- **Status:** Production-ready. `publishFacebookReel` confirmed working 2026-05-14. Chunked upload via `video_reels` upload_phase flow correctly implemented.
- **Known bugs:** FB Reel buffers the full video into `arrayBuffer()` in `meta-graph.ts` lines 559-565. For videos above ~80 MB this will OOM the Vercel function (256 MB limit). Partial risk at current sizes but a P1 before scaling.
- **Token:** Same as FB feed.
- **Rate limits:** None.
- **Failure mode:** Throws on HTTP error. Caught by route's `try/catch`.
- **External ID capture:** Returns `video_id`. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 — migrate FB Reel transfer phase to streaming (response body piped directly) to avoid OOM on large files.

---

### LinkedIn

- **Status:** Production-ready for video. Last run 2026-05-14 confirmed working. Token stored in `linkedin_auth` Supabase table, valid until 2026-07-04.
- **Known bug A (image post path missing):** `publishToLinkedIn` in route.ts lines 384-387 returns `{ success: false, status: failed, error: 'LinkedIn route currently supports video publish only' }` for `mediaType === 'image'`. `lib/linkedin.ts` has no image upload function. LinkedIn image posts require registering an image asset via `/v2/assets?action=registerUpload` with recipe `feedshare-image`, uploading the bytes, then creating a UGC or /rest/posts body. This is a confirmed gap.
- **Known bug B (OOM on video above 20 MB):** `publishLinkedInVideoFromUrl` uses streaming (`sourceResponse.body` piped via duplex: 'half') which is correct for the upload PUT. However the function still buffers the full response for the upload step if `Content-Length` is absent, falling back to full buffer behavior. On Vercel with a 256 MB function limit, videos above ~80 MB will fail. SKILL.md also flags this separately.
- **Token:** `linkedin_auth` Supabase table, `id='default'`. Auto-refresh via `refreshLinkedInToken` using stored refresh token. 5-minute pre-expiry window. No cron heartbeat to prevent silent expiry.
- **Rate limits:** None in lib or route.
- **Failure mode:** Throws, caught by route's catch. No retry. No write-back.
- **External ID capture:** Returns post URN from `x-restli-id` header. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 (image path) — implement LinkedIn image asset registration + post flow. P1 (OOM) is partially mitigated by current streaming but needs Content-Length enforcement. P0 (dash guard) applies across all platforms.

---

### X

- **Status:** Production-ready. Last run 2026-05-14 confirmed 4 tweets posted. Token stored in `x_auth` Supabase table. 1-minute pre-expiry refresh window.
- **Known bug A (v1.1 media upload, not v2):** `X_MEDIA_UPLOAD_URL` is `upload.twitter.com/1.1/media/upload.json`. The code comment on line 9 says `media.write` scope was added "to enable native video/image upload via v2/media/upload" but the actual URL used is still v1.1. X API v2 does not yet have a published stable media/upload endpoint (as of 2026-05-17). The v1.1 endpoint works but requires `X_API_KEY` + `X_API_SECRET` for app-level auth in some scenarios. Current OAuth 2.0 Bearer token is used instead, which works on Basic tier. This is not a breaking bug now but will break if X deprecates v1.1.
- **Token:** `x_auth` Supabase table. Rotating refresh. PKCE state stored in Upstash Redis with 10-minute TTL. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` required.
- **Rate limits:** No backoff. No jitter. Processing poll for media uses fixed `check_after_secs` but caps at 20 iterations (100 seconds max). No rate-limit error detection.
- **Failure mode:** Throws, caught. No write-back. Caption is hard-truncated at 280 chars (`caption.slice(0, 280)`) with no warning if content is lost.
- **External ID capture:** Returns tweet ID. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P2 (v1.1 watch) — monitor X deprecation notices. P1 — add caption-truncation warning when content exceeds 280 chars. P0 dash guard.

---

### Google Business Profile (GBP)

- **Status:** Production-ready. Last run 2026-05-14 confirmed 4 GBP posts published. Token in `google_business_profile_auth` Supabase table.
- **Known bugs:** GBP `publishGoogleBusinessLocalPost` only supports `STANDARD` topicType with a single photo. `EVENT` type (needed for open houses to stay live past 7 days) and `OFFER` type are not implemented. Video is attached as `mediaFormat: 'PHOTO'` which is incorrect for video URLs and will likely be rejected by the API for actual video content.
- **Token:** `google_business_profile_auth` Supabase table. Auto-refresh via `refreshGoogleAccessToken`. 1-minute pre-expiry window. Upstash Redis used for OAuth state. `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`, `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`, `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI` required. Note: env-manifest flags `GBP_ACCESS_TOKEN` as unset but that var is a legacy reference. Current code uses the Supabase-stored token correctly.
- **Rate limits:** 9 sequential Performance API calls for metrics (acceptable). No backoff on publish calls.
- **Failure mode:** Throws, caught. No retry.
- **External ID capture:** Returns `localPost.name` (full resource path). Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 — implement `EVENT` topicType for open houses. P1 — fix video `mediaFormat` to `VIDEO` when mediaUrl is a video. P0 dash guard.

---

### TikTok

- **Status:** OAuth not completed. `tiktok_auth` Supabase table row is empty (confirmed in SKILL.md "tiktok_auth row empty"). TikTok production app review rejected 2026-05-12. Posts will be `SELF_ONLY` until production approved.
- **Known bugs:** `is_aigc: true` flag (required for ElevenLabs VO content) and `brand_organic_toggle: true` are not set in `publishToTikTok` in route.ts (lines 316-318). These are passed to `directPostVideo` but not wired through the route's `metadata.tiktok` payload schema. `video_cover_timestamp_ms` also not supported.
- **Token:** `tiktok_auth` Supabase table. Auto-refresh implemented via `refreshAccessToken`. Table is empty, so every call will throw `TikTok token not found in database`.
- **Rate limits:** None.
- **Failure mode:** Throws on empty table. Returns `submitted` status (not `published`) because TikTok is async, but no polling for final publish status.
- **External ID capture:** Returns `publishId`. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P0 — complete first-time OAuth at `/api/tiktok/authorize` before any TikTok publish attempt. P1 — add `is_aigc`, `brand_organic_toggle`, `video_cover_timestamp_ms` to metadata payload schema and wire through to `directPostVideo`. P0 dash guard.

---

### YouTube

- **Status:** Token stored in Supabase, auto-refreshes. Last run 2026-05-14 skipped YouTube (in `skipped` array of publish-status.json). Implementation present.
- **Known bugs:** `categoryId` is not set anywhere in the route's YouTube metadata path (lines 645-651). SKILL.md requires `categoryId: '26'` (Howto and Style). `containsSyntheticMedia` flag (required when ElevenLabs VO is used) is not in the route's `metadata.youtube` schema. `arrayBuffer()` OOM risk for videos above 50 MB (same pattern as FB Reels).
- **Token:** Supabase `youtube_auth` table (inferred from env-manifest pattern). Auto-refresh via stored refresh token.
- **Rate limits:** None.
- **Failure mode:** Throws, caught. No retry.
- **External ID capture:** Returns `videoId`. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 — add `categoryId` and `containsSyntheticMedia` to `metadata.youtube` schema and wire to `uploadYouTubeVideoFromUrl`. P1 — migrate to streaming upload for videos above 50 MB.

---

### Pinterest

- **Status:** Stub. Pinterest OAuth app not yet created. `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET` commented out in `.env.local`. `lib/pinterest.ts` exists. Route dispatches correctly but will throw on token fetch.
- **Known bugs:** `createPinterestVideoPin` is the only implemented pin type. Static image pins (needed for carousels or market report graphics) not implemented. SKILL.md confirms Buffer silently drops destination URL on Pinterest, so native API is mandatory, but Buffer is also listed as a fallback in the Buffer decision tree.
- **Token:** Will be stored in Supabase after first OAuth. `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `PINTEREST_REDIRECT_URI` all unset. `pins:read` scope confirmed missing from SKILL.md.
- **Rate limits:** None.
- **Failure mode:** Throws on unset env vars. No retry.
- **External ID capture:** Returns `pinId`. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P0 (blocker) — create Pinterest developer app, set env vars, complete first OAuth before any publish attempt. P1 — add `pins:read` scope to OAuth grant. P1 — implement static image pin type.

---

### Threads

- **Status:** Implementation present. Token in Supabase. Last run 2026-05-14 skipped Threads (in `skipped` array). 60-day token expiry with no cron refresh heartbeat.
- **Known bugs:** Image posts not supported (route returns `failed` for `mediaType === 'image'`). Threads supports image posts via `THREADS` media type. No refresh cron at day 45 as required by SKILL.md.
- **Token:** Supabase `threads_auth` table. `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET` set. No auto-refresh heartbeat cron exists.
- **Rate limits:** None.
- **Failure mode:** Throws, caught. No retry.
- **External ID capture:** Returns `postId`. Same write-back gap.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P1 — implement Threads image post path. P1 — add day-45 token refresh cron.

---

### Nextdoor

- **Status:** Stub. API is gated (requires approval from `developer.nextdoor.com`). `NEXTDOOR_CLIENT_ID`, `NEXTDOOR_CLIENT_SECRET`, `NEXTDOOR_REDIRECT_URI` all unset. `lib/nextdoor.ts` exists. Route dispatches but will throw immediately on env check.
- **Known bugs:** No image+video combined post type. Nextdoor business profile ID must be fetched post-OAuth and stored. No `is_aigc` equivalent for Nextdoor. API approval may take weeks.
- **Token:** Will be stored in Supabase `nextdoor_auth` table after gated API approval and first OAuth.
- **Rate limits:** None (cannot test without API access).
- **Failure mode:** Throws on missing env vars.
- **External ID capture:** Not yet reachable.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P2 — apply for Nextdoor for Business API access. No code changes needed until approval arrives.

---

### Buffer fan-out

- **Status:** Configured in `lib/buffer.ts` but NOT wired into `app/api/social/publish/route.ts` at all. Buffer is referenced in the SKILL.md fallback chain but the route has no Buffer fallback logic. `BUFFER_ACCESS_TOKEN` and all profile ID vars are missing from `.env.local`.
- **Known bugs:** Buffer v1 `updates/create.json` endpoint is used. Buffer no longer accepts new OAuth apps. Profile IDs for X, Pinterest, Threads, Instagram, Facebook, LinkedIn, TikTok, YouTube all unset. Buffer silently drops Pinterest destination URL (confirmed bug in SKILL.md). SKILL.md fallback chain says "route through Buffer if platform-specific params not needed" but no code path does this.
- **Token:** `BUFFER_ACCESS_TOKEN` env var (pre-existing v1 personal token). Unset.
- **Rate limits:** None. Buffer v1 has a 60 req/min global limit. Not handled.
- **Failure mode:** Route does not call Buffer at all currently. `lib/buffer.ts` throws on missing token.
- **External ID capture:** Returns Buffer update `id`, not the downstream platform post ID.
- **Dash guard hookup:** Not called.
- **Recommended fix + priority:** P2 — retrieve existing Buffer v1 token and set env vars. P2 — wire Buffer as a fallback in route.ts with the SKILL.md decision matrix logic.

---

## Cross-cutting

### Env vars consumed by the publish layer

All vars read by `app/api/social/publish/route.ts` and the six lib files:

| Var | Where stored | Status (from env-manifest.md) |
|---|---|---|
| `CRON_SECRET` | env var | Set |
| `NEXT_PUBLIC_SUPABASE_URL` | env var | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | env var | Set |
| `META_PAGE_ACCESS_TOKEN` | env var | Set, never-expires |
| `META_IG_BUSINESS_ACCOUNT_ID` | env var | Set |
| `META_FB_PAGE_ID` | env var | Set |
| `LINKEDIN_CLIENT_ID` | env var | Set |
| `LINKEDIN_CLIENT_SECRET` | env var | Set |
| `LINKEDIN_REDIRECT_URI` | env var | Set |
| `LINKEDIN_PERSON_ID` | env var | Set |
| `X_CLIENT_ID` | env var | Set |
| `X_CLIENT_SECRET` | env var | Set |
| `X_REDIRECT_URI` | env var | Set |
| `UPSTASH_REDIS_REST_URL` | env var | Set (X PKCE state) |
| `UPSTASH_REDIS_REST_TOKEN` | env var | Set |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_ID` | env var | Set (alias GOOGLE_OAUTH_CLIENT_ID) |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET` | env var | Set |
| `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI` | env var | Set |
| `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` | env var | Set |
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` | env var | Set |
| `TIKTOK_CLIENT_KEY` | env var | Set (sandbox only) |
| `TIKTOK_CLIENT_SECRET` | env var | Set (sandbox) |
| `TIKTOK_REDIRECT_URI` | env var | Set |
| `PINTEREST_CLIENT_ID` | env var | Unset (app not created) |
| `PINTEREST_CLIENT_SECRET` | env var | Unset |
| `PINTEREST_REDIRECT_URI` | env var | Unset |
| `THREADS_CLIENT_ID` | env var | Set (same Meta App) |
| `THREADS_CLIENT_SECRET` | env var | Set |
| `THREADS_REDIRECT_URI` | env var | Set |
| `NEXTDOOR_CLIENT_ID` | env var | Unset (gated API) |
| `NEXTDOOR_CLIENT_SECRET` | env var | Unset |
| `NEXTDOOR_REDIRECT_URI` | env var | Unset |
| `BUFFER_ACCESS_TOKEN` | env var | Unset |
| `BUFFER_PROFILE_X` | env var | Unset |
| `BUFFER_PROFILE_PINTEREST` | env var | Unset |
| `BUFFER_PROFILE_THREADS` | env var | Unset |

Tokens for LinkedIn, X, TikTok, YouTube, Threads, Nextdoor, GBP, and Pinterest are stored in per-platform Supabase tables (`linkedin_auth`, `x_auth`, `tiktok_auth`, `youtube_auth`, `threads_auth`, `nextdoor_auth`, `google_business_profile_auth`), not as env vars. This is the correct pattern.

---

### Drift: publish/SKILL.md vs route.ts implementation

| Area | SKILL.md says | route.ts does | Drift |
|---|---|---|---|
| Dash guard | `assertNoDashes()` called client-side AND server-side before send | Not called anywhere in route or libs | CRITICAL DRIFT |
| Carousel MediaType | Implied by IG carousel support in meta-graph.ts | No carousel MediaType in route | Gap |
| TikTok `is_aigc` | Required flag in metadata | Not in `metadata.tiktok` schema | Drift |
| TikTok `brand_organic_toggle` | Required | Not in schema | Drift |
| YouTube `categoryId: '26'` | Required | Not in schema | Drift |
| YouTube `containsSyntheticMedia` | Required when ElevenLabs VO present | Not in schema | Drift |
| Meta Graph version | v25.0 per SKILL.md | v25.0 in meta-graph.ts (correct) | No drift |
| Retry with backoff | 3 attempts, 1s/4s/16s | No retry in route | Drift |
| Buffer fallback | Described as fallback chain step 2 | Buffer not wired into route at all | Drift |
| Action row write-back | "Write externalPostId back to content_library" | Not done by route | Drift |
| Platform status table | SKILL.md says IG/FB "BLOCKED" (v22.0 stale note) | route.ts uses v25.0, live | SKILL.md stale |
| Dead-letter queue | Write to `dead_letter_queue` on all paths exhausted | Not implemented | Drift |

SKILL.md platform status table contains stale data (says IG/FB BLOCKED due to expired token and v22.0 API version). The actual code and last live run confirm both are working on v25.0 with a valid token. The SKILL.md needs a status update pass.

---

### Recommended performance-pull schema (for Phase 8 Part B context)

`content_performance` needs these columns to capture post-publish IDs and enable the Phase 8B analytics cron to pull per-post metrics:

```sql
-- New columns on content_performance (or a join table post_external_ids)
platform            text NOT NULL,          -- 'instagram' | 'facebook' | 'x' | etc.
external_post_id    text,                   -- platform-native post ID / URN / name
post_url            text,                   -- canonical URL if platform returns one
published_at        timestamptz,            -- when the route confirmed success
action_id           uuid REFERENCES marketing_brain_actions(id),
asset_path          text,                   -- path in Supabase storage
platform_status     text DEFAULT 'pending', -- 'published' | 'submitted' | 'failed'
impressions         bigint,
reach               bigint,
engagement          bigint,
saves               bigint,
shares              bigint,
link_clicks         bigint,
video_views         bigint,
watch_time_seconds  numeric,
ctr                 numeric,
metric_pulled_at    timestamptz,
tier_limited        boolean DEFAULT false   -- true when platform caps analytics
```

The Phase 8B cron should join on `(action_id, platform)` to pull metrics per post. `external_post_id` is the key for each platform API call (IG media ID, LinkedIn URN, YouTube videoId, GBP localPost name, X tweet ID, TikTok publishId, Pinterest pinId).

---

### Seller-lead attribution stub (for Phase 8 Part B context)

Phase 8B needs to attribute seller leads back to the content that generated them. Requirements for the cron:

1. **FUB webhook ingest** already fires on lead creation at `/api/webhooks/fub`. The FUB lead record contains `source` (e.g. "Facebook Lead Form", "Instagram", "Organic") and `utm_source` / `utm_campaign` if CAPI wired correctly.

2. **Attribution join keys needed:**
   - `content_performance.action_id` links a published post to its `marketing_brain_actions` row.
   - FUB lead record needs `content_action_id` or `content_post_external_id` populated at lead-capture time. This requires UTM parameters on every CTA URL (`?utm_source=<platform>&utm_content=<action_id>`).

3. **Stub schema for `seller_lead_attribution` table:**
   ```sql
   id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   fub_lead_id         text NOT NULL,
   content_action_id   uuid REFERENCES marketing_brain_actions(id),
   platform            text,
   external_post_id    text,
   utm_source          text,
   utm_campaign        text,
   utm_content         text,
   lead_created_at     timestamptz,
   attributed_at       timestamptz DEFAULT now(),
   attribution_model   text DEFAULT 'last_touch' -- 'last_touch' | 'first_touch' | 'linear'
   ```

4. **Phase 8B cron steps:**
   a. Pull new FUB leads since last run (FUB API `GET /leads?since=<last_run_at>`).
   b. For each lead, extract UTM params. Match `utm_content` to `marketing_brain_actions.id`.
   c. If match found, insert `seller_lead_attribution` row.
   d. Aggregate by `content_action_id` and update `content_performance.attributed_leads` count.
   e. Surface attribution report to Matt via marketing digest.

5. **Constraint:** UTM params must be appended to every CTA URL at publish time by the publish route or the SKILL. The current route has no UTM injection. This is a P1 addition before Phase 8B cron is useful.

---

## Action items (sorted by priority)

| Priority | Platform | Fix | Est. effort | Owner |
|---|---|---|---|---|
| P0 | All | Wire `assertNoDashes(resolveCaption(body, platform))` into `route.ts` before each platform dispatch (or inside `resolveCaption`). DashViolationError blocks publish, returns 400. | 30 min | eng |
| P0 | TikTok | Complete first-time OAuth at `/api/tiktok/authorize` to populate `tiktok_auth` table. No code change needed, just the OAuth walk-through. | 15 min | Matt |
| P0 | Pinterest | Create Pinterest developer app at developers.pinterest.com (scopes: boards:read, pins:write, video:upload). Set `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `PINTEREST_REDIRECT_URI` in Vercel env and `.env.local`. Run first OAuth. | 45 min | Matt |
| P1 | LinkedIn | Implement LinkedIn image post path in `lib/linkedin.ts` using `/v2/assets?action=registerUpload` with `feedshare-image` recipe. Wire `mediaType === 'image'` in `publishToLinkedIn`. | 2 hrs | eng |
| P1 | YouTube | Add `categoryId` and `containsSyntheticMedia` fields to `metadata.youtube` schema in route.ts and wire to `uploadYouTubeVideoFromUrl`. Default `categoryId` to `'26'`, default `containsSyntheticMedia` to `true` when `gate.formatSkillName` indicates ElevenLabs VO. | 1 hr | eng |
| P1 | TikTok | Add `is_aigc`, `brand_organic_toggle`, `video_cover_timestamp_ms` to `metadata.tiktok` schema and wire to `directPostVideo`. | 1 hr | eng |
| P1 | GBP | Implement `EVENT` topicType (open-house use case). Add `startDateTime` / `endDateTime` to `metadata.google_business_profile`. Fix `mediaFormat: 'PHOTO'` to use `VIDEO` when URL is a video. | 2 hrs | eng |
| P1 | FB Reels | Migrate reel transfer phase from `arrayBuffer()` to streaming pipe to avoid OOM on files above 80 MB. | 1 hr | eng |
| P1 | Threads | Add image post path using `THREADS` media_type with `image_url`. | 1 hr | eng |
| P1 | Threads | Add day-45 token refresh cron (`/api/cron/threads-token-refresh`) to prevent silent 60-day expiry. | 1 hr | eng |
| P1 | All | Add action row write-back: after route returns success, write `externalPostId`, `published_at`, and `platform` to `content_performance` (or a new `post_external_ids` table). Route currently returns the IDs in JSON but no caller persists them. | 2 hrs | eng |
| P1 | All | Add UTM injection at publish time: append `?utm_source=<platform>&utm_content=<action_id>` to any CTA URL in the caption before send. Required for Phase 8B seller-lead attribution. | 1 hr | eng |
| P1 | SKILL.md | Update publish/SKILL.md platform status table: IG and FB are ACTIVE (not blocked). v22.0 reference is stale. Remove the "hardcodes v22.0" note which was fixed in the current code. | 15 min | eng |
| P2 | IG | Add carousel `MediaType` support in route.ts and wire to `publishCarousel` from meta-graph.ts. | 2 hrs | eng |
| P2 | All | Add exponential backoff retry in route.ts (1s, 4s, 16s, 3 attempts) per platform before marking failed. | 2 hrs | eng |
| P2 | Buffer | Set `BUFFER_ACCESS_TOKEN` and all `BUFFER_PROFILE_*` env vars. Wire Buffer as a fallback in route.ts matching the SKILL.md decision matrix. | 1 hr | Matt (token retrieval) + 2 hrs eng (wiring) |
| P2 | Nextdoor | Apply for Nextdoor for Business API access at developer.nextdoor.com. No code needed until approved. | async | Matt |
