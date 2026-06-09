/**
 * getBrokerageTrackRecord — aggregate closed-sale stats for Ryan Realty listings.
 *
 * Source: `listings` table, ListOfficeName ILIKE '%ryan realty%', StandardStatus = 'Closed'.
 * Wrapped in unstable_cache with 6h TTL so the seller conviction LP never hits
 * the database on every page load.
 *
 * Data Accuracy (CLAUDE.md §0): every number in the seller LP track-record band
 * traces to this function. Never hardcode. VALIDATION as of 2026-06-03:
 *   homesSold  = 15
 *   totalVolume = 12,200,034
 *   avgSalePrice ≈ 813,336
 */

import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type BrokerageTrackRecord = {
  homesSold: number
  totalVolume: number
  avgSalePrice: number
}

async function _getBrokerageTrackRecord(): Promise<BrokerageTrackRecord | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listings')
    .select('ClosePrice')
    .ilike('ListOfficeName', '%ryan realty%')
    .eq('StandardStatus', 'Closed')
    .not('ClosePrice', 'is', null)

  // THROW on a transient DB error so makeResilientCached never caches the empty
  // result (poison-null: one pooler/timeout blip would otherwise blank the seller
  // LP track-record band for the whole 6h window). A genuine empty success → null.
  if (error) throw new Error(`[getBrokerageTrackRecord] ${error.message ?? JSON.stringify(error)}`)
  if (!data) return null

  const prices = (data as Array<Record<string, unknown>>)
    .map((r) => {
      const v = r['ClosePrice']
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    })
    .filter((n): n is number => n !== null)

  if (prices.length === 0) return null

  const homesSold = prices.length
  const totalVolume = prices.reduce((sum, p) => sum + p, 0)
  const avgSalePrice = Math.round(totalVolume / homesSold)

  return { homesSold, totalVolume, avgSalePrice }
}

export const getBrokerageTrackRecord = makeResilientCached(
  _getBrokerageTrackRecord,
  // v2 — bumped alongside the poison-null fix (was unstable_cache, which cached
  // null on a transient error). v1 entries may be poisoned; v2 evicts them.
  ['brokerage-track-record-v2'],
  { revalidate: 6 * 60 * 60, tags: ['market', 'listings'] }, // 6h
  null,
)
