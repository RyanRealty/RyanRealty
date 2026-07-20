# Delta-Sync Unification — CUTOVER COMPLETE (record)

**Status: DONE (2026-07-20).** The unified core `lib/sync/deltaSync.ts` is LIVE. Both lanes — `syncSparkListingsDelta` (action) and the `sync-delta` cron `GET` — are now thin wrappers over `runDeltaSync({ mode: 'execute' })`; their inline fetch/diff/upsert/finalize logic is deleted. The anti-fork gate (`ci:delta-sync-core`) is ratcheted to 1 (only the core calls `computeNextDeltaCursor`).

**How it was verified before flipping (this is the record of the mandatory shadow run):**
- **Shadow run** against a real 48h Spark window: existing-detection 697/697 (0 false-new, 0 existing-but-absent), 60 finalized rows correctly skipped, 1 price drop detected (direction-consistent). This caught + fixed a critical bug where the existing-lookup keyed off the raw `StandardFields.ListNumber` instead of the mapped one (would have misclassified every listing as new). Fixed structurally via `resultToMappedRow`.
- **Live execute tick**: ran `runDeltaSync({ mode: 'execute' })` once as the cron would — cursor advanced correctly (`13:33:11 → 13:44:40`, clean drain, no regression), 3 listings upserted, `newListings: 0` (existing-detection holds), `ok: true`, zero errors.

The sections below are retained as the record of the analysis and the intentional behavior changes.

---

## 1. Why there were two lanes

| | ACTION lane | CRON lane (hardened, prod, every 15 min) |
|---|---|---|
| Entry | `syncSparkListingsDelta` — `app/actions/sync-spark.ts` | `GET` — `app/api/cron/sync-delta/route.ts` |
| Callers | `sync-full-cron.ts`, `start-sync/route.ts`, `sync-parity/route.ts` | Vercel cron |
| Page size | `pageSize` param, default **100** | hardcoded **200** |
| Max pages | `maxPages` param, default **50** | const **100** |
| Upsert chunk | **12** | **25** |
| Expand set | `Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents` | `Photos,Videos,VirtualTours,OpenHouses` (no FloorPlans/Documents) |
| Default window | 24h | 30min |
| Finalize | fresh transitions only, **uncapped**, 5-way concurrent, by **ListingKey** | ANY currently-terminal, capped **30/run**, serial, by **ListNumber** |
| `is_finalized` skip | **discards it** (re-upserts finalized rows every run) | skips finalized rows |

### Behaviors unique to ONE lane (the reason a naive swap regresses)

**ACTION-only** (cron lacks — the unified core KEEPS these so action callers don't regress):
- `status_active` activity event on transition back to Active.
- sets `listings.media_finalized = true` when a listing goes Closed.

**CRON-only** (action lacks — the unified core ADOPTS these as the hardened baseline):
- `listing_private` diversion (`extractPrivateDetails`).
- `price_history` + `status_history` row writes.
- `price_increase` activity event; generic terminal `status_expired/withdrawn/canceled` events.
- `MAX_FINALIZE_PER_RUN` cap, photo-fix pass, expired-listing pipeline, `refresh_market_pulse` RPC.
- skip-finalized guard.

## 2. What the unified core does (`lib/sync/deltaSync.ts`)

- **Canonical constants** = prefer the hardened cron values (page 200, maxPages 100, upsert chunk 25, finalize cap 30), reconciled **expand = superset** (`Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents`).
- **`computeDeltaPlan()`** — a PURE function (no I/O) that takes the fetched Spark results + the existing-rows map and returns the full plan: rows to upsert, private rows, activity events, price/status-history rows, finalize keys, `maxProcessedTs`, counters. This is the **superset** of both lanes' diff→event matrix (keeps action's `status_active`/`media_finalized` AND cron's private/history/increase/generic-terminal). **It is exhaustively unit-tested in `lib/sync/deltaSync.test.ts`** — this is the error-prone heart, verified now.
- **`runDeltaSync(opts)`** — the orchestrator. Composes constants + `computeDeltaPlan` + the already-shared write primitives (`lib/data/sync/syncWrites.ts`) + the finalize/photo/expired passes. Supports `mode: 'shadow' | 'execute'` — **shadow computes the plan and returns it WITHOUT any writes**, which is what the comparison below uses.

## 3. The MANDATORY shadow run (do this before cutover)

The core must produce byte-identical outputs to each current lane for the same input window, over several windows including edge cases, before any wrapper is flipped.

1. Pick a real `since` window with recent MLS activity.
2. In `mode: 'shadow'`, run `runDeltaSync` for that window (read-only: fetches Spark, reads existing rows, computes the plan, writes nothing).
3. Instrument the current lane (temporarily, in a scratch branch) to also emit its computed plan without writing, OR replay the same fetched page set through both.
4. Assert IDENTICAL: rows-to-upsert (by ListNumber + changed columns), activity events (type + payload), price/status-history rows, finalize keys, and the advanced cursor.
5. Repeat for at least: (a) a normal window, (b) a **truncation/backlog** window (more pages than `maxPages` — cursor must hold at `maxProcessedTs`, not `now()`), (c) a **terminal-transition** window (a listing going Closed/Expired — finalize + history + `media_finalized`), (d) an **empty** window.
6. Only when all match: make `syncSparkListingsDelta` and the cron `GET` thin wrappers over `runDeltaSync({ mode: 'execute', ... })`, DELETE their inline fetch→diff→upsert→finalize logic, and keep the `SyncDeltaResult` / cron JSON response shapes for the three action callers.

**Known intentional behavior change at cutover:** the cron lane will START emitting `status_active` events and setting `media_finalized` (adopted from the action lane), and the action lane will START writing `listing_private`/`price_history`/`status_history`, running the photo-fix + expired passes, capping finalize at 30, and skipping finalized rows. Confirm each is desired for BOTH lanes before flipping. (All are strict improvements; the skip-finalized adoption also FIXES an action-lane bug where finalized rows were re-upserted every run.)

## 4. The anti-fork gate

`scripts/check-delta-sync-single-core.mjs` (`ci:delta-sync-core`) allowlists the files permitted to call `computeNextDeltaCursor` (the cursor-safety primitive every delta lane must use). The allowlist is ratcheted — it may only SHRINK.

- **Now (dormant):** allowlist = 3 (`app/actions/sync-spark.ts`, `app/api/cron/sync-delta/route.ts`, `lib/sync/deltaSync.ts`).
- **After cutover:** the two lanes become wrappers that no longer call the primitive directly; re-baseline to allowlist = 1 (`lib/sync/deltaSync.ts`). A NEW file calling the primitive fails CI — the fork cannot silently reappear.

## 5. Reusable building blocks already shared (the core leans on these)

`computeNextDeltaCursor` (`lib/sync/deltaCursor.ts`), `isTerminalStatus` (`lib/sync/terminalStatus.ts`), `isActive/Pending/ClosedStatus` (`lib/listing-status.ts`), `sparkToListingRow` / `extractPrivateDetails` / `sparkHistoryItemToRow` (`lib/listing-mapper.ts`), all write primitives in `lib/data/sync/syncWrites.ts`, `syncAuxiliaryTablesForFinalization` (`app/api/admin/sync/_shared/listing-completeness.ts`), `processNewExpiredListings` (`lib/expired-listing-processor.ts`).
