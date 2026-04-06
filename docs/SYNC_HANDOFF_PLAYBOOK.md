# Sync Handoff Playbook

This is the persistent handoff for future agents and future sessions.

## Single Source of Truth

- Visual dashboard: `/admin/sync`
- Machine-readable snapshot: `node scripts/sync-status-report.mjs --json`
  - Terminal status counts (closed, expired, withdrawn, canceled) must use **`.ilike('StandardStatus', '%Withdrawn%')`** (or equivalent per column). Do **not** chain **`.or('StandardStatus.ilike.%Withdrawn%')`** with **`.eq('history_finalized', true)`** — PostgREST treats `%` inside OR filter strings as percent-encoding, which produced bogus withdrawn finalized counts (0) until fixed.
  - `yearsFinalization` uses **`listing_year_on_market_finalization_stats`** when the view exists (OnMarketDate calendar year, same scope as year-by-year sync), plus job fields (`processedListings`, `listingsFinalizedThisPass`) from the matrix cache
  - `listingYearsBreakdown` is **`coalesce(ListDate, OnMarketDate)`** cohorts (can differ from OnMarketDate-only when those dates fall in different years)
  - `listingYearsOnMarketBreakdown` is the full OnMarketDate-only table (newest first), for parity checks against the year sync job
- Runtime cursors in DB:
  - `sync_cursor` (fresh/full lane state)
  - `sync_year_cursor` (year backfill lane state)
  - `sync_state.year_sync_matrix_cache` (year matrix cache and progress)

## Finalization Definitions

- `history_finalized = true`
  - Listing is operationally finalized for history workflows.
  - May come from fast DB-path finalization when history rows already exist.

- `history_verified_full = true`
  - Strict Spark-verified full history pass completed.
  - Set only when history endpoints succeeded with pagination-safe retrieval.

- `history_finalized = true AND history_verified_full = false`
  - Finalized quickly, still eligible for stricter verification later.

## Core Commands

Use production URL and cron auth:

```bash
export BASE_URL="https://ryan-realty.com"
export AUTH_HEADER="Authorization: Bearer $CRON_SECRET"
```

### 1) Freshness lane

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-delta"
```

### 0) Start or restart all sync lanes (recommended recovery command)

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/start-sync"
```

Optional targeted year kick:

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/start-sync?year=2025"
```

### 2) Parity chunk lane (recommended default trigger)

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-parity"
```

### 3) Year backfill lane (newest down to oldest by default)

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-year-by-year"
```

Target a specific year:

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-year-by-year?year=2025"
```

### 4) Terminal backfill lane

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-history-terminal?limit=200"
```

### 5) Strict re-verify finalized-but-unverified listings

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-verify-full-history?limit=200"
```

Year-targeted strict verify:

```bash
curl -H "$AUTH_HEADER" "$BASE_URL/api/cron/sync-verify-full-history?year=2025&limit=200"
```

## What To Run Based on Status

Run first:

```bash
node scripts/sync-status-report.mjs --json
```

Then decide:

- If `terminal.remaining > 0`: run `sync-parity` (and keep cron running).
- If `historyFinalizedUnverifiedAll > 0`: run `sync-verify-full-history`.
- If `sync_year_cursor.phase` is idle but backlog exists: run `sync-year-by-year`.
- If freshness lag appears: run `sync-delta`.

## Non-Stop Design

This system is intentionally chunked and resumable. It should run in production, not local dev:

- Frequent cron invocations
- DB cursors for resume-after-failure
- No dependency on a single long-lived local process

## Required Agent Routine (Future Sessions)

When user asks "what is sync status":

1. Run `node scripts/sync-status-report.mjs --json`
2. Summarize:
   - total listings
   - total history rows
   - terminal remaining
   - finalized vs strict-verified
   - current cursor phase/year
3. Provide next 2-3 command options from this playbook.

### Plain-language trigger mapping

Treat these as identical to "what is sync status":

- "what's the sync like and what options do I have"
- "research the sync procedures"
- "research sync status and tell me where we're at"
- "what can I do next for sync"
- "give me a sync status"
- "start sync"

Mandatory output shape:

1. **Where we are now**: short status summary with current counts
2. **What this means**: one-line interpretation (on track, stalled, or needs manual kick)
3. **Your options**: 2-3 concrete run commands
4. **Decision prompt**: ask user to pick one option and execute it immediately

For the exact prompt "give me a sync status", expand to include:

1. Current totals and terminal breakdown
2. Current lane/cursor state and whether jobs are actively moving
3. Last run activity (recent year log entries and latest lane checkpoints)
4. ETA to parity with explicit assumptions
5. Action options (2-3 commands)

For "start sync", do this immediately:

1. Run `/api/cron/start-sync` with cron auth
2. Confirm blocker flags are cleared (`paused=false`, `abort_requested=false`, `cron_enabled=true`)
3. Confirm lane kick results (`fullChunk`, `terminalChunk`, `deltaChunk`, `yearChunk`)
4. Return a concise "running now" confirmation with current cursor timestamps

## ETA Method (Required in detailed status)

Use two recent snapshots to estimate throughput, then calculate a rough ETA:

- Throughput per minute = `(terminal_finalized_now - terminal_finalized_prev) / minutes_elapsed`
- Remaining minutes = `terminal_remaining_now / max(throughput_per_minute, 1)`
- Convert to hours/days and clearly label as an approximation.

If no previous snapshot exists, take a second snapshot after a short interval and then compute ETA.
