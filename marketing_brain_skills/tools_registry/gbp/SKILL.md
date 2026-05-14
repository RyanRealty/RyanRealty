---
name: tools_registry-gbp
description: Use this skill when a task involves "Google Business Profile", "GBP performance", "call clicks", "Map Pack", "local search visibility", "GBP post", "GBP snapshot", "review response", "direction requests", "website clicks from Maps", "snapshot-channels-gbp", or any task that reads from or writes to Ryan Realty's Google Maps listing. GBP is the single source for the locked platform metric `call_clicks`, the cleanest bottom-of-funnel signal for local Map Pack ranking. Covers the Performance API (NOT the deprecated Insights API), OAuth flow, env vars, metric enum, date format gotcha, cost model, and failure modes.
---

# Google Business Profile Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's snapshot ingestion and reputation management layers. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/producers/ops-reputation/SKILL.md` — the producer that writes GBP posts and review responses

---

## Scope

**Use the GBP Performance API for:**

| Use case | Why GBP |
|---|---|
| Daily impression + engagement snapshot (Maps, Search, mobile, desktop) | The only authoritative source for how many people saw Ryan Realty in Map Pack results |
| `call_clicks` — the platform's locked most-important metric | Cleanest bottom-of-funnel signal; isolates Map Pack ranking issues from profile-trust issues |
| `website_clicks` from Maps | Captures intent that GA4 misses when the referrer is suppressed |
| Direction requests | Proxy for buyer/seller who physically drives to the office |
| Review stream (own_reviews) | Brand-voice monitoring and response drafting |

**Do NOT use the GBP Performance API for:**

| Data need | Use instead |
|---|---|
| Ryan Realty's own GA4 sessions from any source | GA4 Data API |
| GSC organic impressions / clicks | Google Search Console API |
| Competitor GBP review scraping | Apify — `compass/Google-Maps-Reviews-Scraper` actor |
| Publishing a GBP post or uploading a photo | `publishGoogleBusinessLocalPost()` in `lib/google-business-profile.ts` (uses the v4 My Business API, not the Performance API) |

---

## CRITICAL: Performance API, not Insights API

Google sunset the GBP Insights API in 2022. Any code targeting the old `mybusinessbusiness.googleapis.com/v4/...` insights endpoints or `mybusiness.googleapis.com/v4/...` metric routes returns 404 or 410. **Do not reintroduce those endpoints.**

The correct base URL is:

```
https://businessprofileperformance.googleapis.com/v1
```

The canonical implementation is `lib/google-business-profile.ts`, constant `GOOGLE_GBP_PERFORMANCE_BASE`. Do not change this constant.

---

## Authentication

GBP uses OAuth 2.0 with a user-delegated access token (not a service-account JSON key). The required OAuth scope is:

```
https://www.googleapis.com/auth/business.manage
```

Note: the GA4/GSC service account (`viewer@ryanrealty.iam.gserviceaccount.com`) uses a different auth path (service-account JWT). GBP does **not** use service-account JWT — it uses a user OAuth token tied to Matt's Google account, which has owner access on the GBP listing. These are two separate credential chains.

### Token storage and refresh (canonical pattern)

Tokens are stored in Supabase table `google_business_profile_auth` (row `id='default'`) with fields `access_token`, `refresh_token`, `expires_at`, `token_type`, `scope`. The access token auto-refreshes 60 seconds before expiry. If `refresh_token` is null (happens when the OAuth `offline` / `prompt=consent` flow was not completed), every call fails until Matt re-authorizes at `/api/google-business-profile/authorize`.

```ts
// Canonical getter — use this, do not re-implement
import { getOrRefreshGoogleBusinessProfileAccessToken } from '@/lib/google-business-profile'

const accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()
```

### Env vars

