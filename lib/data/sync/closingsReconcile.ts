/**
 * Closings reconciliation: the Supabase reads and writes.
 *
 * lib/sync/closingsReconcile.ts sets every closing Spark holds for a window
 * against our copy. These are the two reads it needs: our rows for a set of
 * listing keys (the facts a market statistic reads, plus the freeze flags), and
 * the keys we hold as closed inside the window (the reverse direction: a row we
 * count that Spark no longer places there). Plus its writes: the closings the
 * MLS no longer serves (market_listing_absent_from_mls), their deletion once
 * due (delete_mls_removed_sales) and restore if the MLS serves one again
 * (restore_mls_removed_sales), and the before-image of every repair or
 * deletion (listing_mls_repair_log), with which of them the owner was told.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type ReconcileListingRow = {
  ListNumber: string
  ListingKey: string | null
  StandardStatus: string | null
  City: string | null
  CloseDate: string | null
  ClosePrice: number | null
  ListPrice: number | null
  property_sub_type: string | null
  TotalLivingAreaSqFt: number | null
  is_finalized: boolean | null
  media_finalized: boolean | null
}

const RECONCILE_COLUMNS =
  'ListNumber, ListingKey, StandardStatus, City, CloseDate, ClosePrice, ListPrice, property_sub_type, TotalLivingAreaSqFt, is_finalized, media_finalized'

/** Our rows for these listing keys, keyed by ListingKey. */
export async function getListingsForReconcile(keys: string[]): Promise<Map<string, ReconcileListingRow>> {
  const sb = createServiceClient()
  const out = new Map<string, ReconcileListingRow>()
  const unique = [...new Set(keys.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 150) {
    const { data, error } = await sb.from('listings').select(RECONCILE_COLUMNS).in('ListingKey', unique.slice(i, i + 150))
    if (error) throw new Error(`[getListingsForReconcile] ${error.message}`)
    for (const r of (data ?? []) as ReconcileListingRow[]) {
      if (r.ListingKey) out.set(r.ListingKey, r)
    }
  }
  return out
}

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

/**
 * Listing keys we hold as Closed with a close date inside [from, to] (inclusive
 * dates). Read one calendar month at a time, ordered by close date first so the
 * close-date index drives each page: ordered by key alone, the planner walked
 * the primary key and filtered, and a month from 2023 timed out (every older
 * key sorts ahead of it).
 */
export async function getClosedListingKeysInWindow(from: string, to: string): Promise<string[]> {
  const sb = createServiceClient()
  const out: string[] = []
  let start = from
  while (start <= to) {
    const monthEnd = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10)
    const end = monthEnd < to ? monthEnd : to
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await sb
        .from('listings')
        .select('ListingKey')
        .eq('StandardStatus', 'Closed')
        .gte('CloseDate', `${start}T00:00:00Z`)
        .lt('CloseDate', `${nextDay(end)}T00:00:00Z`)
        .order('CloseDate')
        .order('ListingKey')
        .range(offset, offset + 999)
      if (error) throw new Error(`[getClosedListingKeysInWindow] ${error.message}`)
      const rows = (data ?? []) as { ListingKey: string | null }[]
      for (const r of rows) if (r.ListingKey) out.push(r.ListingKey)
      if (rows.length < 1000) break
    }
    start = nextDay(end)
  }
  return out
}

/**
 * Rebuild place membership (region, city, county, polygons) for these listings.
 * The pg_cron refresh only picks up a listing whose MLS timestamp is newer than
 * its membership rows; a drift repair writes the MLS's own, older timestamp, so
 * a repaired listing whose city changed would keep its old membership.
 */
export async function rebuildPlaceMembershipForKeys(keys: string[]): Promise<number> {
  const sb = createServiceClient()
  const unique = [...new Set(keys.filter(Boolean))]
  let rows = 0
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await sb.rpc('place_membership_rebuild_keys', { p_keys: unique.slice(i, i + 200) })
    if (error) throw new Error(`[rebuildPlaceMembershipForKeys] ${error.message}`)
    rows += Number(data ?? 0)
  }
  return rows
}

