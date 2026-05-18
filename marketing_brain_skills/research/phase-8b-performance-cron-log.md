# Phase 8B: Performance Pull Crons

Date: 2026-05-17
Status: complete (draft, pending Matt commit approval)

## What shipped

Three Vercel cron handlers that pull per-post metrics from platform APIs and
upsert them into `content_performance` at 48h, 7d, and 30d windows after
each executed action.

### Files created

| Path | Lines | Purpose |
|---|---|---|
| `app/api/cron/performance-pull-48h/route.ts` | 136 | 48h window, runs every 6 hours |
| `app/api/cron/performance-pull-7d/route.ts` | 136 | 7d window, runs daily at 13:00 UTC |
| `app/api/cron/performance-pull-30d/route.ts` | 136 | 30d window, runs Sundays at 12:00 UTC |

### Files modified

| Path | Change |
|---|---|
| `lib/meta-graph.ts` | Added `fetchMetaPostMetrics(postId, 'ig'|'fb')` with real IG/FB insights endpoints |
| `lib/linkedin.ts` | Added `fetchLinkedInPostMetrics(postId)` stub (TODO Phase 8B real wiring) |
| `lib/x.ts` | Added `fetchXPostMetrics(postId)` calling GET /2/tweets/:id?tweet.fields=public_metrics |
| `lib/google-business-profile.ts` | Added `fetchGbpPostMetrics(postId)` stub (TODO Phase 8B real wiring) |
| `vercel.json` | Added 3 cron entries. Total: 35 entries (was 32; spec said 31, actual count was 32 before this phase). |

## Verification gate results

| Check | Result |
|---|---|
| vercel.json parses, 35 cron entries | PASS |
| No em/en dashes in handler files | PASS |
| CRON_SECRET auth in all 3 handlers | PASS (line 64 each file) |
| Idempotent upsert with onConflict | PASS (action_id,platform,post_external_id) |
| Token leakage scan | PASS (no raw secrets in code) |
| north_star_attributed_seller_leads default | 0 (stub, see below) |

## Handler pattern

Each handler follows this flow:

1. Validate `Authorization: Bearer ${CRON_SECRET}` header. Return 401 if missing or wrong.
2. Query `marketing_brain_actions` where `status='executed'` and `executed_at`
   falls in [WINDOW-1h, WINDOW+1h]. The 2-hour tolerance handles clock drift
   and Vercel cron jitter.
3. For each action, iterate `executor_response.published_to` (array of
   `{platform, post_id}` pairs written by the publisher at execution time).
4. Call `fetchByPlatform(platform, post_id)` to get live metrics.
5. Catch `platform_skipped:*` errors from unwired platforms and write a
   `performance_skipped: true` sentinel instead of erroring.
6. Upsert into `content_performance` with `onConflict: 'action_id,platform,post_external_id'`.
   The column written differs per file: `metrics_48h`, `metrics_7d`, or `metrics_30d`.

## Platform coverage

| Platform | Status | Notes |
|---|---|---|
| ig | Wired | GET /{media-id}/insights, lifetime period |
| fb | Wired | GET /{post-id}/insights, lifetime period |
| x | Wired | GET /2/tweets/:id?tweet.fields=public_metrics (Basic tier) |
| linkedin | Stub | TODO: wire to /rest/socialActions + /rest/organizationalEntityShareStatistics |
| gbp | Stub | TODO: POST /{name}:reportInsights batch endpoint |
| tt, pinterest, threads, nextdoor | Skipped | OAuth not wired; sentinel row written |

## Seller-lead attribution stub

`north_star_attributed_seller_leads` is written as `0` by default on every
upsert. The follow-up cron (Phase 8C) will:

1. Query `content_performance` rows where `posted_at > now() - interval '30 days'`.
2. For each row, resolve the platform post URL from the action's
   `executor_response.published_to[*].post_url`.
3. Query FUB `/v1/people` for contacts whose `first_source_url` matches that URL.
4. Count matches and UPDATE `north_star_attributed_seller_leads`.

This cron is NOT implemented in Phase 8B. It is documented here so the
intent is not lost.

## Env vars required (add to Vercel project settings if not present)

- `CRON_SECRET` (already required by existing crons)
- `NEXT_PUBLIC_SUPABASE_URL` (already set)
- `SUPABASE_SERVICE_ROLE_KEY` (already set)
- `META_PAGE_ACCESS_TOKEN` (already set for snapshot crons)
- `X_CLIENT_ID`, `X_CLIENT_SECRET` (already set for X publisher)

No new env vars required for the stub platforms (LinkedIn, GBP stubs do not
call external APIs in this phase).
