# Spark API Sync System — Comprehensive Audit

**Generated**: 2026-04-02
**Database**: `dwvlophlbvvygjfxcrhm` (ryan-realty-platform, us-west-2)
**Supabase Status**: ACTIVE_HEALTHY, Postgres 17.6

---

## Executive Summary

The sync system ingests MLS listing data from the Spark API (v1 REST + RESO OData) into Supabase. It has two major axes of work: **current listings** (keeping active/pending listings fresh) and **historical backfill** (syncing all historical listings year-by-year with their price/status history and finalizing them).

**Current state as of 2026-04-02:**

| Metric | Value |
|--------|-------|
| Total listings in Supabase | **586,179** |
| Active | 6,451 |
| Pending | 1,660 |
| Active Under Contract | 86 |
| Coming Soon | 47 |
| Closed | 374,341 |
| Expired | 128,072 |
| Canceled | 75,119 |
| Withdrawn | 403 |
| History-finalized (terminal + history synced) | **367,646** |
| Terminal listings still needing history | **210,289** |
| Listing history rows | **2,184,477** |
| Photos in `listing_photos` | **0** |
| Videos in `listing_videos` | **0** |
| Agents in `listing_agents` | **0** |
| Open houses in `open_houses` | **0** |
| Activity events | 1,041 |

**Key findings:**
1. The **full sync cron is stalled** — page 5,391 of 5,863, error: "fetch failed"
2. The **year-by-year history sync is actively running** on year 2012 (6,544 of 18,596 processed)
3. Years 1990-1995 and 2013-2026 are complete; **1996-2012** still need history finalization
4. **Four sub-resource tables are completely empty**: `listing_photos`, `listing_videos`, `listing_agents`, `open_houses` — the v1 sync path doesn't populate them
5. The `listing_sync_status` table (per-listing sub-resource tracking) has **0 rows** — never used
6. `status_history`, `price_history`, `expired_listings` all have **0 rows** — the v1 sync path doesn't write to them

---

## Part 1: Current/Active Listings Sync

### How It Works

There are **two distinct sync paths** for current listings:

**Path A: Full v1 Sync** (`syncSparkListings` in `app/actions/sync-spark.ts`)
- Fetches from Spark v1 REST API: `GET /v1/listings?_pagination=1&_orderby=+OnMarketDate`
- Maps via `sparkListingToSupabaseRow()` — converts v1 JSON to flat row
- Upserts to `listings` table directly using `ListNumber` as unique key
- Processes in chunks of 12 (retries at 5 on timeout)
- **Does NOT write to**: `listing_photos`, `listing_agents`, `status_history`, `price_history`, `properties`, `expired_listings`
- This is the path used by the full sync cron

**Path B: Active/Pending OData Sync** (`runOnePageActivePendingSync` in `app/actions/sync-spark.ts`)
- Fetches from Spark RESO OData: `GET /Reso/OData/Property?$filter=(StandardStatus eq 'Active' or StandardStatus eq 'Pending' or ...)`
- Processes via `processSparkListing()` in `lib/listing-processor.ts` — the full pipeline
- **DOES write to**: `listings`, `listing_photos`, `listing_agents`, `properties`, `status_history`, `price_history`, `expired_listings`
- Uses 16 concurrent workers
- This path is NOT used by any cron — it's manual only via the admin sync heartbeat

**Path C: Delta Sync** (`syncSparkListingsDelta` in `app/actions/sync-spark.ts`)
- Fetches listings modified since `last_delta_sync_at`
- Uses v1 API with `ModificationTimestamp Gt <ISO>` filter
- Upserts to `listings` via `sparkListingToSupabaseRow()` (same as Path A)
- **Additionally**: emits `activity_events` (new_listing, price_drop, status_pending, status_closed)
- **Additionally**: fetches and upserts `listing_history` for each delta listing
- Finalizes terminal listings that get history
- Cron: `/api/cron/sync-delta` — **daily at 8:00 AM UTC**

### Current State

**Full sync cursor** (`sync_cursor`, id='default'):
```
phase:               listings
next_listing_page:   5,391  (of 5,863 total pages)
run_listings_upserted: 538,976
run_history_rows:    0
paused:              false
abort_requested:     false
cron_enabled:        true
error:               "Sync failed: fetch failed"
updated_at:          2026-04-02 12:42:06 UTC
run_started_at:      null
```

