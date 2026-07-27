/**
 * Unified delta-sync core (LIVE — the single delta-sync implementation).
 *
 * Audit #1b: the delta sync had forked into two lanes with divergent tuning and
 * a partially different diff/event/finalize matrix. Both are now thin wrappers
 * over this core so they can never drift again:
 *   - ACTION lane  app/actions/sync-spark.ts  syncSparkListingsDelta
 *   - CRON lane    app/api/cron/sync-delta/route.ts  GET  (runs every 15 min)
 *
 * `computeDeltaPlan` is the pure decision heart (exhaustively unit-tested).
 * `runDeltaSync({ mode: 'shadow' })` computes the plan read-only; `mode:
 * 'execute'` fetches + persists it. The cutover was verified by a live shadow
 * run against a real Spark window (existing-detection 697/697, skip-finalized,
 * price-change direction) plus a live execute tick (cursor advanced correctly,
 * zero errors) before the wrappers were flipped. See
 * docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md.
 *
 * Canonical behavior = the hardened cron lane's constants + its features
 * (listing_private diversion, price/status history, finalize cap, photo fix,
 * expired pipeline, skip-finalized), UNIONED with the two action-lane behaviors
 * the cron lane lacked (status_active events, media_finalized on close) so no
 * caller regressed. The expand set is the reconciled superset. The anti-fork
 * gate (ci:delta-sync-core) locks computeNextDeltaCursor to this file alone.
 */

import { computeNextDeltaCursor } from '@/lib/sync/deltaCursor'
import { isTerminalStatus } from '@/lib/sync/terminalStatus'
import { isActiveStatus, isPendingStatus, isClosedStatus } from '@/lib/listing-status'
import { sparkToListingRow, extractPrivateDetails, sparkHistoryItemToRow } from '@/lib/listing-mapper'
import {
  fetchSparkListingsPage,
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  type SparkListingHistoryItem,
} from '@/lib/spark'
import {
  getSyncState,
  getExistingListingsByListNumbers,
  upsertListingRows,
  insertPriceHistoryRows,
  insertStatusHistoryRows,
  insertActivityEventRows,
  updateListingPhotoUrl,
  updateSyncStateLastDelta,
  replaceListingHistoryForKey,
} from '@/lib/data/sync/syncWrites'
import { syncAuxiliaryTablesForFinalization } from '@/app/api/admin/sync/_shared/listing-completeness'
import { processNewExpiredListings } from '@/lib/expired-listing-processor'
import { createServiceClient } from '@/lib/supabase/service'

// ── Canonical reconciled constants (prefer the hardened cron lane) ──────────

export const DELTA_SYNC = {
  /** Spark page size. Cron used 200; action used 100. */
  PAGE_SIZE: 200,
  /** Max pages per run. Cron const 100; action default 50. */
  MAX_PAGES: 100,
  /** Upsert chunk. Cron 25; action 12. */
  UPSERT_CHUNK: 25,
  /** Finalizations per run. Cron cap 30; action uncapped. */
  MAX_FINALIZE_PER_RUN: 30,
  /** Photo-fix attempts per run (cron only). */
  MAX_PHOTO_FIXES: 20,
  /** Terminal-history fetch concurrency (action pool size). */
  HISTORY_CONCURRENCY: 5,
  /**
   * Reconciled SUPERSET expand: cron lacked FloorPlans + Documents, action had
   * them. The union loses no media on either path.
   */
  EXPAND: 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents',
  /** Default lookback when there is no stored cursor. Cron 30min (hardened). */
  DEFAULT_WINDOW_MS: 30 * 60 * 1000,
} as const

// ── Shapes ──────────────────────────────────────────────────────────────────

/** The subset of an existing listing row the diff needs (matches
 *  getExistingListingsByListNumbers). Kept local so computeDeltaPlan is pure and
 *  testable without importing the DB layer. */
export type ExistingListingLite = {
  ListNumber: string
  ListingKey: string | null
  StandardStatus: string | null
  ListPrice: number | null
  is_finalized: boolean | null
}

/** A raw Spark delta result as returned by the listings feed. */
export type SparkDeltaResult = { StandardFields?: Record<string, unknown>; Id?: string }

export type ActivityEventRow = {
  listing_key: string
  event_type: string
  payload: Record<string, unknown>
}

export type PriceHistoryRow = {
  listing_key: string
  old_price: number | null
  new_price: number | null
  change_pct: number | null
  changed_at: string
}