/**
 * Closed sales we hold that the MLS no longer serves at all (Matt 2026-09-25:
 * left out of every statistic). Market Truth reads this table when it builds
 * sale facts (refresh_market_fact_sale marks them absent_from_mls). Each call
 * is a sighting: record_absent_from_mls counts the daily checks that found a
 * sale missing (one per 12 hours at most), and deletion needs three.
 */
export async function recordAbsentFromMls(
  rows: { listingKey: string; listNumber: string | null; closeDate: string | null }[],
): Promise<number> {
  if (rows.length === 0) return 0
  const sb = createServiceClient()
  const { error } = await sb.rpc('record_absent_from_mls', {
    p_rows: rows.map((r) => ({ listing_key: r.listingKey, list_number: r.listNumber, close_date: r.closeDate })),
  })
  if (error) throw new Error(`[recordAbsentFromMls] ${error.message}`)
  return rows.length
}

/**
 * Listing keys recorded as absent from the MLS whose close date falls in the
 * window (all of them without one). A run re-checks only its own window's, so
 * the daily cron never re-reads the whole history from Spark.
 */
export async function getAbsentFromMlsKeys(window?: { from: string; to: string }): Promise<string[]> {
  const sb = createServiceClient()
  const { rows, error } = await fetchPagedRows<{ listing_key: string }>((from, to) => {
    let q = sb.from('market_listing_absent_from_mls').select('listing_key')
    if (window) q = q.gte('close_date', window.from).lte('close_date', window.to)
    return q.order('listing_key').range(from, to)
  })
  if (error) throw new Error(`[getAbsentFromMlsKeys] ${error.message}`)
  return rows.map((r) => r.listing_key)
}

const REMOVED_SOURCE = 'absent-from-mls-delete'
const RESTORED_SOURCE = 'absent-from-mls-restore'

/** A closed sale deleted from our copy because the MLS no longer serves it. */
export type RemovedSale = {
  /** listing_mls_repair_log id holding the whole row (undo: re-insert before_row). */
  logId: number
  listingKey: string
  listNumber: string | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  closeDate: string | null
  closePrice: number | null
  firstDetectedAt: string | null
}

export type RemovedSalesResult = {
  removed: RemovedSale[]
  /**
   * Why nothing was deleted although sales were due: 'budget' (more due than
   * the day may delete) or 'hold' (an earlier hold still waits for a person).
   * Either way the due sales are now held.
   */
  refused: 'budget' | 'hold' | null
  /** Due this call. */
  due: number
  /** Sales held for a person's approval (still Closed rows of ours), after this call. */
  held: number
  /** Recorded missing and still a Closed row of ours, but not due yet. */
  waiting: number
  /** Deletions left in today's budget (Bend calendar day). */
  budget: number | null
}

type RemovedRow = {
  log_id: number
  listing_key: string
  list_number: string | null
  street_number: string | null
  street_name: string | null
  city: string | null
  close_date: string | null
  close_price: number | string | null
  first_detected_at: string | null
}

/**
 * Delete the closed sales the MLS no longer serves (Matt 2026-09-30, "Delete it
 * automatically"), from keys the caller just confirmed missing. The SQL function
 * (migrations 20260930220000, 20260930230000) holds every rule: a key is due
 * when it is still Closed, was found missing on three daily checks, the first 36
 * hours or more ago, and was confirmed missing in the last 26 hours; each whole
 * row goes to listing_mls_repair_log first, in the same transaction as the
 * delete of the listing and its derived rows. More due than today's budget
 * (maxDelete), or any earlier hold still standing, deletes nothing and holds
 * the due sales until a person approves them by name (approve: true).
 */
