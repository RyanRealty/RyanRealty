---
name: tools_registry-x-api
description: Use this skill when a task involves "X API", "Twitter API", "X v2", "tweet list", "tweet metrics", "X account followers", "x_auth", "X OAuth", "replies metric X", "X rate limit", "snapshot-channels-x", "getXAnalytics", "getXAccessToken", "PKCE X", "x_publisher", or any task that reads or writes Ryan Realty's own X account via the X (Twitter) API v2. This skill governs own-account ingestion and (scaffolded) publishing. For competitor X profile scraping, use the Apify tool skill instead.
---

# X (Twitter) API v2 Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's channel-snapshot and publishing layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `social_media_skills/platform-best-practices/SKILL.md`.  X cadence target (5/wk per playbook)

---

## Scope

**Use X API v2 for:**

| Use case | Why this API |
|---|---|
| Own-account tweet list with engagement metrics (likes, replies, retweets, quotes, bookmarks) | OAuth-gated timeline endpoint.  the only reliable source of own-account stats |
| Own-account profile metrics (followers_count, following_count, tweet_count) | `users.read` scope; no scraping needed |
| Bootstrapping `user_id` for timeline queries | Required by `/2/users/:id/tweets`; fetch once per run via `/2/users/me` then cache |
| Token lifecycle (exchange code, refresh) | OAuth 2.0 PKCE token endpoints |
| Publishing tweets with native media (text + image/video) | `tweet.write` + `media.write` scopes; Basic+ tier |

**Do NOT use X API v2 for:**

| Data source | Use instead |
|---|---|
| Competitor X profiles and tweets | Apify (see `tools_registry/apify/SKILL.md`) |
| Impressions, link clicks, profile clicks, organic reach at tweet level | Elevated/Pro tier only.  not subscribed; emit tier_limited flag, do not emit zeros |
| `non_public_metrics` (url_clicks, user_profile_clicks) | `analytics.read` scope.  paid Elevated tier; not granted |
| Ryan Realty's Meta / YouTube / TikTok metrics | Their respective tool skills in this registry |

**The division is strict:** own-account reads + writes via official API; competitor reads via Apify scraping. Never flip them.

---

## North-star metric.  `replies`

Per the X OSS algorithm and Ryan Realty's platform playbook, **`replies` carries 13.5× the engagement weight of other signals** in X's ranking model. It is the single most important metric to track, surface in brain diagnoses, and optimize content toward.

When the brain generates an X performance insight, `replies` appears first and receives explicit commentary regardless of its absolute count. A tweet with 2 replies outranks one with 50 likes on the engagement-quality axis.

---

## Authentication

### Env vars

| Variable | Purpose | Where stored |
|---|---|---|
| `X_CLIENT_ID` | OAuth 2.0 app client ID from developer.x.com | `.env.local`, Vercel env |
| `X_CLIENT_SECRET` | OAuth 2.0 app client secret | `.env.local`, Vercel env |
| `X_REDIRECT_URI` | OAuth callback URL (`/api/x/callback`) | `.env.local`, Vercel env |

### Token table.  `public.x_auth` (Supabase)

The OAuth access token is persisted in Supabase, not in Redis or env vars. Row `id = 'default'` is the singleton row for Ryan Realty's X account.

| Column | Type | Notes |
|---|---|---|
| `id` | text | `'default'`.  singleton |
| `access_token` | text | Bearer token; expires in ~2 hours |
| `refresh_token` | text | Long-lived; used to regenerate access_token |
| `expires_at` | timestamptz | Auto-refreshed within 60s of expiry by `getXAccessToken()` |
| `user_id` | text | **Cache the numeric X user_id here after first `/2/users/me` call.** See CRITICAL GOTCHA below. |
| `updated_at` | timestamptz | Updated on every token refresh |

### OAuth 2.0 PKCE flow

