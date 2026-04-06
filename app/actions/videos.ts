'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { pickFirstVideoFromListingRow, resolveListingKeyFromRow } from '@/lib/pick-video-from-details'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type VideoListingRow = {
  listing_key: string
  list_number: string | null
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  city: string | null
  unparsed_address: string | null
  photo_url: string | null
  video_url: string
  video_source: 'virtual_tour' | 'listing_video'
}

/** Spark delta columns plus snake_case `listing_key` / `virtual_tour_url` from OData `processSparkListing`. */
const LISTING_VIDEO_SELECT_BASE =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, City, StreetNumber, StreetName, PhotoURL, StandardStatus, details, ModificationTimestamp'

/** Production `listings` is RESO-shaped (PascalCase). Do not select snake_case mirrors unless a migration added them. */
const LISTING_VIDEO_SELECT_MAIN = `${LISTING_VIDEO_SELECT_BASE}, has_virtual_tour`

const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

function rowCity(row: Record<string, unknown>): string | null {
  const v = row.City ?? row.city
  return v != null && String(v).trim() ? String(v).trim() : null
}

function rowSubdivision(row: Record<string, unknown>): string | null {
  const v = row.SubdivisionName ?? row.subdivision_name
  return v != null && String(v).trim() ? String(v).trim() : null
}

function rowListPrice(row: Record<string, unknown>): number | null {
  const p = row.ListPrice ?? row.list_price
  if (p == null) return null
  const n = typeof p === 'number' ? p : Number(p)
  return Number.isFinite(n) ? n : null
}

function rowMeetsStatusFilter(row: Record<string, unknown>, statusAll: boolean): boolean {
  if (statusAll) return true
  const s = String(row.StandardStatus ?? row.standard_status ?? '').trim().toLowerCase()
  return (
    s.length === 0 ||
    s.includes('active') ||
    s.includes('for sale') ||
    s.includes('coming soon')
  )
}

function unparsedFromRow(row: Record<string, unknown>): string | null {
  const u = row.unparsed_address
  if (u != null && String(u).trim()) return String(u).trim()
  const line = [row.StreetNumber, row.StreetName]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  return line || null
}

function rowInCitiesList(row: Record<string, unknown>, citiesLower: Set<string>): boolean {
  const c = rowCity(row)
  if (!c) return false
  return citiesLower.has(c.toLowerCase())
}

/**
 * Prefer small listing_videos + keyed listing lookups over scanning hundreds of listings (home page, /videos).
 */
async function getListingsWithVideosFromListingVideosTable(
  supabase: ReturnType<typeof getSupabase>,
  maxRows: number,
  priceDesc: boolean,
  /** When set, only keep rows whose listing city is in this set (lowercase city names). */
  citiesLower: Set<string> | null = null
): Promise<VideoListingRow[]> {
  const lvLimit = citiesLower != null && citiesLower.size > 0 ? 400 : 150
  const { data: lvRows, error: lvErr } = await supabase
    .from('listing_videos')
    .select('listing_key, video_url')
    .order('created_at', { ascending: false })
    .limit(lvLimit)

  if (lvErr) {
    console.error('[getListingsWithVideos] listing_videos fast path', lvErr)
    return []
  }
  if (!lvRows?.length) return []

  const urlByKey = new Map<string, string>()
  for (const lv of lvRows) {
    const lk = String((lv as { listing_key?: string }).listing_key ?? '').trim()
    const vu = String((lv as { video_url?: string }).video_url ?? '').trim()
    if (lk && vu && !urlByKey.has(lk)) urlByKey.set(lk, vu)
  }
  const keys = [...urlByKey.keys()]
  if (keys.length === 0) return []

  const byKey = new Map<string, Record<string, unknown>>()
  const chunkSize = 40
  const slices: string[][] = []
  for (let i = 0; i < keys.length; i += chunkSize) {
    slices.push(keys.slice(i, i + chunkSize))
  }
  // Fetch by key only; filter active status in memory. Combining .in(ListingKey) with .or(ACTIVE_STATUS_OR)
  // in PostgREST can drop rows that should match, leaving the fast path empty while legacy paths still work.
  const chunkResults = await Promise.all(
    slices.map((slice) => supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN).in('ListingKey', slice))
  )
  for (const ea of chunkResults) {
    if (ea.error && !/column|ListingKey/i.test(ea.error.message ?? '')) {
      console.error('[getListingsWithVideos] fast path ListingKey', ea.error)
    }
    for (const row of ea.data ?? []) {
      const rec = row as Record<string, unknown>
      const k = resolveListingKeyFromRow(rec)
      if (k && !byKey.has(k)) byKey.set(k, rec)
    }
  }

  const rows: VideoListingRow[] = []
  for (const lk of keys) {
    const rec = byKey.get(lk)
    const vurl = urlByKey.get(lk)
    if (!rec || !vurl) continue
    if (!rowMeetsStatusFilter(rec, false)) continue
    if (citiesLower && !rowInCitiesList(rec, citiesLower)) continue

    rows.push({
      listing_key: lk,
      list_number: (rec.ListNumber ?? rec.list_number ?? null) as string | null,
      list_price: rowListPrice(rec),
      beds_total: (rec.BedroomsTotal ?? rec.beds_total) as number | null,
      baths_full: (rec.BathroomsTotal ?? rec.baths_full) as number | null,
      living_area: (rec.TotalLivingAreaSqFt ?? rec.living_area) as number | null,
      subdivision_name: rowSubdivision(rec),
      city: rowCity(rec),
      unparsed_address: unparsedFromRow(rec),
      photo_url: (rec.PhotoURL ?? rec.photo_url) as string | null,
      video_url: vurl,
      video_source: 'listing_video',
    })
  }

  if (priceDesc) {
    rows.sort((a, b) => (b.list_price ?? 0) - (a.list_price ?? 0))
  }
  return rows.slice(0, maxRows)
}

