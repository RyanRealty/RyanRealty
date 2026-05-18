---
name: tools_registry-linkedin-api
description: Use this skill when a task involves "LinkedIn API", "LinkedIn page posts", "LinkedIn follower count", "LinkedIn engagement", "snapshot-channels-linkedin", "linkedin_auth", "engagement_rate LinkedIn", "LinkedIn OAuth", "LinkedIn Marketing API", "Community Management API", "rw_organization_admin", "organizationalEntityShareStatistics", "linkedin_marketing_api_v2", or any task that reads or publishes from Ryan Realty's own LinkedIn Company Page or personal profile. This skill governs own-account analytics ingestion, publishing via the existing dev-app, and the blocked dev-app architecture decision that prevents analytics until Matt resolves it.
---

# LinkedIn API Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's channel-snapshot and publishing layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `social_media_skills/platform-best-practices/SKILL.md`.  LinkedIn cadence target (3/wk), locked metric (`engagement_rate` as dwell proxy), algorithm context

---

## Scope

**Use LinkedIn API for:**

| Use case | Why this API |
|---|---|
| Own Company Page follower count + daily gains | `organizationalEntityFollowerStatistics`.  only way to get daily gain data |
| Own Company Page organic impressions, clicks, reactions, comments, shares, engagement_rate | `organizationalEntityShareStatistics`.  per-day time-bucketed stats |
| Per-post share statistics (last 30 posts) | Same `organizationalEntityShareStatistics` endpoint with `ugcPosts[N]=` params |
| Recent post list (author, text, media type, published date) | `GET /rest/posts?author=urn:li:organization:…` |
| Publishing posts as personal member | `POST /rest/posts` with `urn:li:person:{sub}` author.  works today |
| Publishing posts as Company Page | `POST /rest/posts` with `urn:li:organization:{id}` author.  works today |

**Do NOT use LinkedIn API for:**

| Data source | Use instead |
|---|---|
| Competitor LinkedIn company profiles and posts | `apify` via `tools_registry/apify/SKILL.md` (Apify LinkedIn scraper) |
| Personal member analytics not tied to the Company Page | Out of scope for Ryan Realty marketing brain |
| Campaign Manager / paid ad stats | Requires Campaign Manager API tier.  not wired |

---

## CRITICAL ARCHITECTURE DECISION.  BLOCKED (Community Management API)

**Status as of 2026-05-13: Company Page analytics return 0 rows until Matt resolves this.**

LinkedIn Developer Apps enforce a mutual exclusivity constraint:

> **The Community Management API product is MUTUALLY EXCLUSIVE with the Share-on-LinkedIn and Sign-In-with-LinkedIn products on the same app.**

Ryan Realty's current LinkedIn Developer App (`LINKEDIN_CLIENT_ID`) has **Share-on-LinkedIn + Sign-In-with-LinkedIn** enabled, which powers the publishing flow at `/api/social/publish`.

The `rw_organization_admin` and `r_organization_social` scopes.  required to call `organizationalEntityShareStatistics` and `organizationalEntityFollowerStatistics`.  are gated behind the **Community Management API** product. That product cannot be added to the current app without removing the publishing products.

### Two paths forward.  Matt's decision pending

**Option A.  Create a separate "Ryan Realty Analytics" Developer App**

- New app at developer.linkedin.com with only Community Management API enabled.
- New `LINKEDIN_ANALYTICS_CLIENT_ID` + `LINKEDIN_ANALYTICS_CLIENT_SECRET` env vars.
- New OAuth flow at, e.g., `/api/linkedin/authorize-analytics`.
- Two separate `linkedin_auth` rows (or a second table).  one per app.
- Existing publishing flow (current app) stays intact.
- Adds operational overhead: two apps to maintain, two OAuth token lifecycles to keep live.

**Option B.  Remove Share-on-LinkedIn / Sign-In products from the current app**

- Add Community Management API to the current app in place of Share and Sign-In.
- The publishing flow at `/api/social/publish` breaks (it calls `POST /rest/posts` as member, which requires Share-on-LinkedIn).
- Publishing must be rebuilt against the Community Management app's token.

**Until Matt decides:** do not attempt to add `rw_organization_admin` to the current app's OAuth scope list. The authorization flow will reject it with `unauthorized_scope` because the product is not enabled. This is a known, expected error.  it is not a misconfiguration to debug.

**Where to surface this decision:** next marketing brain audit that touches LinkedIn; also in `marketing_brain_skills/diagnose-performance` output for `channel='linkedin'`.