X uses PKCE (Proof Key for Code Exchange).  there is no implicit/password flow. The PKCE verifier is stored in Upstash Redis under key `x:pkce:<state>` with a 600s TTL, then consumed by the callback. Key helpers:

```ts
import { getXAuthorizationUrl, getXCodeVerifier, exchangeXCode, upsertXToken } from '@/lib/x'

// 1. Initiate: build URL and redirect user
const authUrl = await getXAuthorizationUrl(state)

// 2. Callback: exchange code for tokens
const verifier = await getXCodeVerifier(state)     // reads + deletes from Redis
const token = await exchangeXCode(code, verifier)  // calls /2/oauth2/token
await upsertXToken(token)                          // persists to x_auth
```

Auth endpoint: `https://twitter.com/i/oauth2/authorize`
Token endpoint: `https://api.twitter.com/2/oauth2/token`

### OAuth scopes granted

| Scope | What it unlocks |
|---|---|
| `tweet.read` | Read own-account timeline, tweet fields |
| `tweet.write` | Create tweets (`POST /2/tweets`) |
| `users.read` | Read account profile metrics, resolve user_id |
| `media.write` | Upload images/video via v1.1 media upload endpoint (Basic+ required) |
| `offline.access` | Issue refresh tokens (required for long-lived sessions) |

Scopes `analytics.read` and `tweet.moderate_write` are NOT granted.  they require Elevated tier application and approval.

---

## CRITICAL GOTCHA.  `/2/users/me` is aggressively rate-limited on Free/Basic

**This is the #1 source of 429 failures in the X ingestor on long backfill runs.**

`GET /2/users/me` has a very low rate ceiling on the Free and Basic tiers. A backfill that calls it once per day iteration hits 429s after the first ~14 days of iteration.

**Verified live 2026-05-13.** 3,825 rows already flowing over 75 days via the cached-user_id approach.

**Mitigation.  cache the user_id, call `/2/users/me` exactly ONCE per ingestor run:**

```ts
// In the cron route:
const accessToken = await getXAccessToken()

// Call getXUserId() ONCE before the day-iteration loop.
// This calls GET /2/users/me once per run, not once per day.
const userId = await getXUserId(accessToken)

for (const day of dateIter(startDate, endDate)) {
  const analytics = await getXAnalytics(accessToken, day)
  // getXAnalytics internally uses the userId it resolves via getXUserId
  // For multi-day iteration, pass userId as a parameter if refactoring.
}
```

The canonical implementation in `app/api/cron/marketing-snapshot-x/route.ts` resolves the access token once before the loop.  follow that pattern exactly. Calling `getXUserId()` inside the per-day loop is the bug this rule prevents.

**Future hardening:** persist `user_id` to `x_auth.user_id` after first resolution and read it from there on subsequent runs, eliminating the `/2/users/me` call entirely after initial OAuth. This is the same pattern the TikTok skill uses for `open_id`.

---

## Endpoint patterns

Base URL: `https://api.twitter.com/2`

### `POST /2/oauth2/token`.  token exchange and refresh

Content-Type: `application/x-www-form-urlencoded`. Authorization: `Basic base64(clientId:clientSecret)`.

**Exchange auth code for tokens:**

```ts
const params = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: X_REDIRECT_URI,
  code_verifier: codeVerifier,   // PKCE.  not client_secret
})
// Authorization: Basic base64(X_CLIENT_ID:X_CLIENT_SECRET)
```

**Refresh an existing token:**

```ts
const params = new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: storedRefreshToken,
})
// Same Authorization: Basic header
```

Response shape: `{ access_token, refresh_token, expires_in, token_type, scope }`.

Canonical implementation: `lib/x.ts`.  `exchangeXCode()`, `refreshXToken()` (internal), `getXAccessToken()` (public entry point with auto-refresh).

### `GET /2/users/me`.  resolve user_id (call ONCE per run)