function resolveVideoCitiesList(filters?: {
  region?: 'central_oregon'
  cities?: string[]
  city?: string
}): string[] | null {
  if (filters?.region === 'central_oregon') {
    return [...MARKET_REPORT_DEFAULT_CITIES]
  }
  if (filters?.cities?.length) {
    return [...new Set(filters.cities.map((c) => c.trim()).filter(Boolean))]
  }
  if (filters?.city?.trim()) {
    return [filters.city.trim()]
  }
  return null
}

export async function getListingsWithVideos(filters?: {
  community?: string
  city?: string
  /** When set, uses the same Central Oregon city list as market reports (Bend, Redmond, Sisters, …). */
  region?: 'central_oregon'
  cities?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'most_viewed' | 'price_desc'
  status?: 'active' | 'all'
  limit?: number
}): Promise<VideoListingRow[]> {
  const supabase = getSupabase()
  const maxRows = Math.min(Math.max(filters?.limit ?? 24, 1), 60)
  const candidateLimit = Math.min(Math.max(maxRows * 25, 200), 900)
  const statusAll = filters?.status === 'all'
  const citiesList = resolveVideoCitiesList(filters)
  const citiesLowerForFilter =
    citiesList && citiesList.length > 0 ? new Set(citiesList.map((c) => c.toLowerCase())) : null

  // Home uses region + price_desc. The price-first ListPrice walk often hits statement_timeout on large
  // listings tables; try listing_videos + keyed lookups first. If that yields nothing, fall through
  // (legacy listing_videos + listings merge) instead of awaiting another doomed full scan.
  if (citiesList && citiesList.length > 0 && filters?.sort === 'price_desc') {
    const fromVideos = await getListingsWithVideosFromListingVideosTable(
      supabase,
      maxRows,
      true,
      citiesLowerForFilter
    )
    if (fromVideos.length > 0) {
      return fromVideos.slice(0, maxRows)
    }
  }

  const geoOrPriceScoped =
    Boolean(filters?.city?.trim()) ||
    Boolean(filters?.community?.trim()) ||
    Boolean(filters?.cities?.length) ||
    filters?.region === 'central_oregon' ||
    filters?.minPrice != null ||
    filters?.maxPrice != null

  if (!geoOrPriceScoped && !statusAll) {
    const fastRows = await getListingsWithVideosFromListingVideosTable(
      supabase,
      maxRows,
      filters?.sort === 'price_desc'
    )
    if (fastRows.length > 0) {
      return fastRows
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFiltersAndOrder(q: any) {
    let query = q
    if (!statusAll) {
      query = query.or(ACTIVE_STATUS_OR)
    }
    if (filters?.sort === 'price_desc') {
      query = query.order('ListPrice', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    }
    return query.limit(candidateLimit)
  }

  const seenKeys = new Set<string>()
  const listRows: Array<Record<string, unknown>> = []

  let tourQ = supabase.from('listings').select(`${LISTING_VIDEO_SELECT_MAIN}`).eq('has_virtual_tour', true)
  if (citiesList?.length) {
    tourQ = tourQ.in('City', citiesList)
  }
  const tourRes = await applyFiltersAndOrder(tourQ)
  const tourErr = tourRes.error?.message ?? ''
  if (!tourRes.error && Array.isArray(tourRes.data) && tourRes.data.length > 0) {
    for (const row of tourRes.data as Array<Record<string, unknown>>) {
      const k = resolveListingKeyFromRow(row)
      if (!k || seenKeys.has(k)) continue
      seenKeys.add(k)
      listRows.push(row)
    }
  } else if (tourRes.error && !/has_virtual_tour|column/i.test(tourErr)) {
    console.error('[getListingsWithVideos] has_virtual_tour query', tourRes.error)
  }

  if (listRows.length < candidateLimit) {
    let broadQ = supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN)
    if (citiesList?.length) {
      broadQ = broadQ.in('City', citiesList)
    }
    const broadRes = await applyFiltersAndOrder(broadQ)
    if (broadRes.error) {
      console.error('[getListingsWithVideos] broad query', broadRes.error)
    } else {
      for (const row of (broadRes.data ?? []) as Array<Record<string, unknown>>) {
        const k = resolveListingKeyFromRow(row)
        if (!k || seenKeys.has(k)) continue
        seenKeys.add(k)
        listRows.push(row)
        if (listRows.length >= candidateLimit) break
      }
    }
  }

  const rows: VideoListingRow[] = []
  for (const row of listRows) {
    const r = row as Record<string, unknown>
    const listingKey = resolveListingKeyFromRow(r)
    if (!listingKey) continue

    const video = pickFirstVideoFromListingRow(r)
    if (!video) continue

    if (!rowMeetsStatusFilter(r, statusAll)) continue
    if (filters?.community && rowSubdivision(r) !== filters.community) continue
    if (citiesLowerForFilter && !rowInCitiesList(r, citiesLowerForFilter)) continue
    const price = rowListPrice(r)
    if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
    if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue

    rows.push({
      listing_key: listingKey,
      list_number: (r.ListNumber ?? r.list_number ?? null) as string | null,
      list_price: price,
      beds_total: (r.BedroomsTotal ?? r.beds_total ?? null) as number | null,
      baths_full: (r.BathroomsTotal ?? r.baths_full ?? null) as number | null,
      living_area: (r.TotalLivingAreaSqFt ?? r.living_area ?? null) as number | null,
      subdivision_name: rowSubdivision(r),
      city: rowCity(r),
      unparsed_address: unparsedFromRow(r),
      photo_url: (r.PhotoURL ?? r.photo_url ?? null) as string | null,
      video_url: video.url,
      video_source: video.source,
    })
  }

  if (rows.length < maxRows) {
    const existingKeys = new Set(rows.map((x) => x.listing_key))
    const { data: lvRows, error: lvErr } = await supabase
      .from('listing_videos')
      .select('listing_key, video_url')
      .order('created_at', { ascending: false })
      .limit(180)
    if (lvErr) {
      console.error('[getListingsWithVideos] listing_videos', lvErr)
    } else {
      const urlByListing = new Map<string, string>()
      for (const lv of lvRows ?? []) {
        const lk = String((lv as { listing_key?: string }).listing_key ?? '').trim()
        const vu = String((lv as { video_url?: string }).video_url ?? '').trim()
        if (lk && vu && !urlByListing.has(lk)) urlByListing.set(lk, vu)
      }
      const missingKeys = [...urlByListing.keys()].filter((k) => !existingKeys.has(k)).slice(0, 80)
      if (missingKeys.length > 0) {
        const selExtra = LISTING_VIDEO_SELECT_MAIN
        const ea = await supabase.from('listings').select(selExtra).in('ListingKey', missingKeys)
        const byKey = new Map<string, Record<string, unknown>>()
        for (const row of ea.data ?? []) {
          const rec = row as Record<string, unknown>
          const k = resolveListingKeyFromRow(rec)
          if (k && !byKey.has(k)) byKey.set(k, rec)
        }
        for (const lk of missingKeys) {
          if (rows.length >= maxRows) break
          const rec = byKey.get(lk)
          const vurl = urlByListing.get(lk)
          if (!rec || !vurl) continue
          if (!rowMeetsStatusFilter(rec, statusAll)) continue
          if (filters?.community && rowSubdivision(rec) !== filters.community) continue
          if (citiesLowerForFilter && !rowInCitiesList(rec, citiesLowerForFilter)) continue
          const price = rowListPrice(rec)
          if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
          if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue
          rows.push({
            listing_key: lk,
            list_number: (rec.ListNumber ?? rec.list_number ?? null) as string | null,
            list_price: price,
            beds_total: (rec.BedroomsTotal ?? rec.beds_total) as number | null,
            baths_full: (rec.BathroomsTotal ?? rec.baths_full) as number | null,
            living_area: (rec.TotalLivingAreaSqFt ?? rec.living_area) as number | null,
            subdivision_name: rowSubdivision(rec),
            city: rowCity(rec),
            unparsed_address: unparsedFromRow(rec),
            photo_url: (rec.PhotoURL ?? rec.photo_url) as string | null,
            video_url: vurl,
            video_source: 'listing_video',
          })
          existingKeys.add(lk)
        }
      }
    }
  }

  if (rows.length === 0) {
    const { data: legacyVideos } = await supabase
      .from('listing_videos')
      .select('listing_key, video_url')
      .limit(candidateLimit)
    const legacyVideoByKey = new Map(
      (legacyVideos ?? []).map((r) => [
        String((r as { listing_key?: string }).listing_key ?? '').trim(),
        String((r as { video_url?: string }).video_url ?? '').trim(),
      ])
    )

    let legacyQuery = supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN).limit(candidateLimit)
    if (citiesList?.length) {
      legacyQuery = legacyQuery.in('City', citiesList)
    }
    if (!statusAll) {
      legacyQuery = legacyQuery.or(ACTIVE_STATUS_OR)
    }
    if (filters?.sort === 'price_desc') {
      legacyQuery = legacyQuery.order('ListPrice', { ascending: false, nullsFirst: false })
    } else {
      legacyQuery = legacyQuery.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    }
    const { data: legacyListings, error: legacyErr } = await legacyQuery
    if (legacyErr) {
      console.error('[getListingsWithVideos] legacy listings', legacyErr)
    }

    for (const row of legacyListings ?? []) {
      const r = row as Record<string, unknown>
      const listingKey = resolveListingKeyFromRow(r)
      if (!listingKey) continue

      if (!rowMeetsStatusFilter(r, statusAll)) continue

      if (filters?.community && rowSubdivision(r) !== filters.community) continue
      if (citiesLowerForFilter && !rowInCitiesList(r, citiesLowerForFilter)) continue
      const price = rowListPrice(r)
      if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
      if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue

      const fromDetails = pickFirstVideoFromListingRow(r)
      const videoUrl = legacyVideoByKey.get(listingKey) || fromDetails?.url || ''
      if (!videoUrl.trim()) continue
      rows.push({
        listing_key: listingKey,
        list_number: (r.ListNumber ?? r.list_number ?? null) as string | null,
        list_price: price,
        beds_total: (r.BedroomsTotal ?? r.beds_total ?? null) as number | null,
        baths_full: (r.BathroomsTotal ?? r.baths_full ?? null) as number | null,
        living_area: (r.TotalLivingAreaSqFt ?? r.living_area ?? null) as number | null,
        subdivision_name: rowSubdivision(r),
        city: rowCity(r),
        unparsed_address: unparsedFromRow(r),
        photo_url: (r.PhotoURL ?? r.photo_url ?? null) as string | null,
        video_url: videoUrl.trim(),
        video_source: legacyVideoByKey.has(listingKey) ? 'listing_video' : (fromDetails?.source ?? 'virtual_tour'),
      })
    }
  }

  if (filters?.sort === 'price_desc') {
    rows.sort((a, b) => (b.list_price ?? 0) - (a.list_price ?? 0))
  }
  return rows.slice(0, maxRows)
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
    return getListingsWithVideos({ ...base, region: 'central_oregon' })
  }
  if (citiesOrRegionKey?.startsWith('cities:')) {
    try {
      const parsed = JSON.parse(citiesOrRegionKey.slice('cities:'.length)) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return getListingsWithVideos({ ...base, cities: parsed })
      }
    } catch {
      /* fall through */
    }
  }
  return getListingsWithVideos(base)
}

const _getListingsWithVideosCached = unstable_cache(
  _getListingsWithVideosCachedUncached,
  ['listings-with-videos-v8'],
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