export type StatusHistoryRow = {
  listing_key: string
  old_status: string | null
  new_status: string | null
  changed_at: string
}

export type PrivateRow = { listing_key: string; private_data: Record<string, unknown> }

export type FinalizeTarget = {
  listingKey: string
  listNumber: string
  status: string | null
  /** The freshly-mapped listings row, so the finalize pass has source context
   *  without a re-read (mirrors the cron lane's in-memory sourceRow). */
  sourceRow: Record<string, unknown>
}

export type DeltaPlan = {
  rowsToUpsert: Record<string, unknown>[]
  privateRows: PrivateRow[]
  activityEvents: ActivityEventRow[]
  priceHistoryRows: PriceHistoryRow[]
  statusHistoryRows: StatusHistoryRow[]
  finalizeTargets: FinalizeTarget[]
  maxProcessedTs: string | null
  counters: {
    fetched: number
    newListings: number
    priceChanges: number
    statusChanges: number
    skippedFinalized: number
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Map a raw Spark result to the flat listings row. THE single mapping used for
 * both the existing-lookup key derivation and the diff, so the two can never
 * key off different ListNumber sources (a real-data-only divergence a synthetic
 * unit test cannot catch: the raw StandardFields.ListNumber is not the mapped
 * ListNumber). Every ListNumber the core reads flows through here.
 */
export function resultToMappedRow(result: SparkDeltaResult): Record<string, unknown> {
  return sparkToListingRow(result.StandardFields ?? {}, result.Id)
}

// ── The pure decision heart (unit-tested) ────────────────────────────────────

/**
 * Compute the full delta plan for a window of Spark results against the current
 * DB state. Pure — no I/O, no clock read except the injectable `nowIso`. This is
 * the UNION of both lanes' diff→event→finalize matrices:
 *
 *   - skip any row whose existing listing is already finalized (cron)
 *   - new listing -> new_listing event; queue finalize if born terminal
 *   - status change -> status_history row (cron) + one status event:
 *       status_pending / status_closed(+media_finalized) / status_active /
 *       generic status_<terminal> for expired|withdrawn|canceled
 *   - price change -> price_history row w/ change_pct (cron) + price_drop or
 *       price_increase event
 *   - queue finalize for ANY currently-terminal, non-finalized listing (cron)
 *   - divert confidential fields into a private row (cron)
 *
 * status_active + media_finalized are the action-lane behaviors the cron lane
 * lacks; they are preserved here so neither caller regresses at cutover.
 */
export function computeDeltaPlan(
  results: SparkDeltaResult[],
  existingByNum: Map<string, ExistingListingLite>,
  opts: { nowIso?: string } = {},
): DeltaPlan {
  const nowIso = opts.nowIso ?? new Date().toISOString()
  const plan: DeltaPlan = {
    rowsToUpsert: [],
    privateRows: [],
    activityEvents: [],
    priceHistoryRows: [],
    statusHistoryRows: [],
    finalizeTargets: [],
    maxProcessedTs: null,
    counters: { fetched: 0, newListings: 0, priceChanges: 0, statusChanges: 0, skippedFinalized: 0 },
  }
  const queuedFinalize = new Set<string>()

  for (const result of results) {
    plan.counters.fetched++
    const fields = result.StandardFields ?? {}
    const row = resultToMappedRow(result)

    const listNumber = String(row.ListNumber ?? '').trim()
    if (!listNumber) continue // no upsert conflict key -> unpersistable, skip

    const listingKey = String(row.ListingKey ?? listNumber).trim()
    const status = (row.StandardStatus as string | null | undefined) ?? null
    const price = (row.ListPrice as number | null | undefined) ?? null
    const modTs = typeof row.ModificationTimestamp === 'string' ? row.ModificationTimestamp : null
    if (modTs && (!plan.maxProcessedTs || modTs > plan.maxProcessedTs)) plan.maxProcessedTs = modTs

    const existing = existingByNum.get(listNumber)

    // Skip finalized rows entirely — never re-upsert a frozen closed listing.
    if (existing?.is_finalized) {
      plan.counters.skippedFinalized++
      continue
    }

    const priv = extractPrivateDetails(fields)
    if (priv) plan.privateRows.push({ listing_key: listingKey, private_data: priv })

    const nowTerminal = status ? isTerminalStatus(status) : false

    if (!existing) {
      plan.counters.newListings++
      plan.activityEvents.push({
        listing_key: listingKey,
        event_type: 'new_listing',
        payload: {
          ListNumber: listNumber,
          City: row.City ?? null,
          SubdivisionName: row.SubdivisionName ?? null,
          ListPrice: price,
        },
      })
      if (nowTerminal && !queuedFinalize.has(listingKey)) {
        queuedFinalize.add(listingKey)
        plan.finalizeTargets.push({ listingKey, listNumber, status, sourceRow: row })
      }
    } else {
      const oldStatus = existing.StandardStatus
      const oldPrice = existing.ListPrice

      if (oldStatus !== status) {
        plan.counters.statusChanges++
        plan.statusHistoryRows.push({
          listing_key: listingKey,
          old_status: oldStatus,
          new_status: status,
          changed_at: nowIso,
        })
        const wasPending = isPendingStatus(oldStatus)
        const wasClosed = isClosedStatus(oldStatus)
        const wasActive = isActiveStatus(oldStatus)
        const wasTerminal = oldStatus ? isTerminalStatus(oldStatus) : false
        const isPending = isPendingStatus(status)
        const isClosed = isClosedStatus(status)
        const isActive = isActiveStatus(status)

        if (isPending && !wasPending) {
          plan.activityEvents.push({
            listing_key: listingKey,
            event_type: 'status_pending',
            payload: { ListNumber: listNumber, previousStatus: oldStatus },
          })
        } else if (isClosed && !wasClosed) {
          plan.activityEvents.push({
            listing_key: listingKey,
            event_type: 'status_closed',
            payload: { ListNumber: listNumber, previousStatus: oldStatus, ListPrice: price },
          })
          // Action-lane behavior: freeze media once a listing closes.
          row.media_finalized = true
        } else if (isActive && !wasActive) {
          plan.activityEvents.push({
            listing_key: listingKey,
            event_type: 'status_active',
            payload: { ListNumber: listNumber, previousStatus: oldStatus },
          })
        } else if (nowTerminal && !wasTerminal && !isClosed) {
          // Generic terminal (expired / withdrawn / canceled). Closed is handled
          // by the status_closed branch above, so it is excluded here.
          const slug = String(status).toLowerCase().replace(/\s+/g, '_')
          plan.activityEvents.push({
            listing_key: listingKey,
            event_type: `status_${slug}`,
            payload: { ListNumber: listNumber, previousStatus: oldStatus, ListPrice: price },
          })
        }
      }

      if (price != null && oldPrice != null && price !== oldPrice) {
        plan.counters.priceChanges++
        plan.priceHistoryRows.push({
          listing_key: listingKey,
          old_price: oldPrice,
          new_price: price,
          change_pct: oldPrice !== 0 ? round2(((price - oldPrice) / oldPrice) * 100) : null,
          changed_at: nowIso,
        })
        plan.activityEvents.push({
          listing_key: listingKey,
          event_type: price < oldPrice ? 'price_drop' : 'price_increase',
          payload: { ListNumber: listNumber, previous_price: oldPrice, new_price: price },
        })
      }

      // Queue finalize for ANY currently-terminal, non-finalized listing (not
      // just fresh transitions) so a missed terminal on a prior run is caught.
      if (nowTerminal && !queuedFinalize.has(listingKey)) {
        queuedFinalize.add(listingKey)
        plan.finalizeTargets.push({ listingKey, listNumber, status, sourceRow: row })
      }
    }

    plan.rowsToUpsert.push(row)
  }

  return plan
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export type RunDeltaSyncOptions = {
  /** shadow = compute the plan read-only (no writes); execute = fetch + write. */
  mode: 'shadow' | 'execute'
  accessToken?: string
  /** Override the `since` window. Otherwise the stored cursor is used. */
  sinceOverride?: string
  maxPages?: number
  pageSize?: number
  /** Injected clock for deterministic tests. */
  nowIso?: string
}

export type ShadowRunResult = {
  sinceIso: string
  pages: number
  truncated: boolean
  maxProcessedTs: string | null
  /** The cursor the run WOULD advance to (via computeNextDeltaCursor). */
  nextCursor: string | null
  plan: DeltaPlan
}

export type ExpiredStats = { scanned: number; new_processed: number; alert_emails_sent: number; errors: number }

export type ExecuteRunResult = {
  ok: boolean
  partial: boolean
  sinceIso: string
  pages: number
  truncated: boolean
  maxProcessedTs: string | null
  totalFetched: number
  totalUpserted: number
  newListings: number
  priceChanges: number
  statusChanges: number
  eventsEmitted: number
  listingsFinalized: number
  historyRowsInserted: number
  photosFixed: number
  skippedFinalized: number
  expired: ExpiredStats | null
}

/** Read existing rows for a set of ListNumbers, chunked under the DB's 5000-row
 *  input cap, merged into one Map keyed by ListNumber. */
async function loadExistingByNum(listNumbers: string[]): Promise<Map<string, ExistingListingLite>> {
  const map = new Map<string, ExistingListingLite>()
  const unique = [...new Set(listNumbers.filter(Boolean))]
  const CHUNK = 5000
  for (let i = 0; i < unique.length; i += CHUNK) {
    const rows = await getExistingListingsByListNumbers(unique.slice(i, i + CHUNK))
    for (const r of rows) map.set(r.ListNumber, r as ExistingListingLite)
  }
  return map
}

type PlanContext = {
  plan: DeltaPlan
  sinceIso: string
  pagesProcessed: number
  truncated: boolean
  runStartedAt: string
  nowIso: string
  accessToken: string
}

/**
 * Shared fetch + existing-lookup + plan computation. Read-only. Used by both
 * shadow and execute. `since` = sinceOverride, else the stored delta cursor
 * (last_delta_sync_at), else the hardened default window — MUST honor the stored
 * cursor or a behind sync would silently skip the gap.
 */
async function fetchAndPlan(opts: RunDeltaSyncOptions): Promise<PlanContext> {
  const accessToken = (opts.accessToken ?? process.env.SPARK_API_KEY ?? '').trim()
  if (!accessToken) throw new Error('runDeltaSync: SPARK_API_KEY / accessToken required')

  const maxPages = opts.maxPages ?? DELTA_SYNC.MAX_PAGES
  const pageSize = opts.pageSize ?? DELTA_SYNC.PAGE_SIZE
  const nowIso = opts.nowIso ?? new Date().toISOString()

  let sinceIso = opts.sinceOverride
  if (!sinceIso) {
    const state = await getSyncState()
    sinceIso = state?.last_delta_sync_at ?? new Date(Date.now() - DELTA_SYNC.DEFAULT_WINDOW_MS).toISOString()
  }

  const runStartedAt = new Date().toISOString()
  const filter = `ModificationTimestamp Gt ${sinceIso}`

  const results: SparkDeltaResult[] = []
  let page = 1
  let totalPages = 1
  let pagesProcessed = 0
  while (page <= totalPages && pagesProcessed < maxPages) {
    const res = await fetchSparkListingsPage(accessToken, {
      page,
      limit: pageSize,
      filter,
      orderby: '+ModificationTimestamp',
      expand: DELTA_SYNC.EXPAND,
    })
    const pageResults = (res.D?.Results ?? []) as SparkDeltaResult[]
    if (pageResults.length === 0) break
    results.push(...pageResults)
    totalPages = res.D?.Pagination?.TotalPages ?? page
    pagesProcessed++
    page++
  }

  // Derive the existing-lookup keys through resultToMappedRow — the SAME mapping
  // computeDeltaPlan uses for its lookup (see resultToMappedRow).
  const listNumbers = results
    .map((r) => String(resultToMappedRow(r).ListNumber ?? '').trim())
    .filter(Boolean)
  const existingByNum = await loadExistingByNum(listNumbers)

  const plan = computeDeltaPlan(results, existingByNum, { nowIso })
  const truncated = pagesProcessed >= maxPages && page <= totalPages
  return { plan, sinceIso, pagesProcessed, truncated, runStartedAt, nowIso, accessToken }
}

/** Ported from the cron lane: fetch full history (with price-history fallback)
 *  and replace listing_history for the key. */
async function fetchAndInsertHistoryCore(
  accessToken: string,
  listingKey: string,
): Promise<{ inserted: number; ok: boolean; items: SparkListingHistoryItem[] }> {
  let response = await fetchSparkListingHistory(accessToken, listingKey)
  if (response.items.length === 0) {
    const fallback = await fetchSparkPriceHistory(accessToken, listingKey)
    if (fallback.items.length > 0) response = fallback
  }
  const hadSuccessfulFetch = response.ok && response.partial !== true
  if (response.items.length > 0) {
    const rows = response.items.map((item) => sparkHistoryItemToRow(listingKey, item))
    const result = await replaceListingHistoryForKey(listingKey, rows)
    if (!result.ok) {
      console.error(`[deltaSync] listing_history replace error for ${listingKey}.`, result.error)
      return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
    }
    return { inserted: result.inserted, ok: hadSuccessfulFetch, items: response.items }
  }
  return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
}

/** Ported from the cron lane: single-listing photo fetch for the photo-fix pass. */
async function fetchPhotoForListingCore(accessToken: string, listingKey: string): Promise<string | null> {
  const baseUrl = (process.env.SPARK_API_BASE_URL ?? 'https://replication.sparkapi.com/v1').replace(/\/$/, '')
  try {
    const res = await fetch(`${baseUrl}/listings/${listingKey}?_expand=Photos`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = await res.json()
    const f = body?.D?.Results?.[0]?.StandardFields ?? {}
    const photos = (f.Photos ?? []) as Array<Record<string, unknown>>
    const first = photos.find((p) => p.Primary) ?? photos[0]
    return (first?.Uri1600 ?? first?.Uri1280 ?? first?.Uri1024 ?? first?.Uri800 ?? first?.Uri640 ?? first?.Uri300 ?? null) as string | null
  } catch {
    return null
  }
}

/**
 * Run the unified delta sync. `mode: 'shadow'` fetches the window and computes
 * the plan read-only (NO writes) — the compute-and-compare basis. `mode:
 * 'execute'` fetches + persists the plan (upserts, private diversion, price/
 * status history, activity events, capped finalization with history+aux, photo
 * fix, market-pulse refresh, expired pipeline) and advances the cursor. Both the
 * action lane and the cron lane are thin wrappers over this.
 */
export async function runDeltaSync(opts: RunDeltaSyncOptions & { mode: 'shadow' }): Promise<ShadowRunResult>
export async function runDeltaSync(opts: RunDeltaSyncOptions & { mode: 'execute' }): Promise<ExecuteRunResult>
export async function runDeltaSync(opts: RunDeltaSyncOptions): Promise<ShadowRunResult | ExecuteRunResult> {
  const ctx = await fetchAndPlan(opts)
  const { plan, sinceIso, pagesProcessed, truncated, runStartedAt, nowIso, accessToken } = ctx

  if (opts.mode === 'shadow') {
    const nextCursor = computeNextDeltaCursor({ upsertFailed: false, truncated, runStartedAt, maxProcessedTs: plan.maxProcessedTs })
    return { sinceIso, pages: pagesProcessed, truncated, maxProcessedTs: plan.maxProcessedTs, nextCursor, plan }
  }

  // === execute: persist the plan (order mirrors the hardened cron lane) ===
  const sb = createServiceClient()
  let upsertFailed = false
  let totalUpserted = 0
  let historyRowsInserted = 0
  let photosFixed = 0
  let listingsFinalized = 0

  // 1. Upsert listings (chunked).
  for (let i = 0; i < plan.rowsToUpsert.length; i += DELTA_SYNC.UPSERT_CHUNK) {
    const chunk = plan.rowsToUpsert.slice(i, i + DELTA_SYNC.UPSERT_CHUNK)
    const r = await upsertListingRows(chunk)
    if (r.ok) totalUpserted += chunk.length
    else { upsertFailed = true; console.error('[deltaSync] upsert error.', r.error) }
  }

  // 1b. Divert confidential keys to listing_private (best-effort).
  for (let i = 0; i < plan.privateRows.length; i += DELTA_SYNC.UPSERT_CHUNK) {
    const chunk = plan.privateRows.slice(i, i + DELTA_SYNC.UPSERT_CHUNK).map((r) => ({ ...r, updated_at: nowIso }))
    const { error } = await sb.from('listing_private').upsert(chunk, { onConflict: 'listing_key' })
    if (error) console.error('[deltaSync] listing_private upsert error.', error.message)
  }

  // 2. Price history.
  if (plan.priceHistoryRows.length > 0) {
    const r = await insertPriceHistoryRows(plan.priceHistoryRows)
    if (!r.ok) console.error('[deltaSync] price_history insert error.', r.error)
  }

  // 3. Status history.
  if (plan.statusHistoryRows.length > 0) {
    const r = await insertStatusHistoryRows(plan.statusHistoryRows)
    if (!r.ok) console.error('[deltaSync] status_history insert error.', r.error)
  }

  // 4. Activity events (stamp event_at).
  if (plan.activityEvents.length > 0) {
    const rows = plan.activityEvents.map((e) => ({ ...e, event_at: nowIso }))
    const r = await insertActivityEventRows(rows)
    if (!r.ok) console.error('[deltaSync] activity_events insert error.', r.error)
  }

  // 5. Finalize terminal listings (capped) — history + aux, then mark finalized.
  const finalizeSlice = plan.finalizeTargets.slice(0, DELTA_SYNC.MAX_FINALIZE_PER_RUN)
  for (const t of finalizeSlice) {
    if (listingsFinalized >= DELTA_SYNC.MAX_FINALIZE_PER_RUN) break
    const { inserted, ok: hadSuccessfulFetch, items } = await fetchAndInsertHistoryCore(accessToken, t.listingKey)
    historyRowsInserted += inserted
    const src = t.sourceRow
    const auxSync = await syncAuxiliaryTablesForFinalization(
      sb,
      {
        listingKey: t.listingKey,
        photoUrl: typeof src.PhotoURL === 'string' ? src.PhotoURL : null,
        details: src.details ?? null,
        listAgentName: typeof src.ListAgentName === 'string' ? src.ListAgentName : null,
        listAgentFirstName: typeof src.ListAgentFirstName === 'string' ? src.ListAgentFirstName : null,
        listAgentLastName: typeof src.ListAgentLastName === 'string' ? src.ListAgentLastName : null,
        listOfficeName: typeof src.ListOfficeName === 'string' ? src.ListOfficeName : null,
      },
      items,
      { accessToken },
    )
    if (hadSuccessfulFetch && auxSync.ok) {
      const r = await upsertListingRows([
        { ListNumber: t.listNumber, history_finalized: true, history_verified_full: true, is_finalized: true },
      ])
      if (r.ok) listingsFinalized++
      else console.error(`[deltaSync] finalization error for ${t.listNumber}.`, r.error)
    }
  }

  // 6. Photo-fix pass for rows upserted without a PhotoURL.
  const photoKeys = plan.rowsToUpsert
    .filter((r) => !r.PhotoURL && r.ListingKey)
    .map((r) => r.ListingKey as string)
    .slice(0, DELTA_SYNC.MAX_PHOTO_FIXES)
  for (const key of photoKeys) {
    const url = await fetchPhotoForListingCore(accessToken, key)
    if (url) {
      const r = await updateListingPhotoUrl(key, url)
      if (r.ok) photosFixed++
    }
  }

  // Cursor: advance only as far as safely drained (cursor-safety p0.1).
  const nextCursor = computeNextDeltaCursor({ upsertFailed, truncated, runStartedAt, maxProcessedTs: plan.maxProcessedTs })
  if (nextCursor) await updateSyncStateLastDelta(nextCursor)
  if (upsertFailed) console.error('[deltaSync] upsert failure(s) — cursor NOT advanced; window retried next tick.')
  else if (truncated) console.warn(`[deltaSync] TRUNCATED at MAX_PAGES; cursor -> ${nextCursor ?? '(unchanged)'} (not now()).`)

  // Refresh market pulse (non-critical). City/region + community neighborhoods (BL-016).
  try {
    await sb.rpc('refresh_market_pulse')
    await sb.rpc('refresh_community_market_pulse')
  } catch { /* non-critical */ }

  // Expired-listing pipeline over anything that just went terminal (soft-fail).
  let expired: ExpiredStats | null = null
  try {
    const r = await processNewExpiredListings(sb, { maxPerRun: 10, lookbackHours: 2 })
    expired = { scanned: r.scanned, new_processed: r.new_processed, alert_emails_sent: r.alert_emails_sent, errors: r.errors }
  } catch (err) {
    console.error('[deltaSync] processNewExpiredListings failed (non-fatal).', err instanceof Error ? err.message : err)
  }

  return {
    ok: !upsertFailed,
    partial: upsertFailed || truncated,
    sinceIso,
    pages: pagesProcessed,
    truncated,
    maxProcessedTs: plan.maxProcessedTs,
    totalFetched: plan.counters.fetched,
    totalUpserted,
    newListings: plan.counters.newListings,
    priceChanges: plan.counters.priceChanges,
    statusChanges: plan.counters.statusChanges,
    eventsEmitted: plan.activityEvents.length,
    listingsFinalized,
    historyRowsInserted,
    photosFixed,
    skippedFinalized: plan.counters.skippedFinalized,
    expired,
  }
}
