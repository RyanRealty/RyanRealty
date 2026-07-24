'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import {
  getListingsForHomeTiles,
  getHomeTileRowsByKeys,
  getHotCommunitiesInCity,
} from '@/app/actions/listings'
import { getTrendingListingKeys } from '@/app/actions/listing-views'
import { sendEvent } from '@/lib/followupboss'
import { getCityListings as getCityListingsDAL } from '@/lib/data'
import type { HomeTileRow } from '@/app/actions/listings'
import type { HotCommunity } from '@/app/actions/listings'
import { PUBLIC_ACTIVE_OR_PREDICATE, isPubliclyDisplayableStatus } from '@/lib/listing-status-public'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

const ACTIVE_OR =
  PUBLIC_ACTIVE_OR_PREDICATE

/** Featured: top 6 by engagement view_count (optional city filter), then by ModificationTimestamp. Active only. */
async function _getFeaturedListingsUncached(city?: string): Promise<HomeTileRow[]> {
  try {
    void supabase
    const { getTopViewedListingKeys } = await import('@/lib/data')
    const keys = await getTopViewedListingKeys(20)
    let rows: HomeTileRow[]
    if (keys.length === 0) {
      // DAL: read newest active listings from listing_tile_mv, extract keys,
      // then call the existing getHomeTileRowsByKeys to keep the rest of
      // the pipeline identical. Drains a direct listings-table read without
      // changing the consumer shape.
      const fallbackTiles = await getCityListingsDAL(city?.trim() || 'Bend', {
        status: 'active',
        sort: 'newest',
        limit: 12,
      })
      const fallbackKeys = fallbackTiles.map((t) => t.listingKey).filter(Boolean)
      rows = await getHomeTileRowsByKeys(fallbackKeys)
    } else {
      rows = await getHomeTileRowsByKeys(keys)
    }
    const active = rows.filter((r) => isPubliclyDisplayableStatus(r.StandardStatus) && /active|for sale/i.test(String(r.StandardStatus ?? '')))
    const filtered = city?.trim() ? active.filter((r) => (r.City ?? '').toString().trim().toLowerCase() === city.trim().toLowerCase()) : active
    if (filtered.length >= 6) return filtered.slice(0, 6)
    const fill = await getListingsForHomeTiles({ city: city?.trim() ?? 'Bend', limit: 6 - filtered.length })
    const haveKeys = new Set(filtered.map((r) => (r.ListingKey ?? r.ListNumber ?? '').toString().trim()).filter(Boolean))
    const extra = fill.filter((r) => !haveKeys.has((r.ListingKey ?? r.ListNumber ?? '').toString().trim()))
    return [...filtered, ...extra].slice(0, 6)
  } catch {
    return []
  }
}

export const getFeaturedListings = unstable_cache(
  _getFeaturedListingsUncached,
  ['featured-listings'],
  { revalidate: 300, tags: ['featured-listings'] }
)

/** Just listed: 8 newest Active by ModificationTimestamp for the given city. */
async function _getJustListedUncached(city: string = 'Bend'): Promise<HomeTileRow[]> {
  const cityName = city.trim() || 'Bend'
  try {
    // DAL: read newest-active tiles from listing_tile_mv, fetch the
    // detail-shaped HomeTileRow via getHomeTileRowsByKeys. Sort by
    // modified_at (DAL semantic) is close enough to OnMarketDate for
    // "Just Listed" — fresh listings have modified_at == on_market_date.
    const tiles = await getCityListingsDAL(cityName, {
      status: 'active-and-pending',
      sort: 'newest',
      limit: 32,
    })
    if (tiles.length === 0) {
      const fallback = await getListingsForHomeTiles({ city: cityName, limit: 8 })
      return fallback.slice(0, 8)
    }
    const keys = tiles.map((t) => t.listingKey).filter(Boolean).slice(0, 32)
    const rows = await getHomeTileRowsByKeys(keys)
    const active = rows.filter((r) =>
      isPubliclyDisplayableStatus(r.StandardStatus) && /active|for sale|pending/i.test(String(r.StandardStatus ?? '')),
    )
    if (active.length === 0) {
      const fallback = await getListingsForHomeTiles({ city: cityName, limit: 8 })
      return fallback.slice(0, 8)
    }
    return active.slice(0, 8)
  } catch {
    try {
      const fallback = await getListingsForHomeTiles({ city: cityName, limit: 8 })
      return fallback.slice(0, 8)
    } catch {
      return []
    }
  }
}

export const getJustListed = unstable_cache(
  _getJustListedUncached,
  ['just-listed'],
  { revalidate: 120, tags: ['just-listed'] }
)

