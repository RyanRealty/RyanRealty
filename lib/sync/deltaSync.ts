/**
 * Unified delta-sync core (DORMANT — no production path calls this yet).
 *
 * Audit #1b: the delta sync forked into two lanes with divergent tuning and a
 * partially different diff/event/finalize matrix:
 *   - ACTION lane  app/actions/sync-spark.ts  syncSparkListingsDelta
 *   - CRON lane    app/api/cron/sync-delta/route.ts  GET  (the hardened prod path)
 *
 * This module extracts ONE core so the fork cannot drift. It is landed DORMANT:
 * `computeDeltaPlan` (the pure decision heart) is exhaustively unit-tested, and
 * `runDeltaSync({ mode: 'shadow' })` computes the plan read-only for the
 * compute-and-compare shadow run. The `execute` mode is cutover-gated and throws
 * until the shadow run confirms byte-identical output against both live lanes.
 *
 * DO NOT flip the two live lanes to call this until the shadow run in
 * docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md is green. A bad cutover silently
 * corrupts 589K rows of live MLS data.
 *
 * Canonical behavior = the hardened cron lane's constants + its extra features
 * (listing_private diversion, price/status history, finalize cap, photo fix,
 * expired pipeline, skip-finalized), UNIONED with the two action-lane behaviors
 * the cron lane lacks (status_active events, media_finalized on close) so no
 * caller regresses at cutover. The expand set is reconciled to the superset.
 */

import { computeNextDeltaCursor } from '@/lib/sync/deltaCursor'
import { isTerminalStatus } from '@/lib/sync/terminalStatus'
import { isActiveStatus, isPendingStatus, isClosedStatus } from '@/lib/listing-status'
import { sparkToListingRow, extractPrivateDetails } from '@/lib/listing-mapper'
import { fetchSparkListingsPage } from '@/lib/spark'
import { getExistingListingsByListNumbers } from '@/lib/data/sync/syncWrites'

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
    const row = sparkToListingRow(fields, result.Id)

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

// ── Orchestrator (dormant) ────────────────────────────────────────────────────

export type RunDeltaSyncOptions = {
  /** shadow = compute the plan read-only (no writes); execute = cutover-gated. */
  mode: 'shadow' | 'execute'
  accessToken?: string
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

/**
 * Run the unified core. `mode: 'shadow'` fetches the window, computes the plan
 * read-only, and returns it (plus the would-be cursor) for the compute-and-
 * compare shadow run — it performs NO writes. `mode: 'execute'` is cutover-gated
 * and throws until the shadow run has verified parity against both live lanes;
 * wiring the execute path + flipping the two lane wrappers is the cutover step
 * documented in docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md.
 */
export async function runDeltaSync(opts: RunDeltaSyncOptions): Promise<ShadowRunResult> {
  if (opts.mode === 'execute') {
    throw new Error(
      'delta-sync core execute mode is cutover-gated. Run the shadow comparison ' +
        'in docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md and flip the lane wrappers first.',
    )
  }

  const accessToken = (opts.accessToken ?? process.env.SPARK_API_KEY ?? '').trim()
  if (!accessToken) throw new Error('runDeltaSync(shadow): SPARK_API_KEY / accessToken required')

  const maxPages = opts.maxPages ?? DELTA_SYNC.MAX_PAGES
  const pageSize = opts.pageSize ?? DELTA_SYNC.PAGE_SIZE
  const nowIso = opts.nowIso ?? new Date().toISOString()
  const sinceIso = opts.sinceOverride ?? new Date(Date.now() - DELTA_SYNC.DEFAULT_WINDOW_MS).toISOString()

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
    if (pagesProcessed === 0 && pageResults.length === 0) break
    if (pageResults.length === 0) break
    results.push(...pageResults)
    totalPages = res.D?.Pagination?.TotalPages ?? page
    pagesProcessed++
    page++
  }

  const listNumbers = results
    .map((r) => String((r.StandardFields?.ListNumber ?? '') as string).trim())
    .filter(Boolean)
  const existingByNum = await loadExistingByNum(listNumbers)

  const plan = computeDeltaPlan(results, existingByNum, { nowIso })

  const truncated = pagesProcessed >= maxPages && page <= totalPages
  const nextCursor = computeNextDeltaCursor({
    upsertFailed: false,
    truncated,
    runStartedAt,
    maxProcessedTs: plan.maxProcessedTs,
  })

  return { sinceIso, pages: pagesProcessed, truncated, maxProcessedTs: plan.maxProcessedTs, nextCursor, plan }
}
