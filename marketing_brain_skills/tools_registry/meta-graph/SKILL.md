---
name: tools_registry-meta-graph
description: Use this skill when a task involves "Meta Graph API", "Facebook page insights", "Instagram business insights", "publish to Instagram", "publish to Facebook", "IG reel publish", "FB reel publish", "Meta Ads insights", "campaign spend", "page impressions", "organic reach", "Meta page token", "marketing-snapshot-meta", "audit-ads meta", or any task that reads from or writes to Ryan Realty's own Facebook page or Instagram business account. NOT for competitor scraping (that is Apify). Covers authentication, ingestion endpoints, publishing flows, the campaign-status gotcha, account IDs, failure modes, and the canonical helper module.
---

# Meta Graph API Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's ingestion, publishing, and ads-audit layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `marketing_brain_skills/tools_registry/REGISTRY.md`.  full tool inventory

---

## Scope

**Use Meta Graph API for:**

| Use case | Why Meta Graph |
|---|---|
| Facebook Page account-level organic metrics (impressions, reach, engaged users, fan count) | Official Graph API.  first-class access to Ryan Realty's own page data |
| Per-post organic insights (impressions, engaged users, reactions, clicks) | Post-level `/{post-id}/insights` endpoint |
| Instagram Business account insights (reach, profile views, follower count, website clicks) | IG account linked to FB Page; same token handles both |
| Per-media Instagram insights (impressions, reach, engagement, saved) | `/{media-id}/insights` with `period=lifetime` |
| Meta Ads account + campaign-level spend, CPM, CPC, CTR, conversions | `/{ad_account_id}/insights` endpoint |
| Publishing content to Facebook (text posts, photos, standard video, reels) | `/{page-id}/feed`, `/photos`, `/videos`, `/video_reels` |
| Publishing content to Instagram (images, reels, stories, carousels) | Two-step container + publish flow via `/{ig-user-id}/media` + `/media_publish` |
| Checking the IG publishing quota before posting | `/{ig-user-id}/content_publishing_limit`.  hard ceiling is 25 posts per 24 h |

**Do NOT use Meta Graph API for:**

| Data source | Use instead |
|---|---|
| Competitor Facebook page metrics or ad library scraping | Apify (`apify/facebook-pages-scraper`, `apify/facebook-ads-scraper`) |
| Ryan Realty GA4 sessions / conversions | GA4 Data API (service-account JSON in Vercel env) |
| MLS / listing data | Spark API or Supabase `listings` table |
| Google Business Profile posts or performance | GBP API (`lib/google-business-profile.ts`) |
| TikTok, LinkedIn, X, YouTube analytics | Each has its own dedicated API |

The rule: Meta Graph API is the canonical path for Ryan Realty's own Facebook + Instagram data. Apify is the fallback for data that has no clean official pathway (competitors).

---

## Authentication

### Status.  LIVE (verified 2026-05-06)

The long-lived Page access token is operational with full publishing scopes. An earlier stale claim in `API_INVENTORY.md` ("Meta Page Token is expired") has been corrected and reflects an old test run. The token **never expires** for long-lived Page tokens unless the user password changes or access is revoked via the App Dashboard.

### Environment variables

| Variable | Purpose | Notes |
|---|---|---|
| `META_PAGE_ACCESS_TOKEN` | Long-lived Page access token | Primary; `getMetaAdsInsights()` also checks `META_PAGE_TOKEN` as fallback |
| `META_PAGE_TOKEN` | Legacy alias | Accepted by `getMetaAdsInsights()` only.  new code uses `META_PAGE_ACCESS_TOKEN` |
| `META_FB_PAGE_ID` | Facebook Page ID (numeric string) | Used by `marketing-snapshot-meta-page` cron |
| `META_IG_BUSINESS_ACCOUNT_ID` | Instagram Business Account ID (numeric string) | Linked to the FB Page; same token covers both |
| `META_AD_ACCOUNT_ID` | Ad Account ID in `act_XXXXXXX` format (or bare numeric) | `getMetaAdsInsights()` normalizes bare numbers automatically |