/** Recently sold: 4 newest Closed with close price/date, optional city filter. */
async function _getRecentlySoldUncached(city?: string): Promise<(HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  try {
    // DAL: read closed tiles sorted by close-newest from listing_tile_mv.
    const cityName = city?.trim() || ''
    const filter = { status: 'closed' as const, sort: 'close-newest' as const, limit: 4 }
    const tiles = cityName
      ? await getCityListingsDAL(cityName, filter)
      : await import('@/lib/data').then((m) => m.getListingTiles(filter))
    return tiles.map((t) => ({
      ...({
        ListingKey: t.listingKey,
        ListNumber: t.listNumber,
        ListPrice: t.listPrice,
        BedroomsTotal: t.beds,
        BathroomsTotal: t.baths,
        StreetNumber: t.streetNumber,
        StreetName: t.streetName,
        City: t.city,
        State: null,
        PostalCode: t.postalCode,
        SubdivisionName: t.subdivisionName,
        PhotoURL: t.photoUrl,
        Latitude: t.lat,
        Longitude: t.lng,
        StandardStatus: t.status,
        TotalLivingAreaSqFt: t.sqft,
        OnMarketDate: t.onMarketDate,
        has_virtual_tour: t.hasVirtualTour,
        year_built: t.yearBuilt,
        price_per_sqft: t.pricePerSqft,
        lot_size_acres: t.lotSizeAcres,
        garage_spaces: t.garageSpaces,
        pool_yn: t.poolYn,
        price_drop_count: t.priceDropCount,
        DaysOnMarket: t.dom,
      } as HomeTileRow),
      ClosePrice: t.closePrice,
      CloseDate: t.closeDate,
    }))
  } catch {
    return []
  }
}

export const getRecentlySold = unstable_cache(
  _getRecentlySoldUncached,
  ['recently-sold'],
  { revalidate: 120, tags: ['recently-sold'] }
)

/** Price drops: 6 listings where original price > current price (from listings table), optional city filter. */
export async function getPriceDrops(city?: string): Promise<(HomeTileRow & { originalPrice?: number; savings?: number })[]> {
  try {
    void supabase
    void ACTIVE_OR
    const { getPriceDropTiles } = await import('@/lib/data')
    const rows = await getPriceDropTiles({ city: city ?? null, limit: 6 })
    return rows.map((r) => ({
      ...(r as unknown as HomeTileRow),
      OriginalListPrice: r.OriginalListPrice ?? undefined,
      originalPrice: r.OriginalListPrice ?? undefined,
      savings:
        r.OriginalListPrice != null && r.ListPrice != null
          ? r.OriginalListPrice - r.ListPrice
          : undefined,
    }))
  } catch {
    return []
  }
}

/** Community highlights: top 6 by listing count (Bend city). */
async function _getCommunityHighlightsUncached(): Promise<HotCommunity[]> {
  const list = await getHotCommunitiesInCity('Bend')
  return list.slice(0, 6)
}

export const getCommunityHighlights = unstable_cache(
  _getCommunityHighlightsUncached,
  ['community-highlights'],
  { revalidate: 300, tags: ['community-highlights'] }
)

const TRENDING_MIN_COUNT = 5

/** Trending: listings by view count (listing_views) for the given city; if fewer than 5, fill with newest listings. */
async function _getTrendingListingsUncached(city: string = 'Bend'): Promise<HomeTileRow[]> {
  const cityName = city.trim() || 'Bend'
  const keys = await getTrendingListingKeys(cityName, 12)
  const rows = keys.length > 0
    ? (await getHomeTileRowsByKeys(keys)).filter((r) =>
        isPubliclyDisplayableStatus(r.StandardStatus) && /active|pending|for sale/i.test(String(r.StandardStatus ?? ''))
      )
    : []
  if (rows.length >= TRENDING_MIN_COUNT) return rows.slice(0, TRENDING_MIN_COUNT)
  const haveKeys = new Set(rows.map((r) => (r.ListNumber ?? r.ListingKey ?? '').toString().trim()).filter(Boolean))
  const fillCount = TRENDING_MIN_COUNT - rows.length
  const newest = await getListingsForHomeTiles({ city: cityName, limit: fillCount + 8 })
  const extra = newest.filter((r) => {
    const k = (r.ListNumber ?? r.ListingKey ?? '').toString().trim()
    return k && !haveKeys.has(k)
  })
  const combined = [...rows, ...extra.slice(0, fillCount)]
  return combined.slice(0, TRENDING_MIN_COUNT)
}

export const getTrendingListings = unstable_cache(
  _getTrendingListingsUncached,
  ['trending-listings'],
  { revalidate: 60, tags: ['trending-listings'] }
)

/** Blog posts for homepage teaser. Returns empty until blog CMS exists. */
export async function getBlogPostsForHome(): Promise<Array<{
  id: string
  title: string
  excerpt: string
  slug: string
  imageUrl?: string | null
  publishedAt: string
  readTimeMinutes?: number
  category?: string | null
}>> {
  return []
}

/** Newsletter signup: push to FUB as lead with tag "newsletter-signup". */
export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = email?.trim().toLowerCase()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Invalid email' }
  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const result = await sendEvent({
    type: 'Registration',
    person: { emails: [{ value: e }] },
    source,
    message: 'newsletter-signup',
  })
  if (result.ok) return { ok: true }
  return { ok: false, error: result.error ?? 'Subscription failed' }
}
