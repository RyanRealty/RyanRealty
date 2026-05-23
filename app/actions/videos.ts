'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { fetchListingsWithVideos, type FetchListingsWithVideosFilters } from '@/lib/fetch-listings-with-videos'
import type { VideoListingRowShape } from '@/lib/video-tours-listing-videos-join'
import { fetchVideoRowsViaListingVideosJoin, parseVideoListingRowsFromCacheJson } from '@/lib/video-tours-listing-videos-join'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type VideoListingRow = VideoListingRowShape

const CENTRAL_OREGON_CITIES_LOWER = new Set(MARKET_REPORT_DEFAULT_CITIES.map((c) => c.toLowerCase()))

/** Cron fills this from MLS details when listing_videos is empty; require enough rows to skip live query. */
const MIN_HOME_VIDEO_CACHE_ROWS = 10
const MIN_HUB_VIDEO_CACHE_ROWS = 24

export async function getCentralOregonHomeVideoTours(): Promise<VideoListingRowShape[]> {
  try {
    void getSupabase
    const { getVideoToursCacheListings } = await import('@/lib/data')
    const listings = await getVideoToursCacheListings('central_oregon_home')
    if (listings != null) {
      const parsed = parseVideoListingRowsFromCacheJson(listings)
      if (parsed.length >= MIN_HOME_VIDEO_CACHE_ROWS) {
        return parsed.slice(0, 12)
      }
    }
  } catch (err) {
    console.error('[getCentralOregonHomeVideoTours] cache read', err)
  }
  const fromJoin = await fetchVideoRowsViaListingVideosJoin(getSupabase(), {
    maxRows: 12,
    priceDesc: true,
    citiesLower: CENTRAL_OREGON_CITIES_LOWER,
    listingVideosLimit: 600,
  })
  if (fromJoin.length > 0) return fromJoin
  return fetchListingsWithVideos(getSupabase(), {
    region: 'central_oregon',
    sort: 'price_desc',
    status: 'active',
    limit: 12,
  })
}

export async function getCentralOregonVideosHubListings(): Promise<VideoListingRowShape[]> {
  try {
    void getSupabase
    const { getVideoToursCacheListings } = await import('@/lib/data')
    const listings = await getVideoToursCacheListings('central_oregon_hub')
    if (listings != null) {
      const parsed = parseVideoListingRowsFromCacheJson(listings)
      if (parsed.length >= MIN_HUB_VIDEO_CACHE_ROWS) {
        return parsed.slice(0, 48)
      }
    }
  } catch (err) {
    console.error('[getCentralOregonVideosHubListings] cache read', err)
  }
  const fromJoin = await fetchVideoRowsViaListingVideosJoin(getSupabase(), {
    maxRows: 48,
    priceDesc: true,
    citiesLower: CENTRAL_OREGON_CITIES_LOWER,
    listingVideosLimit: 2500,
  })
  if (fromJoin.length > 0) return fromJoin
  return fetchListingsWithVideos(getSupabase(), {
    region: 'central_oregon',
    sort: 'price_desc',
    status: 'active',
    limit: 48,
  })
}

export async function getListingsWithVideos(filters?: FetchListingsWithVideosFilters): Promise<VideoListingRow[]> {
  return fetchListingsWithVideos(getSupabase(), filters)
}

/** Stable cache key token for `region: 'central_oregon'` (MARKET_REPORT_DEFAULT_CITIES). */
const CACHE_KEY_REGION_CENTRAL_OREGON = '__region_central_oregon__'

async function _getListingsWithVideosCachedUncached(
  city: string | null,
  community: string | null,
  citiesOrRegionKey: string | null,
  sort: 'newest' | 'most_viewed' | 'price_desc',
  status: 'active' | 'all',
  limit: number
): Promise<VideoListingRow[]> {
  const base = {
    city: city ?? undefined,
    community: community ?? undefined,
    sort,
    status,
    limit,
  }
  if (citiesOrRegionKey === CACHE_KEY_REGION_CENTRAL_OREGON) {
    return fetchListingsWithVideos(getSupabase(), { ...base, region: 'central_oregon' })
  }
  if (citiesOrRegionKey?.startsWith('cities:')) {
    try {
      const parsed = JSON.parse(citiesOrRegionKey.slice('cities:'.length)) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return fetchListingsWithVideos(getSupabase(), { ...base, cities: parsed })
      }
    } catch {
      /* fall through */
    }
  }
  return fetchListingsWithVideos(getSupabase(), base)
}

const _getListingsWithVideosCached = unstable_cache(
  _getListingsWithVideosCachedUncached,
  ['listings-with-videos-v12'],
  { revalidate: 300, tags: ['listings-videos'] }
)

export async function getListingsWithVideosCached(filters?: {
  community?: string
  city?: string
  region?: 'central_oregon'
  cities?: string[]
  sort?: 'newest' | 'most_viewed' | 'price_desc'
  status?: 'active' | 'all'
  limit?: number
}): Promise<VideoListingRow[]> {
  let citiesOrRegionKey: string | null = null
  if (filters?.region === 'central_oregon') {
    citiesOrRegionKey = CACHE_KEY_REGION_CENTRAL_OREGON
  } else if (filters?.cities?.length) {
    const normalized = [...new Set(filters.cities.map((c) => c.trim()).filter(Boolean))].sort()
    if (normalized.length > 0) {
      citiesOrRegionKey = `cities:${JSON.stringify(normalized)}`
    }
  }

  return _getListingsWithVideosCached(
    filters?.city?.trim() || null,
    filters?.community?.trim() || null,
    citiesOrRegionKey,
    filters?.sort ?? 'newest',
    filters?.status ?? 'active',
    Math.min(Math.max(filters?.limit ?? 24, 1), 60)
  )
}
