/**
 * Closings reconciliation: the Supabase reads and writes.
 *
 * lib/sync/closingsReconcile.ts sets every closing Spark holds for a window
 * against our copy. These are the two reads it needs: our rows for a set of
 * listing keys (the facts a market statistic reads, plus the freeze flags), and
 * the keys we hold as closed inside the window (the reverse direction: a row we
 * count that Spark no longer places there). Plus its writes: the closings the
 * MLS no longer serves (market_listing_absent_from_mls) and the before-image
 * of every repair (listing_mls_repair_log).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

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
 * sale facts (refresh_market_fact_sale marks them absent_from_mls).
 */
export async function recordAbsentFromMls(
  rows: { listingKey: string; listNumber: string | null; closeDate: string | null }[],
): Promise<number> {
  if (rows.length === 0) return 0
  const sb = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await sb.from('market_listing_absent_from_mls').upsert(
    rows.map((r) => ({
      listing_key: r.listingKey,
      list_number: r.listNumber,
      close_date: r.closeDate,
      last_confirmed_at: now,
    })),
    { onConflict: 'listing_key' },
  )
  if (error) throw new Error(`[recordAbsentFromMls] ${error.message}`)
  return rows.length
}

/** Every listing key currently recorded as absent from the MLS (a short list). */
export async function getAbsentFromMlsKeys(): Promise<string[]> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('market_listing_absent_from_mls').select('listing_key').limit(5000)
  if (error) throw new Error(`[getAbsentFromMlsKeys] ${error.message}`)
  return ((data ?? []) as { listing_key: string }[]).map((r) => r.listing_key)
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
  /** Our values before the repair (the reconciliation's snapshot). */
  ours: unknown
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
