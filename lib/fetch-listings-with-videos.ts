/**
 * Full video listing resolution (listing_videos table + has_virtual_tour + details JSON).
 * Used by server actions and by the video_tours_cache cron (any Supabase client with read access).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { pickFirstVideoFromListingRow, resolveListingKeyFromRow } from '@/lib/pick-video-from-details'
import type { VideoListingRowShape } from '@/lib/video-tours-listing-videos-join'
import {
  LISTING_VIDEO_SELECT_MAIN,
  fetchVideoRowsViaListingVideosJoin,
  rowCity,
  rowInCitiesList,
  rowListPrice,
  rowMeetsStatusFilter,
  rowSubdivision,
  unparsedFromRow,
} from '@/lib/video-tours-listing-videos-join'

const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

export type FetchListingsWithVideosFilters = {
  community?: string
  city?: string
  region?: 'central_oregon'
  cities?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'most_viewed' | 'price_desc'
  status?: 'active' | 'all'
  limit?: number
}

function resolveVideoCitiesList(filters?: FetchListingsWithVideosFilters): string[] | null {
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

export async function fetchListingsWithVideos(
  supabase: SupabaseClient,
  filters?: FetchListingsWithVideosFilters
): Promise<VideoListingRowShape[]> {
  const maxRows = Math.min(Math.max(filters?.limit ?? 24, 1), 60)
  const candidateLimit = Math.min(Math.max(maxRows * 25, 200), 900)
  const statusAll = filters?.status === 'all'
  const citiesList = resolveVideoCitiesList(filters)
  const citiesLowerForFilter =
    citiesList && citiesList.length > 0 ? new Set(citiesList.map((c) => c.toLowerCase())) : null

  if (citiesList && citiesList.length > 0 && filters?.sort === 'price_desc') {
    const fromVideos = await fetchVideoRowsViaListingVideosJoin(supabase, {
      maxRows,
      priceDesc: true,
      citiesLower: citiesLowerForFilter,
    })
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
    const fastRows = await fetchVideoRowsViaListingVideosJoin(supabase, {
      maxRows,
      priceDesc: filters?.sort === 'price_desc',
      citiesLower: null,
    })
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

  void supabase
  void applyFiltersAndOrder
  const { getListingVideoCandidates } = await import('@/lib/data')
  // 1) listings with has_virtual_tour=true
  const tourRows = await getListingVideoCandidates({
    withVirtualTour: true,
    cities: citiesList,
    statusAll,
    sort: filters?.sort === 'price_desc' ? 'price_desc' : 'newest',
    limit: candidateLimit,
  })
  for (const row of tourRows) {
    const k = resolveListingKeyFromRow(row)
    if (!k || seenKeys.has(k)) continue
    seenKeys.add(k)
    listRows.push(row)
  }

  if (listRows.length < candidateLimit) {
    // 2) broad listings query (newest or price_desc)
    const broadRows = await getListingVideoCandidates({
      cities: citiesList,
      statusAll,
      sort: filters?.sort === 'price_desc' ? 'price_desc' : 'newest',
      limit: candidateLimit,
    })
    for (const row of broadRows) {
      const k = resolveListingKeyFromRow(row)
      if (!k || seenKeys.has(k)) continue
      seenKeys.add(k)
      listRows.push(row)
      if (listRows.length >= candidateLimit) break
    }
  }

  const rows: VideoListingRowShape[] = []
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
    const { getRecentListingVideoRows } = await import('@/lib/data')
    const lvRows = await getRecentListingVideoRows(180)
    {
      const urlByListing = new Map<string, string>()
      for (const lv of lvRows) {
        const lk = String(lv.listing_key ?? '').trim()
        const vu = String(lv.video_url ?? '').trim()
        if (lk && vu && !urlByListing.has(lk)) urlByListing.set(lk, vu)
      }
      const missingKeys = [...urlByListing.keys()].filter((k) => !existingKeys.has(k)).slice(0, 80)
      if (missingKeys.length > 0) {
        const { getListingVideoCandidates } = await import('@/lib/data')
        const eaData = await getListingVideoCandidates({ byKeys: missingKeys, limit: 200 })
        const byKey = new Map<string, Record<string, unknown>>()
        for (const row of eaData) {
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
    void ACTIVE_STATUS_OR
    const { getAnyListingVideoRows, getListingVideoCandidates } = await import('@/lib/data')
    const legacyVideos = await getAnyListingVideoRows(candidateLimit)
    const legacyVideoByKey = new Map(
      legacyVideos.map((r) => [
        String(r.listing_key ?? '').trim(),
        String(r.video_url ?? '').trim(),
      ])
    )

    const legacyListings = await getListingVideoCandidates({
      cities: citiesList,
      statusAll,
      sort: filters?.sort === 'price_desc' ? 'price_desc' : 'newest',
      limit: candidateLimit,
    })
    const legacyErr: { message: string } | null = null
    if (legacyErr) {
      console.error('[fetchListingsWithVideos] legacy listings', legacyErr)
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