---

## Authentication

### Env vars

| Variable | Purpose | Where stored |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | OAuth app client ID.  current dev app | `.env.local`, Vercel env |
| `LINKEDIN_CLIENT_SECRET` | OAuth app client secret.  current dev app | `.env.local`, Vercel env |
| `LINKEDIN_REDIRECT_URI` | OAuth callback URL (`/api/linkedin/callback`) | `.env.local`, Vercel env |
| `LINKEDIN_PERSON_ID` | Numeric legacy member ID.  fallback only; modern calls use OpenID `sub` | `.env.local`, Vercel env |
| `LINKEDIN_ORGANIZATION_ID` | Numeric LinkedIn Company Page ID (e.g. `12345678`); required by analytics cron | `.env.local`, Vercel env |

### Token table.  `public.linkedin_auth` (Supabase)

Tokens are persisted in Supabase, not in Redis or env vars. Row `id = 'default'` is the singleton row for Ryan Realty's account.

| Column | Type | Notes |
|---|---|---|
| `id` | text | `'default'`.  singleton |
| `access_token` | text | Bearer token; lasts ~60 days |
| `refresh_token` | text | Long-lived; lasts ~365 days; used to regenerate access_token |
| `expires_at` | timestamptz | Refresh if `Date.now() >= expires_at - 5min` |
| `person_urn` | text | `urn:li:person:{sub}`.  populated from OpenID userinfo at auth time |
| `updated_at` | timestamptz | Updated on every token refresh |

### Token lifecycle

Access tokens last approximately 60 days. Refresh tokens last approximately 365 days. LinkedIn does not guarantee exact lifetimes.  trust `expires_in` from the token response, not a hardcoded number.

The canonical token helper is `getLinkedInAccessToken()` in `lib/linkedin.ts`. It:

1. Reads the `linkedin_auth` row.
2. If the token is fresh (not within 5 min of `expires_at`), returns it directly.
3. If near expiry and `refresh_token` is non-empty, calls `refreshLinkedInToken()` which POSTs to `/oauth/v2/accessToken` with `grant_type=refresh_token` and writes the new token back to Supabase.
4. If there is no row, or `refresh_token` is missing/empty, throws with a re-auth instruction.

Do not read the `linkedin_auth` row directly. Always go through `getLinkedInAccessToken()`.

### OAuth scopes.  current dev app

The current app token carries these scopes (provisioned 2026-05-09):

| Scope | What it unlocks |
|---|---|
| `openid` | OpenID Connect.  required for `/v2/userinfo` which returns the canonical `sub` |
| `profile` | Extended profile fields (name, headline) |
| `email` | Email address for identity verification |
| `w_member_social` | Publish posts as the authenticated person member |
| `rw_organization_admin` | Read + manage Company Page admin (listed in scope request) |
| `r_organization_social` | Read posts on the Company Page (listed in scope request) |

**Note:** `rw_organization_admin` and `r_organization_social` are listed in the scope string but will be rejected by the authorization flow until the Community Management API product is enabled on the app (see CRITICAL ARCHITECTURE DECISION above). The token in `linkedin_auth` was provisioned with `openid + profile + email + w_member_social` successfully. The org-admin scopes are effectively inactive.

### OAuth flow

Authorization URL: `https://www.linkedin.com/oauth/v2/authorization`
Token endpoint: `https://www.linkedin.com/oauth/v2/accessToken`

Both exchange (auth code) and refresh use `Content-Type: application/x-www-form-urlencoded` POST bodies.  NOT JSON.

Canonical implementation: `lib/linkedin.ts`.  `getLinkedInAuthorizationUrl()`, `exchangeLinkedInCode()`, `upsertLinkedInToken()`, `getLinkedInAccessToken()`, `refreshLinkedInToken()` (private).

---

## API version.  IMPORTANT

LinkedIn uses dated version headers. All REST API calls must include:

```ts
'LinkedIn-Version': '202602'
'X-Restli-Protocol-Version': '2.0.0'
```

The pinned version is `202602` (set in both `lib/linkedin.ts` as `LINKEDIN_REST_VERSION` and in the cron as `LI_VERSION`). Review this annually.  LinkedIn deprecates old versions. Errors mentioning a version mismatch usually appear as `400 Bad Request` with a response body indicating the version is outside the supported window.

---

## Endpoint patterns

Base URL: `https://api.linkedin.com`

### `POST /oauth/v2/accessToken`.  token exchange and refresh

Content-Type: `application/x-www-form-urlencoded`.

