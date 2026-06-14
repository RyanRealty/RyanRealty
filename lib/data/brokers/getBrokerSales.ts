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

// Verified MLS agent ids (listings.list_agent_mls_id / buyer_agent_mls_id),
// confirmed 2026-06-14. brokers.mls_id is unpopulated and a broker's lone
// list-side row can carry a null id, so a static verified map is the reliable
// buy-side join key. Keyed by email (lowercase).
const BROKER_MLS_ID_BY_EMAIL: Record<string, string> = {
  'matt@ryan-realty.com': 'c10676',
  'rebeccapeterson@ryan-realty.com': 'c13902',
  'paul@ryan-realty.com': 'c13975',
}

const SALE_PROJECTION = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName',
  'PhotoURL, StandardStatus, OnMarketDate, CloseDate, ClosePrice',
  'ListAgentName, ListOfficeName',
  'has_virtual_tour, virtual_tour_url',
  'year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn',
  'estimated_monthly_piti, price_drop_count, DaysOnMarket, total_price_change_pct',
].join(', ')

// SELL side — listings the broker listed. list_agent_email is indexed
// (idx_listings_list_agent_email), so this is fast + reliable. THROW on error
// so the resilient cache never stores a poisoned empty.
async function fetchSellSide(emailLc: string): Promise<BrokerSaleTile[]> {
  const sb = supabaseAnon()
  if (!sb || !emailLc) return []
  const { data, error } = await sb
    .from('listings')
    .select(SALE_PROJECTION)
    .eq('list_agent_email', emailLc)
    .not('ClosePrice', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) throw new Error(`[getBrokerSales sell] ${error.message}`)
  return ((data ?? []) as unknown as PriceDropTile[]).map((r) => ({ ...r, saleSide: 'listed' as const }))
}

// BUY side — listings where the broker represented the buyer. buyer_agent_mls_id
// is NOT indexed, so this seq-scans the listings table and can hit the anon
// statement_timeout (57014). Use EQ (not ILIKE) — values are stored lowercase
// and the id is lowercased, so eq matches without a per-row lower() and is the
// cheapest scan (also index-ready if one is ever added). Cached + queried
// SEPARATELY from the sell side (see getBrokerSales) so a buy-side timeout
// degrades to sell-only and never zeroes the section.
async function fetchBuySide(mlsIdLc: string): Promise<BrokerSaleTile[]> {
  const sb = supabaseAnon()
  if (!sb || !mlsIdLc) return []
  const { data, error } = await sb
    .from('listings')
    .select(SALE_PROJECTION)
    .eq('buyer_agent_mls_id', mlsIdLc)
    .not('ClosePrice', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) throw new Error(`[getBrokerSales buy] ${error.message}`)
  return ((data ?? []) as unknown as PriceDropTile[]).map((r) => ({ ...r, saleSide: 'represented-buyer' as const }))
}

// Buyer-side join key: caller-supplied -> verified map -> derive from the
// broker's own (indexed) list-side rows. brokers.mls_id is unpopulated.
async function resolveMlsId(emailLc: string, supplied: string): Promise<string> {
  const s = supplied.trim().toLowerCase()
  if (s) return s
  const mapped = BROKER_MLS_ID_BY_EMAIL[emailLc]
  if (mapped) return mapped
  const sb = supabaseAnon()
  if (!sb) return ''
  const { data } = await sb
    .from('listings')
    .select('list_agent_mls_id')
    .eq('list_agent_email', emailLc)
    .not('list_agent_mls_id', 'is', null)
    .limit(1)
  return (data?.[0]?.list_agent_mls_id ?? '').trim().toLowerCase()
}

const cacheOpts = { revalidate: CACHE_WINDOWS.brokers, tags: [cacheTag.brokers, cacheTag.listings] }
const cachedSellSide = makeResilientCached(fetchSellSide, ['broker-sell-v1'], cacheOpts, [])
const cachedBuySide = makeResilientCached(fetchBuySide, ['broker-buy-v1'], cacheOpts, [])

/**
 * A broker's recent closed sales, both sides, newest close first.
 *
 * Sell + buy are cached and fetched INDEPENDENTLY: the sell side is indexed and
 * reliable; the buy side is unindexed and best-effort, so a buy-side timeout
 * degrades to sell-only rather than hiding the whole section. makeResilientCached
 * returns [] (uncached) on a persistent buy error, so the buy side self-heals
 * and caches on its first success.
 *
 * @param email broker's email (sell-side key). @param mlsId buy-side key
 * (optional, resolved if omitted). @param limit max cards (default 9, cap 24).
 */
export async function getBrokerSales(opts: {
  email: string | null | undefined
  mlsId?: string | null
  limit?: number
}): Promise<BrokerSaleTile[]> {
  const email = (opts.email ?? '').trim()
  if (!email) return []
  const emailLc = email.toLowerCase()
  const limit = Math.min(Math.max(opts.limit ?? 9, 1), 24)
  const mlsId = await resolveMlsId(emailLc, opts.mlsId ?? '')
  const [sell, buy] = await Promise.all([cachedSellSide(emailLc), cachedBuySide(mlsId)])

  // Dedup by ListingKey, sell side wins (a dual-side deal counts once as listed).
  const byKey = new Map<string, BrokerSaleTile>()
  for (const r of sell) {
    const k = (r.ListingKey ?? '').trim()
    if (k) byKey.set(k, r)
  }
  for (const r of buy) {
    const k = (r.ListingKey ?? '').trim()
    if (k && !byKey.has(k)) byKey.set(k, r)
  }
  return [...byKey.values()]
    .sort((a, b) => {
      const ad = a.CloseDate ? new Date(a.CloseDate).getTime() : 0
      const bd = b.CloseDate ? new Date(b.CloseDate).getTime() : 0
      return bd - ad
    })
    .slice(0, limit)
}