All four are stored in:
- `.env.local` (local dev)
- Vercel → Project Settings → Environment Variables → Production + Preview + Development

### Scopes on the current token

`pages_manage_posts`, `instagram_content_publish`, `pages_manage_engagement`, `read_insights`, `ads_read`, and related publishing permissions. Re-authorizing with explicit scope list is required if a new scope is ever needed.  do not assume defaults.

### ID lookup pattern

The IG Business Account ID is derived from the FB Page:

```ts
// One-time lookup.  run in Graph API Explorer, store result in env
GET /{page-id}?fields=instagram_business_account&access_token={token}
// Returns: { "instagram_business_account": { "id": "XXXXXXXXX" }, "id": "{page-id}" }
```

---

## API version

**Pinned at `v25.0`** in `lib/meta-graph.ts` (all three base URL constants: `META_GRAPH_BASE`, `META_ADS_GRAPH_BASE`, `META_IG_BASE`). Graph versions deprecate annually.  check `graph.facebook.com/changelog` before bumping. The previous pin was `v22.0`; that version reached end-of-life in September 2025 and was the root cause of the earlier stale "expired" error.

```ts
const META_GRAPH_BASE = 'https://graph.facebook.com/v25.0'
```

Do not change the version inline in a producer. Update the constant in `lib/meta-graph.ts` and let all callers inherit it.

---

## Endpoint patterns

### Facebook Page.  organic insights

```
GET /{page-id}/insights
  ?metric=page_impressions,page_impressions_unique,page_engaged_users,
          page_post_engagements,page_fan_adds,page_video_views
  &period=day
  &since={unix_timestamp}
  &until={unix_timestamp}
  &access_token={token}
```

`page_fans` (follower snapshot) requires a separate call with `period=day`.  it is a "snapshot" / lifetime metric and cannot be combined with `period=day` flow metrics in one call without error.

### Facebook Page.  recent posts

```
GET /{page-id}/posts
  ?fields=id,created_time,permalink_url,message
  &since={unix_timestamp}
  &limit=50
  &access_token={token}
```

### Facebook Page.  per-post insights

```
GET /{post-id}/insights
  ?metric=post_impressions,post_engaged_users,post_reactions_by_type_total,post_clicks
  &period=lifetime
  &access_token={token}
```

Use `period=lifetime` for post-level metrics.  per-day breakdown is not supported for individual posts.

### Instagram Business.  account insights

```
GET /{ig-user-id}/insights
  ?metric=impressions,reach,profile_views,website_clicks
  &period=day
  &since={unix_timestamp}
  &until={unix_timestamp}
  &access_token={token}

# Follower count is a snapshot.  separate call required:
GET /{ig-user-id}/insights
  ?metric=follower_count
  &period=lifetime
  &access_token={token}
```

### Instagram Business.  media list with per-media insights

```
GET /{ig-user-id}/media
  ?fields=id,timestamp,media_type,media_url,permalink,caption
  &limit=50
  &access_token={token}

# Then per-media:
GET /{media-id}/insights
  ?metric=impressions,reach,engagement,saved
  &period=lifetime
  &access_token={token}
```

### Meta Ads Insights

```
GET /{ad_account_id}/insights
  ?access_token={token}
  &level=account            # or "campaign"
  &fields=impressions,reach,spend,clicks,cpm,cpc,ctr,actions
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &time_increment=1
  &limit=500
```

For campaign-level breakdown, add `campaign_id,campaign_name,objective` to `fields`.

### Publishing.  Instagram (two-step)

```
# Step 1: create container
POST /{ig-user-id}/media
  { image_url | video_url | media_type: "REELS"|"STORIES"|"CAROUSEL",
    caption, share_to_feed, access_token }

# For video: poll container until FINISHED
GET /{container-id}?fields=status_code&access_token={token}
# status_code: IN_PROGRESS | FINISHED | ERROR | EXPIRED | PUBLISHED

# Step 2: publish
POST /{ig-user-id}/media_publish
  { creation_id: {container-id}, access_token }
```

