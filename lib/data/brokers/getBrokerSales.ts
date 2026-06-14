/**
 * getBrokerSales — a single broker's CLOSED transactions, BOTH sides:
 *   - sell side: listings the broker listed   (listings.list_agent_email)
 *   - buy side:  listings where the broker represented the buyer
 *                (listings.buyer_agent_mls_id — there is no buyer_agent_email)
 *
 * DATA ACCURACY (CLAUDE.md §0): match keys are EXACT identifiers, never name
 * ILIKE. Name matching pulls in other-brokerage agents ("Matt Bryant",
 * "Rebecca Brunot") and over-counts — verified 2026-06-14. `list_agent_email`
 * and `buyer_agent_mls_id` are the only reliable keys. "Closed" = ClosePrice
 * present (a cancelled/withdrawn listing carries no close price). Every price
 * returned is the recorded MLS closing price.
 *
 * The broker's MLS agent id (buyer-side join key) is resolved from the broker's
 * own list-side rows when not supplied, because brokers.mls_id is not populated.
 *
 * Reads `listings` directly inside the DAL boundary (the tile MV projects
 * neither list_agent_email nor buyer_agent_mls_id). Rows are returned in the
 * PriceDropTile shape (+ saleSide) so existing tile mappers can render them.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'

export type BrokerSaleSide = 'listed' | 'represented-buyer'
export type BrokerSaleTile = PriceDropTile & { saleSide: BrokerSaleSide }

const SALE_PROJECTION = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName',
  'PhotoURL, StandardStatus, OnMarketDate, CloseDate, ClosePrice',
  'ListAgentName, ListOfficeName',
  'has_virtual_tour, virtual_tour_url',
  'year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn',
  'estimated_monthly_piti, price_drop_count, DaysOnMarket, total_price_change_pct',
].join(', ')

async function fetchBrokerSales(
  email: string,
  mlsId: string,
  limit: number,
): Promise<BrokerSaleTile[]> {
  const sb = supabaseAnon()
  if (!sb || !email.trim()) return []
  const emailLc = email.trim().toLowerCase()

  // Resolve the broker's MLS agent id (buyer-side join key) when not supplied —
  // derive from the broker's own list-side rows.
  let resolvedMlsId = mlsId.trim().toLowerCase()
  if (!resolvedMlsId) {
    const { data: idRows, error: idErr } = await sb
      .from('listings')
      .select('list_agent_mls_id')
      .eq('list_agent_email', emailLc)
      .not('list_agent_mls_id', 'is', null)
      .limit(1)
    if (idErr) throw new Error(`[getBrokerSales id] ${idErr.message}`)
    resolvedMlsId = (idRows?.[0]?.list_agent_mls_id ?? '').trim().toLowerCase()
  }

  // Pull a generous window of each side, then dedup + sort + cap in JS so a
  // dual-side deal (broker on both ends) is counted once.
  const sellQ = sb
    .from('listings')
    .select(SALE_PROJECTION)
    .eq('list_agent_email', emailLc)
    .not('ClosePrice', 'is', null)
    .not('PhotoURL', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(100)
  const buyQ = resolvedMlsId
    ? sb
        .from('listings')
        .select(SALE_PROJECTION)
        .ilike('buyer_agent_mls_id', resolvedMlsId)
        .not('ClosePrice', 'is', null)
        .not('PhotoURL', 'is', null)
        .order('CloseDate', { ascending: false, nullsFirst: false })
        .limit(100)
    : Promise.resolve({ data: [] as unknown[], error: null })

  const [sellRes, buyRes] = await Promise.all([sellQ, buyQ])
  // THROW on a transient DB error so makeResilientCached never caches []
  // (poison-null). A genuine no-sales broker (Paul) still returns [] legitimately.
  if (sellRes.error) throw new Error(`[getBrokerSales sell] ${sellRes.error.message}`)
  if (buyRes.error) throw new Error(`[getBrokerSales buy] ${buyRes.error.message}`)

  const byKey = new Map<string, BrokerSaleTile>()
  for (const r of (sellRes.data ?? []) as unknown as PriceDropTile[]) {
    const k = (r.ListingKey ?? '').trim()
    if (k) byKey.set(k, { ...r, saleSide: 'listed' })
  }
  for (const r of (buyRes.data ?? []) as unknown as PriceDropTile[]) {
    const k = (r.ListingKey ?? '').trim()
    if (k && !byKey.has(k)) byKey.set(k, { ...r, saleSide: 'represented-buyer' })
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const ad = a.CloseDate ? new Date(a.CloseDate).getTime() : 0
      const bd = b.CloseDate ? new Date(b.CloseDate).getTime() : 0
      return bd - ad
    })
    .slice(0, limit)
}

const cachedBrokerSales = makeResilientCached(
  fetchBrokerSales,
  ['broker-sales-v1'],
  { revalidate: CACHE_WINDOWS.brokers, tags: [cacheTag.brokers, cacheTag.listings] },
  [],
)

/**
 * A broker's recent closed sales, both sides, newest close first.
 * @param email   broker's email (sell-side key: listings.list_agent_email)
 * @param mlsId   broker's MLS agent id (buy-side key). Optional — derived from
 *                the broker's own list-side rows when omitted.
 * @param limit   max cards to return (default 9, capped 24).
 */
export function getBrokerSales(opts: {
  email: string | null | undefined
  mlsId?: string | null
  limit?: number
}): Promise<BrokerSaleTile[]> {
  const email = (opts.email ?? '').trim()
  if (!email) return Promise.resolve([])
  const limit = Math.min(Math.max(opts.limit ?? 9, 1), 24)
  return cachedBrokerSales(email.toLowerCase(), (opts.mlsId ?? '').toLowerCase(), limit)
}