**Diagnosis**: The full sync is **stalled at 92% completion** (page 5,391/5,863). It failed with a network error ("fetch failed") and `run_started_at` is null, meaning no active run is in progress. The cron is enabled and not paused, so it *should* retry on the next cron invocation, but the cron only runs **weekly on Sundays at 2:00 AM** — so it won't self-heal until then unless manually triggered.

**Last successful syncs** (`sync_state`):
```
last_delta_sync_at:  2026-04-02 08:43:26 UTC  (today, ~6 hours ago)
last_full_sync_at:   2026-04-02 00:38:03 UTC  (today, ~14 hours ago)
```

**Delta sync** is running daily and healthy. The most recent checkpoint (March 31) processed 250 records: 32 new listings created, 14 closed, ~204 updated.

### Cron Schedule (from `vercel.json`)

| Cron | Schedule | Frequency |
|------|----------|-----------|
| `/api/cron/sync-delta` | `0 8 * * *` | Daily 8:00 AM UTC |
| `/api/cron/sync-full` | `0 2 * * 0` | Weekly Sunday 2:00 AM UTC |
| `/api/cron/sync-year-by-year` | Not in vercel.json | Manual only |
| `/api/cron/sync-history-terminal` | Not in vercel.json | Manual only |

**Issue**: The full sync runs only once per week. Given the "fetch failed" error, it will stay stalled until Sunday unless manually resumed. The `NEXT_SESSION_BRIEF` recommends increasing frequency to daily minimum.

---

## Part 2: Historical Year-by-Year Sync

### How It Works

The year sync engine lives in `app/api/admin/sync/_shared/run-year-sync.ts`. It processes one year at a time through two phases:

**Phase 1 — Listings**: Fetches all listings from Spark with `OnMarketDate` in the target year range (`YYYY-01-01` to `YYYY+1-01-01`). Compares Spark count vs Supabase count — skips if they match. Otherwise downloads and upserts all pages (500 per page, chunks of 250).

**Phase 2 — History**: For each listing in the year, fetches Spark history (`/v1/listings/{key}/history`, falling back to `/v1/listings/{key}/historical/pricehistory`). Deletes existing history rows in the year range, inserts new ones. Then finalizes:
- **Past years** (year < current): Always finalize → `history_finalized = true, is_finalized = true`
- **Current year + terminal status + had successful fetch**: Finalize
- **Active/Pending**: Never finalize

### Current State — Year-by-Year Matrix

The `year_sync_matrix_cache` in `sync_state` tracks every year from 1990-2026. Here's the status:

