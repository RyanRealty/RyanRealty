/**
 * Closings reconciliation: the Supabase reads.
 *
 * lib/sync/closingsReconcile.ts sets every closing Spark holds for a window
 * against our copy. These are the two reads it needs: our rows for a set of
 * listing keys (the facts a market statistic reads, plus the freeze flags), and
 * the keys we hold as closed inside the window (the reverse direction: a row we
 * count that Spark no longer places there).
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