| Variable | Format | Vercel status |
|---|---|---|
| `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` | Numerical account ID OR `accounts/{account_id}` | Production + Development (added 2026-05-13). Preview not yet populated. |
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` | Numerical location ID OR `locations/{location_id}` | Production + Development (added 2026-05-13). Preview not yet populated. |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_ID` | GCP OAuth client ID | Falls back to `GOOGLE_OAUTH_CLIENT_ID` |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET` | GCP OAuth client secret | Falls back to `GOOGLE_OAUTH_CLIENT_SECRET` |
| `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI` | OAuth redirect URI | Must match GCP Console registration |

The `getGoogleEnv()` helper in `lib/google-business-profile.ts` reads all five and throws a descriptive error if any are missing.

### OAuth flow entry points

| Route | Purpose |
|---|---|
| `GET /api/google-business-profile/authorize` | Generates the authorization URL; Matt clicks to grant access |
| `GET /api/google-business-profile/callback` | Receives the code, exchanges for token, persists to Supabase |
| `GET /api/google-business-profile/test` | Smoke-test: attempts a token fetch + accounts list; verifies wiring |

---

## Endpoint patterns

### Performance API — daily metrics time series

Endpoint:
```
GET https://businessprofileperformance.googleapis.com/v1/{locationName}:getDailyMetricsTimeSeries
```

Where `{locationName}` = `locations/{locationId}`. The implementation in `lib/google-business-profile.ts` prepends `locations/` if the env var does not already include it.

**One call per metric** — the endpoint is metric-scoped. To fetch 9 metrics across a 90-day window, make 9 sequential calls. At Ryan Realty's scale (1 location, 9 metrics, daily cron), this is 9 requests per run, trivially under the 5,000 request/project/day quota.

### Date format — the critical gotcha

The Performance API does **not** accept ISO date strings. `startDate=2026-04-01` will fail silently or return an error. The dates are passed as separate integer query parameters:

```
dailyRange.start_date.year=2026
dailyRange.start_date.month=4
dailyRange.start_date.day=1
dailyRange.end_date.year=2026
dailyRange.end_date.month=5
dailyRange.end_date.day=13
```

The canonical implementation uses `URLSearchParams` to construct these from an ISO string:

```ts
const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
const params = new URLSearchParams({
  dailyMetric: metric,
  'dailyRange.start_date.year': String(startYear),
  'dailyRange.start_date.month': String(startMonth),
  'dailyRange.start_date.day': String(startDay),
  // ... end date same pattern
})
```

**Never pass an ISO date string directly.** Always decompose to year/month/day integers.

### Response shape

```json
{
  "timeSeries": {
    "datedValues": [
      {
        "date": { "year": 2026, "month": 4, "day": 1 },
        "value": "42"
      }
    ]
  }
}
```

Note: `value` is a **string** in the API response, not a number. Parse with `parseInt(dv.value ?? '0', 10)`. Missing or zero-valued days may be omitted from `datedValues` entirely — treat absent = 0 where needed.

---

## Metric enum (canonical)

These are the `GBPDailyMetric` enum values stored in `lib/google-business-profile.ts`. Use the exact casing shown — the API is case-sensitive.

| API enum | Stored metric name (snake_case in `marketing_channel_daily`) | Applicable to brokerage |
|---|---|---|
| `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` | `business_impressions_desktop_maps` | Yes |
| `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` | `business_impressions_desktop_search` | Yes |
| `BUSINESS_IMPRESSIONS_MOBILE_MAPS` | `business_impressions_mobile_maps` | Yes |
| `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` | `business_impressions_mobile_search` | Yes |
| `CALL_CLICKS` | `call_clicks` | **Yes — locked most-important metric** |
| `WEBSITE_CLICKS` | `website_clicks` | Yes |
| `BUSINESS_DIRECTION_REQUESTS` | `business_direction_requests` | Yes |
| `BUSINESS_CONVERSATIONS` | `business_conversations` | Yes (chat-starts) |
| `BUSINESS_BOOKINGS` | `business_bookings` | Not applicable to brokerage — included to detect if Google ever activates it |
| `BUSINESS_FOOD_ORDERS` | — | Skip — food/restaurant metric |
| `BUSINESS_FOOD_MENU_CLICKS` | — | Skip — food/restaurant metric |

The ingestor at `app/api/cron/marketing-snapshot-gbp/route.ts` filters by `metric in METRIC_NAME_MAP`, so unrecognized enum values are silently dropped rather than crashing the cron.

---

## Locked most-important metric: `call_clicks`

Per the platform playbook locked in `.auto-memory/memory_marketing_brain_decisions.md`:

> GBP `call_clicks` — Cleanest bottom-of-funnel signal; isolates Map Pack ranking issues from profile-trust issues.

**Why this metric:** A Map Pack ranking improvement that does not lift `call_clicks` suggests the listing is appearing but the profile (photos, reviews, description) is not converting. A `call_clicks` drop with stable impressions points to profile-trust erosion rather than a ranking drop. Diagnosing which problem it is requires looking at `call_clicks` separately from impressions.

**Brain behavior:** `diagnose-performance` weights `call_clicks` signals above other GBP metrics when evaluating the `gbp` channel in the weekly cycle. A crash in `call_clicks` triggers a higher-severity opportunity row than a crash in `business_impressions_mobile_maps`.

---

## Publishing GBP posts and photos

The Performance API is read-only. To publish a post or upload a photo to the GBP listing, use the v4 My Business API (a different base URL):

```ts
// Post publishing
import { publishGoogleBusinessLocalPost } from '@/lib/google-business-profile'