### Publishing.  Facebook (one-step)

```
# Text / link post
POST /{page-id}/feed      { message, link?, access_token }

# Photo
POST /{page-id}/photos    { url, caption, access_token }

# Standard video (URL pull)
POST /{page-id}/videos    { file_url, title, description, access_token }

# Reel (chunked upload.  3 phases)
POST /{page-id}/video_reels  { upload_phase: "start", access_token }
  → returns { video_id, upload_url }
POST {upload_url}            binary body; headers: Authorization: OAuth {token}, offset: 0, file_size: {bytes}
POST /{page-id}/video_reels  { upload_phase: "finish", video_id, video_state: "PUBLISHED", description, access_token }
```

---

## CRITICAL gotchas

### 1. Campaign status is NOT available on `/insights`.  use `/campaigns`

`status`, `campaign_status`, and `effective_status` are **not valid `fields` parameters** on `/{ad_account_id}/insights`. The API returns a valid response with no error.  it simply silently omits the field. This is the single most common source of missing data in the ads ingestion layer.

To get campaign status, use a separate call:

```ts
// DO NOT add status to CAMPAIGN_INSIGHTS_FIELDS in lib/meta-graph.ts
// Correct pattern: fetch campaigns separately and join client-side
GET /{ad_account_id}/campaigns
  ?fields=id,name,status,effective_status
  &access_token={token}
```

The `CAMPAIGN_INSIGHTS_FIELDS` constant in `lib/meta-graph.ts` intentionally omits status fields. Do not add them back.

### 2. IG Publishing endpoint is graph.facebook.com, not graph.instagram.com

The Instagram Graph API for Business accounts runs on `graph.facebook.com` using the Page access token. The `graph.instagram.com` domain is for Basic Display API (personal accounts, consumer app tokens).  it does not accept Page tokens and will reject publishing calls.

### 3. `page_fans` and `follower_count` are snapshot metrics.  separate calls required

Mixing snapshot metrics (`page_fans`, `follower_count`) with flow metrics (`impressions`, `reach`) in a single `?metric=` list causes an API error. `getPageInsights()` and `getIGAccountInsights()` in `lib/meta-graph.ts` handle this with parallel calls.  do not consolidate.

### 4. Insights endpoint returns empty arrays for days with no activity

When a day has zero impressions (e.g. no posts were made, account was quiet), the API returns `data: []` rather than `data: [{ value: 0 }]`. Callers must normalize this to 0. The helper functions in `lib/meta-graph.ts` default all metrics to `?? 0`.

### 5. IG carousel child containers must be created before the parent

Child containers are created in parallel (`Promise.all`), but video children must reach `FINISHED` status before the carousel container is created. The `publishCarousel()` function in `lib/meta-graph.ts` handles this correctly.  do not shortcut the wait step.

### 6. Facebook Reel upload requires buffering the full video in memory

The `publishFacebookReel()` function buffers the video via `arrayBuffer()` before POSTing to the `upload_url`. Streaming with `duplex` is unreliable when `Content-Length` is missing or stale on the source URL. For videos >100 MB this will OOM on Vercel.  the current Ryan Realty video cap of 100 MB keeps this safe.

---

## Cost model

The Meta Graph API itself is **free**. There is no per-call charge. Rate limits are per-app-id (not per token) and are generous at Ryan Realty's volume:

| Scenario | Cost |
|---|---|
| Daily organic snapshot (FB + IG) | $0.  free API |
| Daily ads insights pull | $0.  free API |
| Publishing a reel or carousel | $0.  free API |
| Meta Ads spend itself | Billed by Meta; tracked via `spend` field in `getMetaAdsInsights()` |