export async function deleteMlsRemovedSales(
  keys: string[],
  opts: { maxDelete: number; window?: { from: string; to: string }; approve?: boolean },
): Promise<RemovedSalesResult> {
  // An empty list still calls: the answer carries the standing hold and the day's budget.
  const unique = [...new Set(keys.filter(Boolean))]
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('delete_mls_removed_sales', {
    p_keys: unique,
    p_max_delete: opts.maxDelete,
    p_window_from: opts.window?.from ?? null,
    p_window_to: opts.window?.to ?? null,
    p_approve: opts.approve === true,
  })
  if (error) throw new Error(`[deleteMlsRemovedSales] ${error.message}`)
  const r = (data ?? {}) as {
    refused?: boolean
    reason?: 'budget' | 'hold' | null
    due?: number
    held?: number
    waiting?: number
    budget?: number | null
    rows?: RemovedRow[]
  }
  const removed = r.refused
    ? []
    : (r.rows ?? []).map((row) => ({
        logId: Number(row.log_id),
        listingKey: row.listing_key,
        listNumber: row.list_number,
        streetNumber: row.street_number,
        streetName: row.street_name,
        city: row.city,
        closeDate: row.close_date,
        closePrice: row.close_price == null ? null : Number(row.close_price),
        firstDetectedAt: row.first_detected_at,
      }))
  return {
    removed,
    refused: r.refused ? (r.reason === 'hold' ? 'hold' : 'budget') : null,
    due: Number(r.due ?? 0),
    held: Number(r.held ?? 0),
    waiting: Number(r.waiting ?? 0),
    budget: r.budget ?? null,
  }
}

export type RestoredSales = {
  /** Put back from the saved row, frozen as saved, with the sale's close date (YYYY-MM-DD). */
  restored: { listingKey: string; closeDate: string | null }[]
  /** Saved rows that could not go back (each key is restored on its own). */
  failed: { listingKey: string; error: string }[]
}

/**
 * Put back the saved row of each key the MLS serves again that we deleted as
 * removed (restore_mls_removed_sales): the write from Spark that follows then
 * updates our full record, frozen gallery, broker overrides and counters kept,
 * instead of inserting a bare new one. Keys with no deletion on record, or with
 * a row of ours, are left alone. The derived rows are the caller's to rebuild
 * (lib/sync/mlsRemovedRestore.ts).
 */
export async function restoreMlsRemovedSales(keys: string[]): Promise<RestoredSales> {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return { restored: [], failed: [] }
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('restore_mls_removed_sales', { p_keys: unique })
  if (error) throw new Error(`[restoreMlsRemovedSales] ${error.message}`)
  const d = (data ?? {}) as {
    restored?: { listing_key: string; close_date: string | null }[]
    failed?: { listing_key: string; error: string }[]
  }
  return {
    restored: (d.restored ?? []).map((r) => ({ listingKey: r.listing_key, closeDate: r.close_date })),
    failed: (d.failed ?? []).map((f) => ({ listingKey: f.listing_key, error: f.error })),
  }
}

/**
 * Rebuild the CMA comp (sale_pricing_facts, with its price steps) of these keys
 * now (refresh_sale_pricing_facts_for_keys): the same batch the 6-hourly sweep
 * runs, for one key at a time. A key the comp filter leaves out comes back in
 * skipped.
 */
export async function refreshSalePricingFactsForKeys(
  keys: string[],
): Promise<{ refreshed: string[]; skipped: string[]; failed: { listingKey: string; error: string }[] }> {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return { refreshed: [], skipped: [], failed: [] }
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('refresh_sale_pricing_facts_for_keys', { p_keys: unique })
  if (error) throw new Error(`[refreshSalePricingFactsForKeys] ${error.message}`)
  const d = (data ?? {}) as { refreshed?: string[]; skipped?: string[]; failed?: { listing_key: string; error: string }[] }
  return {
    refreshed: d.refreshed ?? [],
    skipped: d.skipped ?? [],
    failed: (d.failed ?? []).map((f) => ({ listingKey: f.listing_key, error: f.error })),
  }
}

/**
 * Restores whose derived rows are not rebuilt yet (source absent-from-mls-restore,
 * outcome 'pending'), oldest first, with each sale's close day (UTC).
 */
export async function getPendingMlsRestores(limit = 200): Promise<{ id: number; listingKey: string; closeDate: string | null }[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listing_mls_repair_log')
    .select('id, listing_key, close_date:mls->>closeDate')
    .eq('source', RESTORED_SOURCE)
    .eq('outcome', 'pending')
    .order('id')
    .limit(limit)
  if (error) throw new Error(`[getPendingMlsRestores] ${error.message}`)
  return ((data ?? []) as unknown as { id: number; listing_key: string; close_date: string | null }[]).map((r) => {
    const t = r.close_date ? Date.parse(r.close_date) : Number.NaN
    return {
      id: Number(r.id),
      listingKey: r.listing_key,
      closeDate: Number.isNaN(t) ? (r.close_date?.slice(0, 10) ?? null) : new Date(t).toISOString().slice(0, 10),
    }
  })
}