```ts
const url = `https://api.twitter.com/2/users/me?user.fields=id`
const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
// resp.json(): { data: { id: string, name: string, username: string } }
```

Call this exactly once per ingestor run. Cache the returned `id` (the numeric user_id) in memory for all subsequent timeline and metrics queries in that run. Do NOT call it inside a pagination or day-iteration loop.

### `GET /2/users/:id`.  account-level public metrics

```ts
const url = `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`
// public_metrics: { followers_count, following_count, tweet_count, listed_count }
```

Returns cumulative account stats at the time of the call. Not a daily delta.  the brain computes deltas across consecutive `marketing_channel_daily` rows.

Tier note: `public_metrics` on the user endpoint is available on Free and Basic. Organic impression totals at the account level require Elevated.

### `GET /2/users/:id/tweets`.  own-account timeline

```ts
const params = new URLSearchParams({
  max_results: '100',
  'tweet.fields': 'created_at,public_metrics,attachments,entities',
  start_time: thirtyDaysAgo.toISOString(),
})
if (nextToken) params.set('pagination_token', nextToken)
const url = `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`
```

Paginated. Returns tweets newest-first. `next_token` is the pagination cursor. Pagination cap: 2 pages (200 tweets) per ingestor run.  more than sufficient for daily posting volume.

**Fields available on Basic tier** via `public_metrics`:

| Field | API key |
|---|---|
| Likes | `like_count` |
| Replies | `reply_count`.  **north-star metric, 13.5× weight** |
| Retweets | `retweet_count` |
| Quote tweets | `quote_count` |
| Bookmarks | `bookmark_count` |
| Impressions | `impression_count`.  present on Basic but may return 0; flagged `tier_limited` when zero |

**Fields NOT available on Basic** (require Elevated):

- `non_public_metrics`.  `url_clicks`, `user_profile_clicks`, `link_clicks`
- Organic reach / true impression_count at account level
- Audience demographics

When a metric is tier-limited and its value would be a misleading 0, the ingestor **omits the row entirely** rather than emitting `{ value: 0 }`. This prevents the brain from misreading "0 impressions" as real data.

### `POST /2/tweets`.  publish a tweet

```ts
const body: { text: string; media?: { media_ids: string[] } } = { text }
if (mediaId) body.media = { media_ids: [mediaId] }