Use ETags + `If-None-Match` headers on repeated GET calls to hot endpoints (e.g. `/me/accounts`) to reduce response size. Not currently implemented but worth adding if cron logs show rate-limit warnings.

---

## Helper module

**`lib/meta-graph.ts`** is the single client for all Meta Graph calls. Load it before writing any new Meta Graph code.

### Exported functions

| Function | Purpose |
|---|---|
| `getPageInsights(token, pageId, date)` | FB Page account-level metrics for one day |
| `getPagePostsWithInsights(token, pageId, lookbackDays?, topN?)` | Recent FB posts with per-post insight metrics |
| `getIGAccountInsights(token, igUserId, date)` | IG account-level metrics for one day |
| `getIGMediaWithInsights(token, igUserId, lookbackDays?, topN?)` | Recent IG media with per-media insight metrics |
| `getMetaAdsInsights(date)` | Ads account + campaign rows for one day; reads token + ad account ID from env automatically |
| `publishImage(token, igUserId, imageUrl, caption)` | IG image post.  two-step container + publish |
| `publishReel(token, igUserId, videoUrl, caption, options?)` | IG reel.  container + status poll + publish |
| `publishStory(token, igUserId, mediaUrl, mediaType)` | IG story.  image or video |
| `publishCarousel(token, igUserId, children, caption)` | IG carousel.  2-10 items; creates child containers in parallel |
| `publishFacebookPost(token, pageId, message, linkUrl?)` | FB text or link post |
| `publishFacebookPhoto(token, pageId, imageUrl, caption)` | FB photo post |
| `publishFacebookVideo(token, pageId, videoUrl, title, description)` | FB standard video via URL pull |
| `publishFacebookReel(token, pageId, videoUrl, description)` | FB reel via 3-phase chunked upload |
| `checkContainerStatus(token, containerId)` | IG container status poll.  single check |
| `waitForContainer(token, containerId, maxWaitMs?)` | IG container poll loop.  polls until FINISHED |
| `getPublishingLimit(token, igUserId)` | IG content publishing quota check (25/24 h ceiling) |

### Error class

All functions throw `MetaGraphError` (extends `Error`) with optional `code`, `type`, and `fbTraceId` fields from the Graph API error envelope. Catch it specifically when you need to branch on error code:

```ts
import { MetaGraphError } from '@/lib/meta-graph'

try {
  await publishReel(token, igUserId, videoUrl, caption)
} catch (err) {
  if (err instanceof MetaGraphError) {
    console.error(`Meta error ${err.code} (${err.type}): ${err.message}`)
    // err.fbTraceId → for support tickets to Meta
  }
}
```

---

## Callers.  existing production usage

| Caller | What it uses | Schedule |
|---|---|---|
| `app/api/cron/marketing-snapshot-meta-page/route.ts` | `getPageInsights`, `getPagePostsWithInsights`, `getIGAccountInsights`, `getIGMediaWithInsights` | Daily (yesterday default); backfill via `?startDate=&endDate=` |
| `app/api/cron/marketing-snapshot-meta-ads/route.ts` | `getMetaAdsInsights` | Daily (yesterday default); backfill via `?startDate=&endDate=` |
| `automation_skills/automation/publish/SKILL.md` → `/api/social/publish` | `publishReel`, `publishFacebookReel`, `publishImage`, `publishCarousel` | On-demand, post Matt approval |