| Year | Spark | Supabase | Finalized | Status | Notes |
|------|-------|----------|-----------|--------|-------|
| 1990 | 1 | 1 | 1 | ✅ Complete | |
| 1991 | 30 | 30 | 30 | ✅ Complete | |
| 1992 | 14 | 14 | 14 | ✅ Complete | |
| 1993 | 137 | 137 | 137 | ✅ Complete | |
| 1994 | 182 | 182 | 182 | ✅ Complete | |
| 1995 | 1,218 | 1,218 | 1,218 | ✅ Complete | |
| **1996** | **6,744** | **6,744** | **1,560** | ⚠️ **Idle — history incomplete** | 5,184 remaining. Was syncing history, went idle. |
| **1997** | **10,775** | **10,775** | **2,694** | ❌ **Never started history** | 8,081 remaining. Listings match, needs history phase. |
| **1998** | **11,739** | **11,739** | **326** | ❌ **Never started history** | 11,413 remaining |
| **1999** | **11,315** | **11,315** | **131** | ❌ **Never started history** | 11,184 remaining |
| **2000** | **11,971** | **11,971** | **2,653** | ❌ **Never started history** | 9,318 remaining |
| **2001** | **12,594** | **12,594** | **3,829** | ❌ **Never started history** | 8,765 remaining |
| **2002** | **16,744** | **16,744** | **6,372** | ❌ **Never started history** | 10,372 remaining |
| **2003** | **16,626** | **16,626** | **7,229** | ❌ **Never started history** | 9,397 remaining |
| **2004** | **22,537** | **22,537** | **8,201** | ❌ **Never started history** | 14,336 remaining |
| **2005** | **24,912** | **24,912** | **8,084** | ❌ **Never started history** | 16,828 remaining |
| **2006** | **26,764** | **26,764** | **4,940** | ❌ **Never started history** | 21,824 remaining |
| **2007** | **26,278** | **26,278** | **1,767** | ❌ **Never started history** | 24,511 remaining |
| **2008** | **23,251** | **23,251** | **845** | ❌ **Never started history** | 22,406 remaining |
| **2009** | **19,864** | **19,864** | **833** | ❌ **Never started history** | 19,031 remaining |
| **2010** | **21,000** | **21,000** | **829** | ❌ **Never started history** | 20,171 remaining |
| **2011** | **18,915** | **18,915** | **898** | ❌ **Never started history** | 18,017 remaining |
| **2012** | **18,596** | **18,596** | **6,544** | 🔄 **RUNNING — history phase** | 12,052 remaining. Active right now. |
| 2013 | 20,164 | 20,164 | 20,164 | ✅ Complete | Finished 2026-04-02 |
| 2014 | 24,986 | 24,986 | 24,986 | ✅ Complete | Finished 2026-04-01 |
| 2015 | 22,078 | 22,078 | 22,078 | ✅ Complete | |
| 2016 | 22,094 | 22,094 | 22,094 | ✅ Complete | |
| 2017 | 22,914 | 22,914 | 22,914 | ✅ Complete | |
| 2018 | 22,929 | 22,929 | 22,929 | ✅ Complete | |
| 2019 | 22,387 | 22,387 | 22,387 | ✅ Complete | |
| 2020 | 21,674 | 21,674 | 21,674 | ✅ Complete | |
| 2021 | 22,567 | 22,567 | 22,565 | ✅ Complete | 2 listings not finalized (likely active/pending) |
| 2022 | 20,243 | 20,243 | 20,243 | ✅ Complete | |
| 2023 | 17,452 | 17,452 | 17,452 | ✅ Complete | |
| 2024 | 18,582 | 18,582 | 18,582 | ✅ Complete | Note: Only 1,811 explicitly finalized by year sync; rest from delta |
| 2025 | 19,999 | 20,001 | 20,001 | ⚠️ Idle | Cancel was requested. History phase ran 0 inserts. Marked complete in cache but `cancelRequested: true`. Supabase has 2 more than Spark. |
| 2026 | 5,929 | 5,876 | 1,175 | ✅ Complete (partial) | 53 fewer in Supabase than Spark (new listings since sync). 1,122 finalized. |

### Year Sync Cursor

```
current_year:        2012
phase:               history
next_history_offset: 6,544
total_listings:      18,596
updated_at:          2026-04-02 14:58:18 UTC  (actively running)
```

**The year sync is currently working on 2012's history phase, with 6,544 of 18,596 listings processed (35%).** It was last updated minutes ago, so it's actively running.

### What's Left

**Years needing history completion** (1996-2012):

| Year | Total Listings | Already Finalized | Remaining |
|------|---------------|-------------------|-----------|
| 1996 | 6,744 | 1,560 | 5,184 |
| 1997 | 10,775 | 2,694 | 8,081 |
| 1998 | 11,739 | 326 | 11,413 |
| 1999 | 11,315 | 131 | 11,184 |
| 2000 | 11,971 | 2,653 | 9,318 |
| 2001 | 12,594 | 3,829 | 8,765 |
| 2002 | 16,744 | 6,372 | 10,372 |
| 2003 | 16,626 | 7,229 | 9,397 |
| 2004 | 22,537 | 8,201 | 14,336 |
| 2005 | 24,912 | 8,084 | 16,828 |
| 2006 | 26,764 | 4,940 | 21,824 |
| 2007 | 26,278 | 1,767 | 24,511 |
| 2008 | 23,251 | 845 | 22,406 |
| 2009 | 19,864 | 833 | 19,031 |
| 2010 | 21,000 | 829 | 20,171 |
| 2011 | 18,915 | 898 | 18,017 |
| 2012 | 18,596 | 6,544 | 12,052 |
| **TOTAL** | **300,625** | **57,735** | **242,890** |