const resp = await fetch('https://api.twitter.com/2/tweets', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
})
// resp.json(): { data: { id: string, text: string } }
```

Rate-limited on Free tier (500 tweets/mo cap). Basic tier raises this to 10k/mo. Post at most 5/wk per platform playbook.  well within Basic limits.

### Media upload.  v1.1 chunked upload API

Native media attaches via the v1.1 media upload endpoint (separate from the v2 API base):

```
POST https://upload.twitter.com/1.1/media/upload.json
```

Three-step chunked protocol: INIT → APPEND (5 MB chunks) → FINALIZE. FINALIZE polls `processing_info.state` until `succeeded` or `failed`. Canonical implementation: `lib/x.ts`.  `uploadVideoToX()`.

`media.write` scope is required. This scope was added to the app grant on 2026-05-10.  if OAuth re-auth is needed, it will include this scope automatically via `X_OAUTH_SCOPES`.

---

## Tier matrix

| Tier | Cost | Timeline read | Public engagement counts | Impressions | Organic metrics | Tweet write |
|---|---|---|---|---|---|---|
| Free | $0 | No | No | No | No | 500/mo |
| Basic | $100/mo | Yes | Yes | Unreliable (may be 0) | No | 10k/mo |
| Elevated | Requires application | Yes | Yes | Yes | Yes | 10k/mo |
| Pro | $5k/mo | Yes | Yes | Yes | Full | 1M/mo |

**Current tier: Basic.** Ryan Realty is at Basic ($100/mo). The ingestor operates within Basic constraints. Impressions are flagged `tier_limited` when zero.

Tier upgrade to Elevated or Pro is unlikely to be worth it until X consistently drives qualified seller or buyer leads. Surface the decision to Matt with a cost/benefit frame when X shows >5 qualified leads in a 30-day window.

---

## Where results land

Daily ingestion writes to `public.marketing_channel_daily` in Supabase (`dwvlophlbvvygjfxcrhm`) via `upsertMetricRows()` from `lib/marketing-brain/snapshot.ts`.

**Row schema per metric:**

| Column | Example value |
|---|---|
| `date` | `'2026-05-15'` |
| `channel` | `'x'` |
| `scope` | `'account'` or `'post'` |
| `scope_id` | `''` (account) or `'<tweet_id>'` |
| `metric` | `'followers_count'`, `'replies'`, `'impressions'`, etc. |
| `value` | numeric |
| `source` | `'x_api_v2'` |
| `metadata` | jsonb.  post rows carry `text_snippet`, `created_at`, `tweet_type`, `tier_limited` |

**Account-scope metrics (daily snapshot):**

- `followers_count`.  current follower total
- `following_count`
- `tweet_count_today`.  derived by filtering timeline to the ingested date
- `likes`, `replies`, `retweets`, `quotes`, `bookmarks`.  summed from today's tweets
- `engagements`.  sum of all five signals above
- `impressions`.  emitted only when non-zero or not tier-limited

**Post-scope metrics (top 10 tweets by impressions, last 30 days):**

- `likes`, `replies`, `retweets`, `quotes`, `bookmarks` per tweet
- `impressions` per tweet.  omitted when tier-limited and zero

---

## Existing implementation

| File | Purpose |
|---|---|
| `lib/x.ts` | Core helpers: `getXOAuthEnv`, `getXAuthorizationUrl`, `getXCodeVerifier`, `exchangeXCode`, `upsertXToken`, `getXAccessToken` (auto-refresh), `getXUserId`, `getXAnalytics`, `uploadVideoToX`, `postXTweet`, `XAnalytics` / `XAccountMetrics` / `XTweetMetrics` types |
| `app/api/cron/marketing-snapshot-x/route.ts` | Daily ingestor: token resolution once per run, day-iteration loop, `rowsForDay()`, tier-limited omission logic |
| `app/api/x/authorize/route.ts` | OAuth initiation.  generates PKCE, stores verifier in Redis, redirects to X |
| `app/api/x/callback/route.ts` | OAuth callback.  retrieves verifier from Redis, exchanges code for tokens, persists to `x_auth` |

Read `lib/x.ts` before writing any new X API call. `getXAccessToken()` is the canonical token-fetch.  it reads from `x_auth`, auto-refreshes when within 60s of expiry, and surfaces a clear reconnect error if the row is missing or the refresh token is gone.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| 429 on `GET /2/users/me` | `GET /2/users/me failed: 429` during backfill | Apply the CRITICAL GOTCHA mitigation.  call `getXUserId()` once before the day loop, not inside it. Consider caching `user_id` in `x_auth` for runs beyond a single session. |
| Access token expired | 401 on any `/2/*` endpoint | `getXAccessToken()` auto-refreshes via `refresh_token`. If the refresh token is also gone or expired, the error message instructs reconnect at `/api/x/authorize`. |
| No `x_auth` row | `"X not connected.  visit /api/x/authorize to connect"` | Matt must complete the OAuth flow at `/api/x/authorize` to create the initial row. This is expected on a cold start. |
| 403 missing scope | `"X tweet creation failed: 403 Forbidden"` on write operations | Re-auth via `/api/x/authorize` to pick up any newly added scopes (e.g., `media.write` added 2026-05-10). Do not add scopes without re-running the OAuth grant. |
| 503 / timeout on X infra | Sporadic 503 or hung request on timeline or tweet endpoints | Back off and retry. X v2 has occasional infra wobbles.  the ingestor's per-day error catch surfaces these in `errors[]` without aborting the whole backfill. |
| `refresh_token` null or expired | Refresh attempt throws `"X access token expired and no refresh token"` | Refresh tokens typically expire after 6 months of non-use. Re-run the OAuth flow. The token-heartbeat cron at `app/api/cron/token-heartbeat/route.ts` should alert if the ingestor returns non-200 three days in a row. |
| Media processing failure | `"X media processing failed: <message>"` in FINALIZE poll | Usually a format or codec issue with the uploaded file. Verify the video is H264/MP4 under the X file-size cap (512 MB for video). The `finalizeMediaUpload()` helper in `lib/x.ts` polls up to 20 times with back-off. |
| Tweet write on Free tier | `"X tweet creation failed: 403"` with "Usage cap exceeded" body | Free tier is 500 tweets/mo; Basic is 10k/mo. At 5/wk cadence Ryan Realty needs Basic. Confirm tier at developer.x.com. |

---

## Pending decisions

| Decision | Blocking | Detail |
|---|---|---|
| Persist `user_id` to `x_auth.user_id` | Eliminating `/2/users/me` calls entirely on subsequent runs | Schema column exists; the ingestor currently resolves `user_id` per-run via one `/2/users/me` call. Writing it back to `x_auth` after first resolution would reduce that to zero future calls. Low-effort hardening. |
| Tier upgrade to Elevated | True `impression_count`, `url_clicks`, organic reach | Not worth it until X drives >5 qualified leads per month. Matt approves. |
| Publisher cron go-live | `x_publisher` posting pipeline | `lib/x.ts` has `postXTweet()` and `uploadVideoToX()`. The missing piece is `app/api/cron/marketing-publisher-x/route.ts` + Matt's approval to begin posting. |

---

## Used by

| Consumer | How |
|---|---|
| `app/api/cron/marketing-snapshot-x/route.ts` | Daily ingestion.  runs at 06:30 UTC, writes account + top-tweet metrics to `marketing_channel_daily` |
| `marketing-brain:diagnose-performance` (channel=`'x'`) | Reads `marketing_channel_daily` for X rows; surfaces `replies` as the north-star signal in trend analysis |
| Future publisher | `postXTweet()` + `uploadVideoToX()` in `lib/x.ts`.  not yet wired into a publisher cron |

---

## Pre-flight checklist (before any new X API call)

```
[ ] X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI confirmed in.env.local
[ ] x_auth row with id='default' exists in Supabase (run OAuth flow at /api/x/authorize if missing)
[ ] Using getXAccessToken() from lib/x.ts.  not reading the token row directly
[ ] getXUserId() called ONCE per run before any loop.  not inside a day-iteration or pagination loop
[ ] Tier-limited metrics (impressions on Basic, non_public_metrics) are OMITTED (not emitted as zero) when value is 0
[ ] Pagination loop capped at 200 tweets (2 pages of 100)
[ ] Results write to marketing_channel_daily via upsertMetricRows().  not a custom table
[ ] North-star metric (replies) surfaced first in any performance summary or brain insight
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/x.ts` | Canonical helper.  read before writing any X API code |
| `app/api/cron/marketing-snapshot-x/route.ts` | Canonical ingestor.  follow its token-once + day-loop pattern exactly |
| `app/api/x/authorize/route.ts` + `app/api/x/callback/route.ts` | PKCE OAuth flow implementation |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Competitor X scraping (clockworks or social-scraper actor) |
| `social_media_skills/platform-best-practices/SKILL.md` | X cadence target (5/wk), replies as north-star signal, algorithm brief |
| `lib/marketing-brain/snapshot.ts` | Shared `upsertMetricRows()`, `MetricRow`, `IngestorResult` types |
| https://developer.twitter.com/en/docs/twitter-api | Official v2 API reference |
| https://developer.twitter.com/en/docs/twitter-api/tweets/timelines/api-reference | Timeline endpoint reference.  pagination, fields, start_time param |
| https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference | `/2/users/me` and `/2/users/:id` reference.  rate-limit tables per tier |
| https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code | PKCE OAuth 2.0 flow spec |