Both snapshot crons write to `public.marketing_channel_daily` in Supabase project `dwvlophlbvvygjfxcrhm`. The `source` column is set to `meta_graph_v25` (organic) and `meta_ads_insights_api` (ads) for audit traceability.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Token revoked or password changed | `MetaGraphError` code 190, type `OAuthException` | Regenerate the long-lived token in Graph API Explorer: User Token → exchange for long-lived → then `GET /me/accounts` to get the Page token. Update `META_PAGE_ACCESS_TOKEN` in Vercel env and `.env.local`. |
| Missing scope | `MetaGraphError` code 10 or 200, "Permissions error" | Re-auth the app with explicit scope list. Check the App Dashboard → App Review → Permissions. Scopes cannot be added without re-auth. |
| IG account not linked to FB Page | `MetaGraphError` on any `/{ig-user-id}/` call, or empty `instagram_business_account` on page lookup | Fix in Meta Business Suite: Page Settings → Linked Accounts → Connect Instagram Business Account. |
| API version sunset | `MetaGraphError` with message referencing minimum supported version | Bump `v25.0` to the new minimum in `lib/meta-graph.ts`. Versions deprecate on a published schedule at developers.facebook.com/roadmap. |
| Container status ERROR or EXPIRED | `MetaGraphError('Media container {id} entered status: ERROR')` from `waitForContainer` | Video URL may have expired, been inaccessible, or exceeded format limits (codec, dimensions, file size). Re-upload to a fresh URL and retry. |
| Ads insights returns zero rows | `accountRow: null`, empty `campaignRows` | Normal for days with no active spend.  no campaigns ran. Normalize to zero spend; do not treat as an error. |
| Campaign status silently missing from insights response | No error, but `campaign_status` undefined on every row | Expected.  see gotcha #1. Fetch campaign list from `/campaigns` separately. |
| IG publishing quota exceeded | `MetaGraphError` code 9007, "Content Publishing Limit Reached" | Hard ceiling: 25 posts per 24 h. Check `getPublishingLimit()` before any publishing call when high-volume posting is expected. |
| FB Reel upload OOM | `Vercel function crashed` on `arrayBuffer()` for large files | Video exceeds 100 MB. Compress to under 100 MB (current brand spec limit) before uploading. |

---

## Pre-flight checklist (before any new Meta Graph call)

```
[ ] META_PAGE_ACCESS_TOKEN confirmed in.env.local and Vercel env
[ ] META_FB_PAGE_ID confirmed (derive once via /me/accounts if not stored)
[ ] META_IG_BUSINESS_ACCOUNT_ID confirmed (derive via /{page-id}?fields=instagram_business_account)
[ ] META_AD_ACCOUNT_ID confirmed (ads calls only)
[ ] API version is v25.0 in lib/meta-graph.ts.  not an older pinned version
[ ] Campaign status NOT added to CAMPAIGN_INSIGHTS_FIELDS (gotcha #1)
[ ] For publishing: gate.json preconditions validated per automation_skills/automation/publish/SKILL.md
[ ] For IG video publishing: container status polling in place.  do not publish before FINISHED
[ ] For new insight metrics: verified the metric is valid for the given period (day vs lifetime vs snapshot)
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/meta-graph.ts` | Single client for all Meta Graph calls; all exported functions listed above |
| `app/api/cron/marketing-snapshot-meta-page/route.ts` | FB + IG organic ingestion cron; row-builder pattern for `marketing_channel_daily` |
| `app/api/cron/marketing-snapshot-meta-ads/route.ts` | Meta Ads ingestion cron; account + campaign row decomposition |
| `automation_skills/automation/publish/SKILL.md` | Publish skill.  gate preconditions, per-platform matrix, Buffer vs native decision |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Apify.  use for competitor scraping (not own-account data) |
| `social_media_skills/platform-best-practices/SKILL.md` | IG/FB format specs, posting cadence, caption conventions |
| `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` | Paid Meta pipeline.  CAPI, webhooks, lead-gen ad wiring |
| `docs/MARKETING_LEAD_FLOW.md` | Webhook + dedup detail for Meta lead-form → FUB path |
| https://developers.facebook.com/docs/graph-api | Graph API reference |
| https://developers.facebook.com/docs/instagram-api | Instagram Graph API reference |
| https://developers.facebook.com/docs/marketing-api/insights | Meta Ads Insights API reference |
| https://developers.facebook.com/tools/explorer | Graph API Explorer.  token generation + endpoint testing |