Some of the "Already Finalized" counts for years that haven't run year-sync yet (1997-2011) came from the delta sync or the terminal-history cron, not the year-sync engine. These listings had their history fetched through other paths and were correctly finalized.

**Estimated time to completion**: Based on 2013 (20,164 listings, completed in ~12 hours), at ~1,700 listings/hour, the remaining 242,890 listings would take roughly **143 hours (~6 days)** of continuous processing.

---

## Part 3: Listing Data Completeness Pipeline

### What Gets Synced Per Listing

| Sub-Resource | Table | Populated By | Current Row Count |
|-------------|-------|-------------|-------------------|
| Listing data | `listings` | v1 sync, OData sync, delta sync, year sync | 586,179 |
| Listing history (Spark events) | `listing_history` | delta sync, year sync, terminal-history cron | 2,184,477 |
| Photos | `listing_photos` | OData sync only (`processSparkListing`) | **0** |
| Videos | `listing_videos` | `syncListingVideosForRows` (extracts from details JSON) | **0** |
| Agents | `listing_agents` | OData sync only (`processSparkListing`) | **0** |
| Open houses | `open_houses` | OData sync only (from Spark `$expand=OpenHouse`) | **0** |
| Properties (deduplicated) | `properties` | OData sync only (`ensureProperty`) | 7,251 |
| Status changes | `status_history` | OData sync only (`processSparkListing`) | **0** |
| Price changes | `price_history` | OData sync only (`processSparkListing`) | **0** |
| Expired listings | `expired_listings` | OData sync only | **0** |
| Photo classifications | `listing_photo_classifications` | Separate AI pipeline (not sync) | **0** |
| Activity events | `activity_events` | Delta sync only | 1,041 |
| Listing sync status | `listing_sync_status` | Never populated | **0** |

### The Root Cause: Two Sync Paths, Different Outputs

This is the single biggest issue in the sync system. There are two fundamentally different data paths:

**Path A (v1 sync — what the crons use):**
- `sparkListingToSupabaseRow()` converts Spark v1 JSON to a flat `listings` row
- Upserts directly to `listings` using `ListNumber` as the unique key
- Produces: listing data only (with `PhotoURL` from first photo, `ListAgentName` from agent fields, `OpenHouses` as JSONB)
- Does NOT normalize into sub-tables

**Path B (OData sync — manual only):**
- `processSparkListing()` in `listing-processor.ts` does the full normalization
- Creates/updates `properties`, `listing_photos`, `listing_agents`, `status_history`, `price_history`, `expired_listings`
- Uses `listing_key` as the unique constraint (not `ListNumber`)
- This is the "correct" pipeline but it only runs via the admin heartbeat endpoint

**Consequence**: The crons run Path A, so the normalized sub-resource tables (`listing_photos`, `listing_agents`, etc.) are never populated. The 7,251 `properties` rows came from the few times Path B was manually triggered.

### Photos: Where They Actually Live

Photos are NOT in the `listing_photos` table. Instead, they're embedded in the listing row:
- `"PhotoURL"` column: URL of the first/hero photo (from v1 sync)
- `details` JSONB column: Contains `Photos` array with all photo URLs and metadata

The `listing_photos` table exists and has the right schema, but Path A never writes to it. The application renders photos from `details.Photos` and `"PhotoURL"`.

### Videos: Same Story

Videos are in `details` JSONB (under `Videos` array or `VirtualTourURL` fields). The `listing_videos` table exists but has 0 rows. The function `syncListingVideosForRows` exists to extract video URLs from details and insert to `listing_videos`, but it's not called by the v1 sync path.

### Agents: Agent Data Lives on the Listing Row

Agent data is stored as flat columns on the `listings` table: `"ListAgentName"`, `"ListOfficeName"`. The `listing_agents` table (which has proper `agent_role`, `agent_mls_id`, `agent_email`, etc.) has 0 rows because the v1 sync writes agent info directly to the listing row rather than normalizing it.

---

## Part 4: Finalization Logic

### How Finalization Works

A listing is considered "finalized" when it's in a terminal status AND its history has been fully synced. Two boolean flags track this:

- `history_finalized` (boolean, default false) — Set to `true` when history sync completes for a terminal listing
- `is_finalized` (boolean, default false) — Set alongside `history_finalized` for backward compatibility

