# Spark Replication — Current State vs Spec & Roadmap

This doc maps the **current RyanRealty sync** to the full [SPARK_SUPABASE_REPLICATION_SPEC.md](./SPARK_SUPABASE_REPLICATION_SPEC.md) and outlines a phased path to get there.

---

## Current State (as of this doc)

### What exists today

| Area | Current implementation | Spec target |
|------|------------------------|-------------|
| **Listings core** | Single source: `GET /v1/listings` with pagination; expand=Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents. Stored in `listings` with `details` JSONB. | Plus `/my/listings`, `/office/listings`, `/company/listings`, `/listings/registered`, `/listings/historical` → `listings_historical`. |
| **Listing history** | `listing_history` table (event_date, event, description, price, price_change, raw). Filled from `/v1/listings/{id}/history` then fallback `/historical/pricehistory`. No separate `listing_price_history` table. | `listing_history` (status_from, status_to, event_timestamp) + dedicated `listing_price_history` (price_before, price_after, change_timestamp). |
| **Sub-resources** | Photos, videos, floor plans, documents, open houses, etc. are **embedded in** `listings.details` (from expand). No per-resource tables or `listing_sync_status`. | Each sub-resource: own table or clear structure; `listing_sync_status` booleans per listing. |
| **Historical listings** | Not synced as a full dataset. Only per-listing `/listings/{id}/historical` used for testing / possible future “previously listed” feature. | Full `/v1/listings/historical` pull → `listings_historical` table. |
| **Sync control** | `sync_state` (single row: `last_delta_sync_at`, etc.). `sync_cursor` for full sync page tracking. No `sync_jobs`, no `sync_logs`, no `listing_sync_status`. | `sync_jobs`, `sync_state` (per resource type), `listing_sync_status`, `sync_logs`. |
| **Sync strategy** | Full sync (listings pages + history batches); delta sync by `ModificationTimestamp`; `history_finalized` on closed listings. No skiptoken resumption, no per-listing sub-resource tracking. | Phase 1: full initial sync with skiptoken resumption; Phase 2: 10-min incremental, active-only, finalization, sub-resource tracking. |
| **Environment** | Single env (e.g. `.env.local` + Vercel). No `APP_ENV` or staging/production split for sync. | `APP_ENV`; separate Supabase (and optionally Spark) for staging vs production. |
| **Alerts** | None. | Stall, error, recovery; email + Slack; `sync_alerts` deduplication. |
| **Monitoring UI** | Admin → Sync: counts, Full sync (listings + history), History sync, Test listing/historical APIs. No health indicator, no “Sync Now” for incremental, no inaccessible-endpoints list. | Real-time status from `sync_state`/`sync_logs`, health (green/yellow/red), env badge, Sync Now, inaccessible endpoints. |

### Existing tables (relevant to sync)

- `listings` — main listing rows; `details` JSONB; `history_finalized` for closed.
- `listing_history` — event_date, event, description, price, price_change, raw.
- `sync_state` — single row, e.g. `last_delta_sync_at`.
- `sync_cursor` — used by full-sync flow.
- No: `listings_historical`, `listing_price_history`, `sync_jobs`, `sync_logs`, `listing_sync_status`, `sync_alerts`, contacts/saved searches/market stats/schema tables.

### Existing env (sync-related)

- `SPARK_API_KEY`, `SPARK_API_BASE_URL` (optional), `SPARK_AUTH_SCHEME` (optional)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CRON_SECRET` for cron-triggered sync

No `APP_ENV`, no staging/production Supabase split, no alert env vars.

---

## Implemented So Far

- **Spark API reference** — [docs/SPARK_API_REFERENCE.md](./SPARK_API_REFERENCE.md) (condensed from official Spark docs for sync/filter/replication).
- **Replication schema migration** — `supabase/migrations/20250308120000_replication_schema.sql`:
  - `sync_jobs` — resumable initial sync with skiptoken.
  - `sync_state_by_resource` — last sync timestamp per resource type (10-min incremental).
  - `sync_logs` — per API call (endpoint, status, duration, environment).
  - `listing_sync_status` — one row per listing, booleans for each sub-resource.
  - `sync_alerts` — alert deduplication (triggered_at, resolved_at, channels_notified).
  - `listing_price_history` — price_before, price_after, change_timestamp, spark_raw.
  - `listings_historical` — off-market records keyed on ListingKey (same columns as listings where overlapping).
  - `listings.is_finalized` — exclude terminal listings from incremental sync after full sync.

Run `npx supabase db push` to apply. Next: wire sync engine to use these tables and implement skiptoken initial sync.

## Phased Roadmap (suggested)

Implementing the full spec in one go is a large change. A practical order:

1. **Schema & tracking (no new Spark sources yet)**  
   - Add migrations: `sync_jobs`, `sync_logs`, `listing_sync_status`, extend `sync_state` if needed.  
   - Add `listings_historical` and `listing_price_history` tables and any indexes from the spec.  
   - Keep current sync behavior; start writing to `sync_logs` and (where applicable) `sync_jobs` / `listing_sync_status` so future phases can rely on them.

2. **Initial sync engine (resumable, skiptoken)**  
   - Refactor full sync to use `sync_jobs` and skiptoken; ensure one-shot “initial sync” can be resumed after interrupt.  
   - Still only listings + listing history from current endpoints; optionally add `/v1/listings/historical` → `listings_historical` if credentials allow.

3. **Per-listing sub-resource sync**  
   - For each listing, sync history, photos, documents, etc. into the structure the spec wants (or keep details JSONB but align field names).  
   - Populate `listing_sync_status` and enforce “finalization” only when applicable sub-resources are synced.

4. **Smart incremental (10-min) and finalization**  
   - Implement Phase 2: active-only, `ModificationTimestamp` filter, finalization rule, single-cycle-at-a-time.  
   - Add “Sync Now” and wire UI to `sync_state` / `sync_logs` and health (green/yellow/red).

5. **Environment split and alerts**  
   - Introduce `APP_ENV`, staging vs production Supabase (and `.env.example`).  
   - Add stall/error/recovery alerts (email + Slack), `sync_alerts` table, and document env vars.

6. **Expand to full resource list**  
   - Add contacts, saved searches, market statistics, schema/metadata, account, config, etc., as the spec defines.  
   - Each new resource type gets jobs in `sync_jobs`, state in `sync_state`, and logging in `sync_logs`.

7. **Monitoring and 403 handling**  
   - Inaccessible-endpoints section on the sync page (endpoints that returned 403 or empty for current credentials).  
   - README: initial sync, staging→production, resuming failed jobs, adding a new resource type.

---

## Handoff notes

- **Spec:** [docs/SPARK_SUPABASE_REPLICATION_SPEC.md](./SPARK_SUPABASE_REPLICATION_SPEC.md) is the single source of truth for “what to build.”
- **Spark API reference:** The PDF you have (`Spark_API_Reference_AgentOptimized (1).pdf`) should be used to confirm endpoint paths, query params (`_limit`, `_skiptoken`), and response shapes; the spec assumes Spark’s standard patterns.
- **VOW limits:** Current credentials (VOW) may return 400/403 or Code 1500 for history and historical endpoints. The spec’s “403 → log and skip permanently, surface under Inaccessible Endpoints” handles that; initial implementation can focus on endpoints that already work (e.g. main listings) and add others as access is granted.
- **.env.example:** When implementing env config, add a fully documented `.env.example` covering all variables in the spec (Spark, Supabase staging/production, sync, alerts); the spec lists them explicitly.

---

*Last updated to align with SPARK_SUPABASE_REPLICATION_SPEC v1.0.*