**Exchange auth code:**

```ts
const params = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: LINKEDIN_REDIRECT_URI,
  client_id: LINKEDIN_CLIENT_ID,
  client_secret: LINKEDIN_CLIENT_SECRET,
})
await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params.toString(),
})
```

**Refresh:**

```ts
const params = new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: storedRefreshToken,
  client_id: LINKEDIN_CLIENT_ID,
  client_secret: LINKEDIN_CLIENT_SECRET,
})
```

Response shape: `{ access_token, refresh_token?, expires_in, token_type, scope }`.

### `GET /v2/userinfo`.  OpenID Connect member identity

Returns `sub`, `name`, `given_name`, `family_name`, `email`. Requires `openid` scope.

The `sub` value (not the legacy numeric `LINKEDIN_PERSON_ID`) is what `/rest/posts` expects for `urn:li:person:{sub}` authors on personal posts. The `getLinkedInUserInfo()` helper in `lib/linkedin.ts` fetches this; `publishLinkedInVideoFromUrl()` falls back to `LINKEDIN_PERSON_ID` if the call fails (e.g., test context with a legacy token).

### `GET /rest/networkSizes/{orgUrn}?edgeType=CompanyFollowedByMember`.  follower count snapshot

Returns `{ firstDegreeSize }`.  current total followers. This is a point-in-time snapshot, not a delta. The daily cron writes the same value for every day in the run window; the brain computes deltas across consecutive `marketing_channel_daily` rows.