Both are always set together. The index `idx_listings_history_finalized` (partial: `WHERE history_finalized = false`) is used to find listings that still need history work.

### When Finalization Happens

**In the year sync** (`run-year-sync.ts`):
```
if (isPastYear) → finalize unconditionally
if (isCurrentYear && hadSuccessfulFetch && isTerminalStatus) → finalize
if (isActive || isPending) → never finalize
```

**In the delta sync** (`sync-spark.ts`):
```
After fetching history for a delta listing:
if (StandardStatus matches closed/expired/withdrawn/canceled) → finalize
```

**In the terminal-history cron** (`sync-history-terminal/route.ts`):
```
Same logic as delta: fetch history, finalize terminal listings
```

### Current Finalization State

| Status | Total | Finalized | Remaining | % Done |
|--------|-------|-----------|-----------|--------|
| Closed | 374,341 | 249,146 | 125,195 | 66.6% |
| Expired | 128,072 | 75,797 | 52,275 | 59.2% |
| Canceled | 75,119 | 42,300 | 32,819 | 56.3% |
| Withdrawn | 403 | 403 | 0 | 100% |
| **Total terminal** | **577,935** | **367,646** | **210,289** | **63.6%** |

**367,646 of 577,935 terminal listings are finalized (63.6%).** The remaining 210,289 correspond to the years 1996-2012 that haven't completed their history sync yet.

### The `listing_sync_status` Table (Unused)

Migration `20250308120000_replication_schema.sql` created a `listing_sync_status` table designed for per-listing sub-resource tracking (photos_synced, documents_synced, history_synced, videos_synced, etc.). This was intended as a more granular finalization system.

**This table has 0 rows.** No code ever writes to it. The simpler `history_finalized` / `is_finalized` flags on the `listings` table are what's actually used. The `listing_sync_status` table is dead infrastructure.

### The `media_finalized` Flag (Partially Used)

The `listings` table also has a `media_finalized` boolean flag (added in migration `20250305110000`). This is set to `true` by `sparkListingToSupabaseRow()` when a listing is closed — but it's set based on status, not on actual media verification. It's not checked anywhere in the codebase as a gate condition.

---

## Part 5: Overall Sync Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPARK API                                 │
│  v1 REST: /v1/listings, /v1/listings/{key}/history              │
│  OData:   /Reso/OData/Property?$expand=Media                   │
└──────────────┬──────────────────────┬───────────────────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌───────▼────────────────┐
    │  Path A: v1 Sync    │  │  Path B: OData Sync    │
    │  sparkListingTo     │  │  processSparkListing    │
    │  SupabaseRow()      │  │  (listing-processor.ts) │
    └──────────┬──────────┘  └───────┬────────────────┘
               │                      │
               ▼                      ▼
    ┌────────────────┐    ┌─────────────────────────────┐
    │  listings      │    │  listings                    │
    │  (flat row)    │    │  + properties                │
    │                │    │  + listing_photos             │
    │                │    │  + listing_agents             │
    │                │    │  + status_history             │
    │                │    │  + price_history              │
    │                │    │  + expired_listings           │
    └────────────────┘    └─────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │              HISTORY SYNC (separate)                  │
    │  fetchSparkListingHistory / fetchSparkPriceHistory   │
    │  → listing_history + finalization flags              │
    └─────────────────────────────────────────────────────┘