await publishGoogleBusinessLocalPost({
  accessToken,
  summary: 'Post text here.',
  mediaUrl: 'https://...', // optional
  callToActionUrl: 'https://ryan-realty.com/...', // optional
})
```

Post endpoint: `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`

Photo upload endpoint: `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/media`

Both use the same `accessToken` from `getOrRefreshGoogleBusinessProfileAccessToken()`. The `ops-reputation` producer calls these via the GBP publisher. The `gbp-media-refresh` cron (`app/api/cron/gbp-media-refresh/route.ts`) uploads active listing photos directly.

**GBP post cadence target:** 2 posts per week (per `generate-briefs.ts` `CADENCE_TARGETS`). Posts are "What's New" type (`topicType: 'STANDARD'`).

### Review stream

Own-review ingestion is not yet wired into `marketing-snapshot-gbp`. Ryan Realty has 23+ first-party reviews. The review endpoint is:

```
GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts/{accountId}/locations/{locationId}/reviews
```

This requires the same `business.manage` scope. The canonical implementation path when built: `lib/marketing-brain/gbp-review-sync.ts` → writes to a future `own_reviews` table. Track via TODO comment in `app/api/cron/marketing-snapshot-gbp/route.ts`.

---

## Cost model

| Item | Cost |
|---|---|
| Performance API calls | **Free** — no per-call charge |
| Daily quota | 5,000 requests per GCP project per day |
| Daily snapshot usage | 9 calls (one per metric) — leaves 4,991 headroom |
| Backfill 90 days | Still 9 calls (multi-day range in a single call per metric) |
| My Business API (post + photo upload) | Free |

There is no metered cost for GBP API usage. The only limit is the GCP quota, which Ryan Realty's volume will never approach.

---

## Invocation pattern

### Daily snapshot (canonical)

The snapshot ingestor in `app/api/cron/marketing-snapshot-gbp/route.ts` is the only production caller of `getGBPDailyMetrics`. It:

1. Authenticates via `getOrRefreshGoogleBusinessProfileAccessToken()`.
2. Calls `getGBPDailyMetrics(startDate, endDate)` — fetches all 9 metrics sequentially.
3. Maps each `(date, metric, value)` point to a `MetricRow` with `channel='gbp'`, `scope='account'`, `scope_id=''`.
4. Upserts to `marketing_channel_daily` via `upsertMetricRows()`.

Default behavior: yesterday only (scheduled at `06:30 UTC` in `vercel.json`). Backfill: pass `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` to the route.

```bash
# Trigger manual backfill (90 days)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-snapshot-gbp\
?startDate=2026-02-13&endDate=2026-05-13"
```

### Reading GBP metrics from Supabase

After ingestion, every GBP metric lives in `marketing_channel_daily` with `channel='gbp'`. Query pattern:

```ts
const { data } = await supabase
  .from('marketing_channel_daily')
  .select('date, metric, value')
  .eq('channel', 'gbp')
  .eq('metric', 'call_clicks')
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: true })
```

Do not call the GBP API to read metrics at brain decision time — read from `marketing_channel_daily`. The snapshot ingestor is the only live-API caller.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` not set | `getGBPDailyMetrics` returns `{ ok: false, error: 'GOOGLE_BUSINESS_PROFILE_LOCATION_ID not configured' }` immediately | Add to Vercel env (Production + Development + Preview) and `.env.local`; verify with `vercel env ls` |
| Token not in Supabase `google_business_profile_auth` | `getOrRefreshGoogleBusinessProfileAccessToken` throws `Google Business Profile token not found in database` | Matt must visit `/api/google-business-profile/authorize`, grant consent, complete the OAuth callback |
| Refresh token is null | Token expires, re-auth fails with `Google refresh token missing; reconnect Google Business Profile` | Re-run the OAuth flow with `prompt=consent` to force a new refresh token; the authorize route sets this by default |
| Service-account credential used instead of user OAuth | 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` or `PERMISSION_DENIED` | GBP does not accept service-account tokens — must use user OAuth with `business.manage` scope. Do not add this account to the GBP `viewer@ryanrealty.iam.gserviceaccount.com` service account. |
| Old Insights API endpoint called | 404 or 410 | Replace with Performance API endpoint. The canonical base is `GOOGLE_GBP_PERFORMANCE_BASE` in `lib/google-business-profile.ts`. |
| ISO date string passed to Performance API | Silent error or malformed response | Decompose to year/month/day integers via `split('-').map(Number)`. |
| GBP listing suspended | API returns empty `datedValues` arrays across all metrics | Check GBP dashboard for suspension notice. Suspend → review → reinstate is a Google-side process. |
| New metric enum from Google | Value not in `METRIC_NAME_MAP` | Silently dropped by the `filter(p => p.metric in METRIC_NAME_MAP)` guard in the cron. Add to the enum and map in `lib/google-business-profile.ts` + `route.ts`. |
| Preview environment missing env vars | Snapshot fails in Vercel preview deployments | `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` and `LOCATION_ID` were added to Production + Development on 2026-05-13 but not Preview. Add if preview-env testing of the ingestor is needed. |
| Partial metric failure | Some metrics succeed; others throw (e.g., 429 during a burst) | `getGBPDailyMetrics` collects per-metric errors but returns partial `points`. The cron upserts whatever succeeded and logs errors in the `IngestorResult.errors` array. Re-run the cron for the affected date range to fill gaps. |

---

## Existing usage

| Path | What it does |
|---|---|
| `lib/google-business-profile.ts` | Canonical implementation — OAuth flow, token storage, Performance API fetcher, post publisher, photo uploader |
| `app/api/cron/marketing-snapshot-gbp/route.ts` | Daily ingestion cron at 06:30 UTC — all 9 metrics → `marketing_channel_daily` |
| `app/api/cron/gbp-media-refresh/route.ts` | Uploads active listing photos from Supabase `listings` to GBP media gallery |
| `app/api/google-business-profile/authorize/route.ts` | OAuth entry point |
| `app/api/google-business-profile/callback/route.ts` | OAuth callback — code exchange + token persist |
| `app/api/google-business-profile/test/route.ts` | Smoke-test — token fetch + accounts list |
| `marketing_brain_skills/producers/ops-reputation/SKILL.md` | Writes GBP "What's New" posts and review responses; uses `publishGoogleBusinessLocalPost` |
| `lib/marketing-brain/audit-website.ts` | Reads `call_clicks` from `marketing_channel_daily` to detect GBP-attributed traffic drops |

---

## Pre-flight checklist (before any new GBP code)

```
[ ] Read lib/google-business-profile.ts before writing any GBP call — the auth, fetcher,
    and publisher are already implemented