/** Mark restores whose derived rows were all rebuilt. */
export async function markMlsRestoresRebuilt(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0
  const sb = createServiceClient()
  const { error } = await sb.from('listing_mls_repair_log').update({ outcome: 'repaired' }).in('id', ids).eq('outcome', 'pending')
  if (error) throw new Error(`[markMlsRestoresRebuilt] ${error.message}`)
  return ids.length
}

/**
 * Every listing key ever deleted as removed from the MLS: a handful, read once
 * by the full Spark sync so it asks for a restore only when a page holds one.
 */
export async function getDeletedMlsSaleKeys(): Promise<Set<string>> {
  const sb = createServiceClient()
  const { rows, error } = await fetchPagedRows<{ listing_key: string }>((from, to) =>
    sb.from('listing_mls_repair_log').select('listing_key').eq('source', REMOVED_SOURCE).order('id').range(from, to),
  )
  if (error) throw new Error(`[getDeletedMlsSaleKeys] ${error.message}`)
  return new Set(rows.map((r) => r.listing_key))
}

/** A deletion or restore of an MLS-removed sale the owner has not been texted about yet. */
export type MlsRemovalNotice = {
  logId: number
  kind: 'removed' | 'restored'
  listingKey: string
  listNumber: string | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  /** YYYY-MM-DD (close dates are stored as midnight UTC). */
  closeDate: string | null
  closePrice: number | null
}

type NoticeRow = {
  id: number
  source: string
  listing_key: string
  list_number: string | null
  b_street_number: string | null
  b_street_name: string | null
  b_city: string | null
  b_close_date: string | null
  b_close_price: string | null
  m_street_number: string | null
  m_street_name: string | null
  m_city: string | null
  m_close_date: string | null
  m_close_price: string | null
}


/**
 * Deletions and restores of MLS-removed sales not yet texted to the owner
 * (reported_at null), oldest first. Read from the log rather than from the
 * call that deleted them, so a deletion whose response was lost is still told.
 * The limit is far above a day's deletions (10) and a held batch approved at
 * once, so a text's count is the whole count.
 */
export async function getUnreportedMlsRemovalNotices(limit = 1000): Promise<MlsRemovalNotice[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listing_mls_repair_log')
    .select(
      'id, source, listing_key, list_number, ' +
        'b_street_number:before_row->>StreetNumber, b_street_name:before_row->>StreetName, b_city:before_row->>City, ' +
        'b_close_date:before_row->>CloseDate, b_close_price:before_row->>ClosePrice, ' +
        'm_street_number:mls->>streetNumber, m_street_name:mls->>streetName, m_city:mls->>city, ' +
        'm_close_date:mls->>closeDate, m_close_price:mls->>closePrice',
    )
    .in('source', [REMOVED_SOURCE, RESTORED_SOURCE])
    .is('reported_at', null)
    .order('id')
    .limit(limit)
  if (error) throw new Error(`[getUnreportedMlsRemovalNotices] ${error.message}`)
  const num = (v: string | null) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  // The saved row's CloseDate carries the offset of the session that saved it:
  // read the calendar day in UTC, the zone close dates are stored in.
  const utcDay = (v: string | null) => {
    if (!v) return null
    const t = Date.parse(v)
    return Number.isNaN(t) ? v.slice(0, 10) : new Date(t).toISOString().slice(0, 10)
  }
  return ((data ?? []) as unknown as NoticeRow[]).map((r) => {
    const restored = r.source === RESTORED_SOURCE
    const closeDate = utcDay(restored ? r.m_close_date : r.b_close_date)
    return {
      logId: Number(r.id),
      kind: restored ? 'restored' : 'removed',
      listingKey: r.listing_key,
      listNumber: r.list_number,
      streetNumber: restored ? r.m_street_number : r.b_street_number,
      streetName: restored ? r.m_street_name : r.b_street_name,
      city: restored ? r.m_city : r.b_city,
      closeDate,
      closePrice: num(restored ? r.m_close_price : r.b_close_price),
    }
  })
}

