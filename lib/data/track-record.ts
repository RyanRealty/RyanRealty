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
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

export type BrokerageTrackRecord = {
  homesSold: number
  totalVolume: number
  avgSalePrice: number
}

async function _getBrokerageTrackRecord(): Promise<BrokerageTrackRecord | null> {
  const sb = createServiceClient()
  try {
    const { data, error } = await sb
      .from('listings')
      .select('"ClosePrice"')
      .ilike('ListOfficeName', '%ryan realty%')
      .eq('StandardStatus', 'Closed')
      .not('"ClosePrice"', 'is', null)

    if (error || !data) return null

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
  } catch (e) {
    console.warn('[lib/data/track-record] getBrokerageTrackRecord failed:', e)
    return null
  }
}

export const getBrokerageTrackRecord = unstable_cache(
  _getBrokerageTrackRecord,
  ['brokerage-track-record'],
  {
    revalidate: 6 * 60 * 60, // 6h
    tags: ['market', 'listings'],
  },
)