```

### API Routes

| Route | Method | Auth | Purpose | Status |
|-------|--------|------|---------|--------|
| `/api/cron/sync-full` | GET | CRON_SECRET | Chunked full sync (v1 path) | **Stalled at page 5391/5863** |
| `/api/cron/sync-delta` | GET | CRON_SECRET | Delta sync since last run | ✅ Healthy, last ran today |
| `/api/cron/sync-year-by-year` | GET | CRON_SECRET | Chunked year sync | 🔄 Running (year 2012) |
| `/api/cron/sync-history-terminal` | GET | CRON_SECRET | Terminal history with sharding | Idle, last ran Apr 1 |
| `/api/sync-spark` | GET/POST | CRON_SECRET | Simple full sync trigger | Available |
| `/api/admin/sync` | POST | super_admin | Trigger Inngest full sync | Available |
| `/api/admin/sync/status` | GET | admin | Get latest checkpoint | Available |
| `/api/admin/sync/delta` | POST | super_admin | Trigger Inngest delta sync | Available |
| `/api/admin/sync/live` | GET | admin | Live status + terminal counts | Available |
| `/api/admin/sync/heartbeat` | POST | admin | Resume stalled sync | Available |
| `/api/admin/sync/terminal-control` | POST | admin | Start/stop terminal sync | Available |
| `/api/admin/sync/terminal-scope` | GET/POST | admin | Get/set year scope | Scope: 1990-2026 |
| `/api/admin/sync/sync-year` | POST | admin | Start manual year sync | Available |
| `/api/admin/sync/sync-year/stop` | POST | admin | Cancel running year sync | Available |
| `/api/admin/sync/year-matrix` | GET | admin | Year-by-year matrix view | Available |
| `/api/admin/sync/yearly-breakdown` | GET | admin | Terminal breakdown by year | Cache from Mar 17 |
| `/api/admin/sync/year-sync-log` | GET | admin | Year sync history log | Available |
| `/api/admin/sync-heavy` | GET | admin | Heavy diagnostic queries | Available |

### Database Tables

**State Tracking:**
| Table | Purpose | Rows |
|-------|---------|------|
| `sync_cursor` | Full sync progress (phase, page, offset) | 2 rows (default + terminal-history) |
| `sync_state` | Last sync timestamps, year matrix cache, terminal scope | 1 row |
| `sync_year_cursor` | Current year sync chunk progress | 1 row (year 2012) |
| `year_sync_log` | Completed year sync runs | ~30 rows |
| `sync_checkpoints` | Resumable sync state with OData skiptoken | 1 row (last delta) |
| `sync_history` | Admin dashboard sync run log | ~10 rows |
| `sync_logs` | Per-API-call monitoring | 0 rows |
| `sync_alerts` | Stall/error alert dedup | 0 rows |
| `sync_jobs` | Resumable initial sync jobs | 0 rows |
| `listing_sync_status` | Per-listing sub-resource flags | 0 rows (unused) |
| `sync_state_by_resource` | Per-resource sync timestamps | 0 rows (unused) |

**Data Tables:**
| Table | Purpose | Rows |
|-------|---------|------|
| `listings` | All MLS listings (active + historical) | 586,179 |
| `listing_history` | Price/status events from Spark | 2,184,477 |
| `properties` | Deduplicated addresses | 7,251 |
| `listing_photos` | Normalized photos | 0 |
| `listing_videos` | Normalized videos | 0 |
| `listing_agents` | Normalized agents | 0 |
| `open_houses` | Open house events | 0 |
| `status_history` | Status change log | 0 |
| `price_history` | Price change log | 0 |
| `expired_listings` | Terminal listing prospects | 0 |
| `activity_events` | Sync-generated events | 1,041 |

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run-full-sync.mjs` | Loop calling sync-full cron until done |
| `scripts/run-year-sync.mjs` | Loop calling sync-year-by-year until done |
| `scripts/run-sync-loop.mjs` | Simpler sync loop |
| `scripts/run-sync-range.mjs` | Sync a range of years in order |

---

## Part 6: Issues & Recommendations

### Issue 1: Full Sync Stalled (CRITICAL)

The full sync cron is stuck at page 5,391 of 5,863 with error "fetch failed". The cron only runs weekly (Sundays) so it won't self-recover until April 5.

**Fix**: Either manually trigger the heartbeat endpoint to resume, or increase the cron frequency. The `NEXT_SESSION_BRIEF` already recommends daily minimum.

### Issue 2: Sub-Resource Tables Empty (HIGH)

`listing_photos`, `listing_videos`, `listing_agents`, `open_houses`, `status_history`, `price_history`, and `expired_listings` all have 0 rows. This is because the v1 sync path (which all crons use) doesn't populate them — only the OData path does, and it's not hooked up to any cron.

**Options**:
- **Option A**: Switch the full sync cron to use the OData path (`processSparkListing`). This would populate all sub-tables but would be slower (more DB writes per listing).
- **Option B**: Keep v1 for the bulk sync and add a separate backfill job that runs `processSparkListing` for active/pending listings only. This keeps bulk sync fast while normalizing the ~8,000 current listings.
- **Option C**: Accept that photos/agents/videos live in the listing row's `details` JSONB and `PhotoURL`/`ListAgentName` columns. Remove or deprecate the empty sub-tables. The application already reads from these columns, not the sub-tables.