/** Mark notices as texted to the owner. */
export async function markMlsRemovalNoticesReported(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0
  const sb = createServiceClient()
  const { error } = await sb
    .from('listing_mls_repair_log')
    .update({ reported_at: new Date().toISOString() })
    .in('id', ids)
    .is('reported_at', null)
  if (error) throw new Error(`[markMlsRemovalNoticesReported] ${error.message}`)
  return ids.length
}

/** Remove keys the MLS serves again. */
export async function clearAbsentFromMls(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  const sb = createServiceClient()
  const { error } = await sb.from('market_listing_absent_from_mls').delete().in('listing_key', keys) // @canonical-key — Spark ListingKey values
  if (error) throw new Error(`[clearAbsentFromMls] ${error.message}`)
  return keys.length
}

/** One listing a repair is about to rewrite: what we held and what the MLS serves. */
export type RepairLogEntry = {
  listingKey: string
  listNumber: string | null
  reasons: string[]
  /** Our values before the repair: the facts a statistic reads. */
  ours: unknown
  /** The whole listing row as it stood right before the repair wrote over it. */
  beforeRow?: Record<string, unknown> | null
  /** What Spark served at repair time. */
  mls: unknown
  windowFrom: string | null
  windowTo: string | null
  note?: string | null
  /** Defaults to now; a backfill passes the time the run wrote its output. */
  repairedAt?: string
  outcome?: 'pending' | 'repaired' | 'failed'
}

/**
 * Keep the before-image of listings a repair is about to rewrite, in
 * listing_mls_repair_log, BEFORE they are rewritten (Matt 2026-09-25: our old
 * values are kept so a repair can be audited or undone). Returns the new row
 * ids by listing key. Throws when the write fails, so the caller never rewrites
 * a listing whose old values were not kept.
 */
export async function recordRepairLog(entries: RepairLogEntry[], source = 'closings-reconcile'): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  if (entries.length === 0) return ids
  const sb = createServiceClient()
  const now = new Date().toISOString()
  for (let i = 0; i < entries.length; i += 500) {
    const { data, error } = await sb
      .from('listing_mls_repair_log')
      .insert(
        entries.slice(i, i + 500).map((e) => ({
          listing_key: e.listingKey,
          list_number: e.listNumber,
          repaired_at: e.repairedAt ?? now,
          source,
          window_from: e.windowFrom,
          window_to: e.windowTo,
          reasons: e.reasons,
          ours: e.ours ?? null,
          before_row: e.beforeRow ?? null,
          mls: e.mls,
          outcome: e.outcome ?? 'pending',
          note: e.note ?? null,
        })),
      )
      .select('id, listing_key')
    if (error) throw new Error(`[recordRepairLog] ${error.message}`)
    for (const r of (data ?? []) as { id: number; listing_key: string }[]) ids.set(r.listing_key, r.id)
  }
  return ids
}

/**
 * The full rows a repair is about to overwrite, read right before the write
 * (one batch, at most 20 keys), for the repair log's before-image.
 */
export async function getListingRowsForRepairLog(keys: string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return out
  const sb = createServiceClient()
  const { data, error } = await sb.from('listings').select('*').in('ListingKey', unique)
  if (error) throw new Error(`[getListingRowsForRepairLog] ${error.message}`)
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (typeof r.ListingKey === 'string') out.set(r.ListingKey, r)
  }
  return out
}

/** Say what a logged repair left undone (history not replaced, row not re-frozen). */
export async function setRepairLogNote(ids: number[], note: string): Promise<number> {
  if (ids.length === 0) return 0
  const sb = createServiceClient()
  const { error } = await sb.from('listing_mls_repair_log').update({ note }).in('id', ids)
  if (error) throw new Error(`[setRepairLogNote] ${error.message}`)
  return ids.length
}

/** Move logged repairs from pending to what happened. */
export async function setRepairLogOutcome(ids: number[], outcome: 'repaired' | 'failed'): Promise<number> {
  if (ids.length === 0) return 0
  const sb = createServiceClient()
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await sb.from('listing_mls_repair_log').update({ outcome }).in('id', ids.slice(i, i + 500))
    if (error) throw new Error(`[setRepairLogOutcome] ${error.message}`)
  }
  return ids.length
}