```ts
const encoded = encodeURIComponent(`urn:li:organization:${LINKEDIN_ORGANIZATION_ID}`)
const url = `https://api.linkedin.com/rest/networkSizes/${encoded}?edgeType=CompanyFollowedByMember`
```

### `GET /rest/organizationalEntityFollowerStatistics`.  daily follower gains

Time-bucketed follower gains (organic + paid). Requires `rw_organization_admin` scope and Community Management API product. **Currently blocked**.  see architecture decision.

```ts
const params = new URLSearchParams({
  q: 'organizationalEntity',
  organizationalEntity: orgUrn,
  'timeIntervals.timeGranularityType': 'DAY',
  'timeIntervals.timeRange.start': String(startEpochMs),
  'timeIntervals.timeRange.end': String(endEpochMs),           // exclusive
})
```

Response shape: `{ elements: [{ followerGains: { organicFollowerGain, paidFollowerGain } }] }`.

### `GET /rest/organizationalEntityShareStatistics`.  impressions, clicks, engagement

Account-level daily stats AND per-post lifetime stats from the same endpoint, differentiated by query params. Requires `r_organization_social` scope and Community Management API product. **Currently blocked.**

**Account-level (time-bucketed):**

```ts
const params = new URLSearchParams({
  q: 'organizationalEntity',
  organizationalEntity: orgUrn,
  'timeIntervals.timeGranularityType': 'DAY',
  'timeIntervals.timeRange.start': String(startEpochMs),
  'timeIntervals.timeRange.end': String(endEpochMs),
})
```

**Per-post (lifetime totals, multi-post batch):**

```ts
const params = new URLSearchParams({ q: 'organizationalEntity', organizationalEntity: orgUrn })
posts.forEach((p, i) => params.append(`ugcPosts[${i}]`, p.id))
```

Response shape: `{ elements: [{ totalShareStatistics: { impressionCount, uniqueImpressionsCount, clickCount, likeCount, commentCount, shareCount, engagement } }] }`.

The `engagement` field is LinkedIn's pre-computed engagement rate (float, typically 0.00-0.10). This is the proxy for dwell time.  the brain's locked most-important LinkedIn metric per the 2025 360Brew Interest Graph shift.

### `GET /rest/posts?author={orgUrn}&q=author`.  recent post list

Returns posts published by the organization. Requires `r_organization_social`. **Currently blocked.**

```ts
const params = new URLSearchParams({
  author: orgUrn,
  q: 'author',
  count: '10',
  start: '0',
  sortBy: 'LAST_MODIFIED',
})
```

Response shape: `{ elements: [{ id, author, commentary, publishedAt, lifecycleState, content, mediaType }] }`. The `content` shape differs by post type (`media.id` for video, `article.source` for article, `multiImage` for carousel).

### `POST /rest/posts`.  publish a post (works today on existing app)

Publishes as a person member or as an organization. The publishing flow at `/api/social/publish` uses this endpoint today via `publishLinkedInVideoFromUrl()` in `lib/linkedin.ts`.

```ts
await fetch('https://api.linkedin.com/rest/posts', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': '202602',
    'X-Restli-Protocol-Version': '2.0.0',
  },
  body: JSON.stringify({
    author: `urn:li:person:${sub}`,           // or urn:li:organization:{id}
    commentary: caption,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: { media: { id: assetUrn } },     // for video; omit for text-only
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }),
})
// Post URN is returned in response header: x-restli-id
```

The legacy `POST /v2/ugcPosts` endpoint rejects `urn:li:person:` authors with a 422. Use `/rest/posts` for all new publishing.

---

## Rate limits

LinkedIn REST API rate limits are undocumented publicly. In practice:

- Member-facing calls (`/rest/posts` publish): very low volume.  no throttling concern at current posting cadence (3/wk).
- Analytics endpoints (when unblocked): queried once per day per cron run. No throttling concern.
- If a 429 is received, back off with exponential delay starting at 60 seconds. Do not retry in a tight loop.

---

## Cost

The LinkedIn API is **free** for own-account reads at the current usage volume. No per-call cost. Campaign Manager API (paid ad stats) would require a separate LinkedIn Marketing Developer Platform application.  out of scope for now.

---

## Where results land

Daily ingestion writes to `public.marketing_channel_daily` in Supabase (`dwvlophlbvvygjfxcrhm`), via the shared `upsertMetricRows()` helper from `lib/marketing-brain/snapshot.ts`.

**Row schema per metric:**

| Column | Example value |
|---|---|
| `date` | `'2026-05-15'` |
| `channel` | `'linkedin'` |
| `scope` | `'account'` or `'post'` |
| `scope_id` | `''` (account) or `'urn:li:ugcPost:12345'` |
| `metric` | `'followers_count'`, `'engagement_rate'`, `'impressions'`, etc. |
| `value` | numeric |
| `source` | `'linkedin_marketing_api_v2'` |
| `metadata` | jsonb.  post rows carry `post_type`, `published_at`, `text_snippet` (first 200 chars) |

**Account-scope metrics (daily):**

- `followers_count`.  current total (snapshot written per day)
- `follower_gains`.  organic + paid new followers that day
- `impressions`.  total post impressions for the day
- `unique_impressions`
- `clicks`
- `reactions`.  `likeCount` field (LinkedIn counts all reaction types together)
- `comments`
- `shares`
- `engagement_rate`.  LinkedIn's pre-computed rate; **locked most-important metric**

**Post-scope metrics (last 30 days, lifetime totals per post):**

- `impressions`, `unique_impressions`, `clicks`, `reactions_total`, `comments`, `shares`, `engagement_rate`

**Note on 0-row state:** until the Community Management API decision is resolved, the ingestor still runs (the cron exists at `app/api/cron/marketing-snapshot-linkedin/route.ts`) and successfully writes `followers_count` via `networkSizes` (that endpoint does not require Community Management). The share stats calls will fail with `403` or a scope error; those failures are logged in the ingestor's `errors` array. This is the expected current state.

---

## Existing implementation

| File | Purpose |
|---|---|
| `lib/linkedin.ts` | Core helpers: `getLinkedInAuthorizationUrl`, `exchangeLinkedInCode`, `upsertLinkedInToken`, `getLinkedInAccessToken`, `getLinkedInUserInfo`, `publishLinkedInVideoFromUrl` |
| `app/api/cron/marketing-snapshot-linkedin/route.ts` | Daily ingestor: `fetchFollowerCount` (works), `fetchFollowerGains` (blocked), `fetchAccountShareStats` (blocked), `fetchRecentPosts` (blocked), `fetchPostShareStats` (blocked) |
| `app/api/social/publish/route.ts` | Publishing route.  calls `publishLinkedInVideoFromUrl()` from `lib/linkedin.ts` |

Read `lib/linkedin.ts` before writing any new LinkedIn API call. The `getLinkedInAccessToken()` function is the canonical token-fetch pattern.  do not read the `linkedin_auth` row directly or implement a parallel refresh path.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `unauthorized_scope` on OAuth authorize | Auth flow rejects `rw_organization_admin` or `r_organization_social` | Community Management API product not enabled on the dev app. Do not attempt to add it until Matt decides on dev-app architecture (Option A or B.  see above). This is a known, expected failure. |
| `403` on `organizationalEntityShareStatistics` or `organizationalEntityFollowerStatistics` | Scope not granted; analytics calls fail with permission error | Same root cause as above. Expected state until architecture decision resolves. |
| `INVALID_ACCESS_TOKEN` (401) | Access token expired | `getLinkedInAccessToken()` auto-refreshes. If refresh also fails, re-run OAuth at `/api/linkedin/authorize`. |
| No `linkedin_auth` row | `LinkedIn not connected` error on cold start | Matt must complete the OAuth flow at `/api/linkedin/authorize`. |
| `refresh_token` missing or expired | Refresh attempt fails; ingestor returns 500 | Refresh tokens last ~365 days. Re-run the OAuth flow at `/api/linkedin/authorize`. |
| `422` on `POST /v2/ugcPosts` with person author | Legacy endpoint rejects `urn:li:person:` authors | Use `POST /rest/posts` (modern endpoint). `lib/linkedin.ts` already does this. |
| Version header missing or stale | `400 Bad Request` with version error body | Ensure `LinkedIn-Version: 202602` and `X-Restli-Protocol-Version: 2.0.0` on every REST call. Update version string annually. |
| 429 rate limit | Too many requests | Back off exponentially starting at 60s. Not expected at current daily-cron cadence. |
| `LINKEDIN_ORGANIZATION_ID` not set | Ingestor returns `500` with config error | Add the numeric org ID to Vercel env and `.env.local`. Find it in the LinkedIn Company Page admin URL or via `GET /v2/organizationAcls`. |
| Endpoint path changed between versions | 404 on a previously working call | Check `LinkedIn-Version` header against LinkedIn changelog. Pin to a supported version and re-test. |

---

## Pending decisions

| Decision | Blocking | Detail |
|---|---|---|
| Dev-app architecture.  Option A (separate Analytics app) vs Option B (retire publishing products) | Company Page analytics (`engagement_rate`, impressions, per-post stats, follower gains) | Matt's strategic call. Option A preserves the current publishing flow; Option B requires rebuilding it. Until decided, analytics cron returns 0 rows for share stats and follower gains, but `followers_count` via `networkSizes` does populate. |

---

## Used by

| Consumer | How |
|---|---|
| `app/api/cron/marketing-snapshot-linkedin/route.ts` | Daily ingestion.  runs at 06:30 UTC, writes account + post metrics to `marketing_channel_daily` |
| `app/api/social/publish/route.ts` | Calls `publishLinkedInVideoFromUrl()` to post video content to LinkedIn as personal member |
| `marketing-brain:diagnose-performance` (channel=`'linkedin'`) | Reads `marketing_channel_daily` for LinkedIn rows; surfaces `engagement_rate` trend and anomalies |

---

## Pre-flight checklist (before any new LinkedIn API call)

```
[ ] LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET confirmed in.env.local
[ ] LINKEDIN_ORGANIZATION_ID set in.env.local (numeric, no urn: prefix)
[ ] linkedin_auth row with id='default' exists in Supabase (run OAuth flow if missing)
[ ] Using getLinkedInAccessToken() from lib/linkedin.ts.  not reading the row directly
[ ] Request headers include LinkedIn-Version: 202602 and X-Restli-Protocol-Version: 2.0.0
[ ] Not requesting rw_organization_admin or r_organization_social scopes until Community Management API product is enabled (dev-app decision pending)
[ ] Results write to marketing_channel_daily via upsertMetricRows().  not a custom table
[ ] If publishing: using POST /rest/posts (not legacy /v2/ugcPosts)
[ ] If publishing as person: using OpenID sub (from getLinkedInUserInfo) not LINKEDIN_PERSON_ID
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/linkedin.ts` | Core helpers.  read before writing any new LinkedIn API code |
| `app/api/cron/marketing-snapshot-linkedin/route.ts` | Canonical ingestor.  read before writing any new analytics ingestion |
| `app/api/social/publish/route.ts` | Publishing route.  shows how `publishLinkedInVideoFromUrl` is called in practice |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Competitor LinkedIn scraping via Apify |
| `social_media_skills/platform-best-practices/SKILL.md` | LinkedIn cadence target (3/wk), locked metric (`engagement_rate`), Interest Graph shift context |
| `lib/marketing-brain/snapshot.ts` | Shared `upsertMetricRows()`, `MetricRow`, `IngestorResult` types |
| https://learn.microsoft.com/en-us/linkedin/ | Official LinkedIn API reference |
| https://learn.microsoft.com/en-us/linkedin/marketing/community-management/ | Community Management API.  the product needed for org analytics |
| https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow | OAuth 2.0 authorization code flow |
| https://learn.microsoft.com/en-us/linkedin/marketing/versioning | LinkedIn API versioning and deprecation policy |