**Recommendation**: Option B for active listings + Option C for historical. Active listings benefit from normalized photos (for hero selection, classification, gallery ordering). Historical listings don't need sub-table normalization.

### Issue 3: Year Sync Progress — 17 Years Still Pending (MEDIUM)

Years 1996-2012 still need history finalization (242,890 listings). Year 2012 is actively processing. At current pace, this will take ~6 days of continuous processing.

The year sync processes years in order by picking the first incomplete year from the cache. After 2012 finishes, it will need to go back for 1996-2011 (which have listings but never had a year sync run start their history phase).

**Note**: 1996 has `runStatus: 'idle'` with `runPhase: 'Syncing history'` — it started but stopped. It has 1,560 of 6,744 finalized. The year sync cursor will need to pick this back up after 2012 completes.

**Note**: 2025 has `cancelRequested: true` — someone manually canceled it. It shows 0 history inserted despite having 20,001 listings. This year may need to be re-run.

### Issue 4: `listing_sync_status` Table Unused (LOW)

The replication schema migration (`20250308120000`) created an elaborate per-listing sub-resource tracking system (`listing_sync_status` with 16 boolean columns). This was never implemented. No code reads or writes this table.

**Recommendation**: Either implement it as the proper finalization gate (listing is only `is_finalized` when ALL applicable sub-resources are synced), or drop the table to reduce confusion.

### Issue 5: Stale Terminal Scope Cache (LOW)

The `terminal_scope_counts_cache` in `sync_state` was last updated on March 17 and shows 0 total terminal listings across all years — which is clearly wrong given 367,646 finalized listings. The cache scope is set to years 2022-2026 with a 5-year lookback, but the counting logic may be filtering out results.

**Recommendation**: Force-refresh the terminal scope cache via the admin UI or API (`/api/admin/sync/yearly-breakdown?force=1`).

### Issue 6: Duplicate Year Sync Log Entries (LOW)

The `year_sync_log` shows duplicate entries for year 2017 (three "completed" rows at nearly the same timestamp: `2026-03-31 17:14:16.255` and `17:14:16.381`). This suggests the year sync ran concurrently for the same year, which shouldn't happen but isn't guarded against at the database level.

**Recommendation**: Add a unique constraint on `(year, completed_at)` or at minimum a check in the sync code to prevent double-runs.

### Issue 7: 2025 Year Sync Anomaly (MEDIUM)

Year 2025 shows: `cancelRequested: true`, `historyInserted: 0`, `listingsFinalized: 0`, `processedListings: 0`, but `finalizedListings: 20,001`. The `finalizedListings` count came from a cache bootstrap (it counted all listings with `history_finalized = true` in that year), not from the year sync itself. Since the year sync was canceled before processing any history, those 20,001 finalizations came from the delta sync over time, not the year sync.

**This means 2025's year-sync never actually ran history.** Any 2025 listings that weren't caught by delta sync may not have complete history.

---

## Part 7: Summary Table

| System | Status | Health |
|--------|--------|--------|
| Delta sync (daily) | Last ran today 08:43 UTC | ✅ Healthy |
| Full sync (weekly) | Stalled at page 5391/5863, error: fetch failed | 🔴 Stalled |
| Year sync (2012) | Actively running, 35% through history phase | 🔄 Running |
| Years 1990-1995 | All complete with history | ✅ Done |
| Years 1996-2011 | Listings synced, history NOT started | ⚠️ Queued |
| Years 2013-2024 | All complete with history | ✅ Done |
| Year 2025 | Listings synced, history CANCELED | ⚠️ Needs re-run |
| Year 2026 | Listings synced, partial history | ✅ Acceptable |
| Photos normalization | 0 rows in listing_photos | 🔴 Not running |
| Videos normalization | 0 rows in listing_videos | 🔴 Not running |
| Agents normalization | 0 rows in listing_agents | 🔴 Not running |
| Open houses | 0 rows in open_houses | 🔴 No data from MLS |
| Finalization | 367,646 / 577,935 terminal (63.6%) | 🟡 In progress |