[ ] Confirm GOOGLE_BUSINESS_PROFILE_LOCATION_ID and ACCOUNT_ID are set in the target env
[ ] Use getOrRefreshGoogleBusinessProfileAccessToken() — never re-implement token fetch
[ ] Use Performance API base (businessprofileperformance.googleapis.com/v1) for metrics
[ ] Use v4 My Business base (mybusiness.googleapis.com/v4) for posts + photos
[ ] Decompose ISO dates to year/month/day integers for the Performance API
[ ] Read marketing_channel_daily for historical metrics — do not call the API at decision time
[ ] Per-metric error collection: do not abort on first failure; collect and continue
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/google-business-profile.ts` | Canonical implementation — all GBP auth and API functions live here |
| `app/api/cron/marketing-snapshot-gbp/route.ts` | Daily ingestor — entry point for snapshot-channels-gbp |
| `marketing_brain_skills/producers/ops-reputation/SKILL.md` | GBP post authoring + review response producer |
| `marketing_brain_skills/tools_registry/supabase/SKILL.md` | `marketing_channel_daily` table schema + upsert pattern |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Competitor GBP review scraping via `compass/Google-Maps-Reviews-Scraper` |
| `.auto-memory/memory_marketing_brain_decisions.md` §"Per-platform locked metric" | Rationale for `call_clicks` as the GBP north-star signal |
| https://developers.google.com/my-business/reference/performance/rest | Performance API reference (v1) |
| https://developers.google.com/my-business/reference/rest | My Business API reference (v4 — posts, photos, reviews) |
