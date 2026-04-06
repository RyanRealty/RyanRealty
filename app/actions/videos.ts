'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import {
  pickFirstVideoFromDetails,
  pickFirstVideoFromListingRow,
  resolveListingKeyFromRow,
} from '@/lib/pick-video-from-details'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type VideoListingRow = {
  listing_key: string
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
  'ListingKey, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, City, StreetNumber, StreetName, PhotoURL, StandardStatus, details, ModificationTimestamp'

const LISTING_VIDEO_SELECT_MAIN = `${LISTING_VIDEO_SELECT_BASE}, listing_key, virtual_tour_url, has_virtual_tour, list_price, beds_total, baths_full, living_area, subdivision_name, city, photo_url, standard_status`

const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

function hasVideoFromDetailsOrTourColumn(row: Record<string, unknown>): boolean {
  if (pickFirstVideoFromDetails(row.details)) return true
  const vt = String(row.virtual_tour_url ?? row.VirtualTourURL ?? row.VirtualTourURLUnbranded ?? '').trim()
  return !!vt
}

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

/**
 * Prefer small listing_videos + keyed listing lookups over scanning hundreds of listings (home page, /videos).
 */
async function getListingsWithVideosFromListingVideosTable(
  supabase: ReturnType<typeof getSupabase>,
  maxRows: number,
  priceDesc: boolean
): Promise<VideoListingRow[]> {
  const { data: lvRows, error: lvErr } = await supabase
    .from('listing_videos')
    .select('listing_key, video_url')
    .order('created_at', { ascending: false })
    .limit(150)

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
  for (let i = 0; i < keys.length; i += chunkSize) {
    const slice = keys.slice(i, i + chunkSize)
    const [ea, eb] = await Promise.all([
      supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN).or(ACTIVE_STATUS_OR).in('ListingKey', slice),
      supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN).or(ACTIVE_STATUS_OR).in('listing_key', slice),
    ])
    if (ea.error && !/column|ListingKey/i.test(ea.error.message ?? '')) {
      console.error('[getListingsWithVideos] fast path ListingKey', ea.error)
    }
    if (eb.error && !/column|listing_key/i.test(eb.error.message ?? '')) {
      console.error('[getListingsWithVideos] fast path listing_key', eb.error)
    }
    for (const row of [...(ea.data ?? []), ...(eb.data ?? [])]) {
      const rec = row as Record<string, unknown>
      const k = resolveListingKeyFromRow(rec)
      if (k && !byKey.has(k)) byKey.set(k, rec)
    }
  }

  const rows: VideoListingRow[] = []
  for (const lk of keys) {
    if (rows.length >= maxRows) break
    const rec = byKey.get(lk)
    const vurl = urlByKey.get(lk)
    if (!rec || !vurl) continue
    if (!rowMeetsStatusFilter(rec, false)) continue

    rows.push({
      listing_key: lk,
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

export async function getListingsWithVideos(filters?: {
  community?: string
  city?: string
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

  const geoOrPriceScoped =
    Boolean(filters?.city?.trim()) ||
    Boolean(filters?.community?.trim()) ||
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

  const tourRes = await applyFiltersAndOrder(
    supabase.from('listings').select(`${LISTING_VIDEO_SELECT_MAIN}`).eq('has_virtual_tour', true)
  )
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
    const broadRes = await applyFiltersAndOrder(supabase.from('listings').select(LISTING_VIDEO_SELECT_MAIN))
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

  const keysForRawProbe = [
    ...new Set(
      listRows
        .filter((row) => {
          const r = row as Record<string, unknown>
          return !hasVideoFromDetailsOrTourColumn(r) && !!resolveListingKeyFromRow(r)
        })
        .map((row) => resolveListingKeyFromRow(row as Record<string, unknown>))
    ),
  ].slice(0, 100)

  const rawDataByKey = new Map<string, unknown>()
  if (keysForRawProbe.length > 0) {
    const selRaw = 'ListingKey, listing_key, raw_data'
    const [ra, rb] = await Promise.all([
      supabase.from('listings').select(selRaw).in('ListingKey', keysForRawProbe),
      supabase.from('listings').select(selRaw).in('listing_key', keysForRawProbe),
    ])
    if (ra.error && !/column|raw_data/i.test(ra.error.message ?? '')) {
      console.error('[getListingsWithVideos] raw_data ListingKey', ra.error)
    }
    if (rb.error && !/column|raw_data/i.test(rb.error.message ?? '')) {
      console.error('[getListingsWithVideos] raw_data listing_key', rb.error)
    }
    for (const row of [...(ra.data ?? []), ...(rb.data ?? [])]) {
      const r = row as Record<string, unknown>
      const k = resolveListingKeyFromRow(r)
      if (k && r.raw_data != null && !rawDataByKey.has(k)) rawDataByKey.set(k, r.raw_data)
    }
  }

  const rows: VideoListingRow[] = []
  for (const row of listRows) {
    const r = row as Record<string, unknown>
    const listingKey = resolveListingKeyFromRow(r)
    if (!listingKey) continue

    const rawMerged = { ...r, raw_data: rawDataByKey.get(listingKey) ?? r.raw_data }
    const video = pickFirstVideoFromListingRow(rawMerged)
    if (!video) continue

    if (!rowMeetsStatusFilter(r, statusAll)) continue
    if (filters?.community && rowSubdivision(r) !== filters.community) continue
    if (filters?.city && rowCity(r) !== filters.city) continue
    const price = rowListPrice(r)
    if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
    if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue

    rows.push({
      listing_key: listingKey,
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
        const [ea, eb] = await Promise.all([
          supabase.from('listings').select(selExtra).in('ListingKey', missingKeys),
          supabase.from('listings').select(selExtra).in('listing_key', missingKeys),
        ])
        const byKey = new Map<string, Record<string, unknown>>()
        for (const row of [...(ea.data ?? []), ...(eb.data ?? [])]) {
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
          if (filters?.city && rowCity(rec) !== filters.city) continue
          const price = rowListPrice(rec)
          if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
          if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue
          rows.push({
            listing_key: lk,
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

    const { data: legacyListings } = await supabase
      .from('listings')
      .select(
        'listing_key, list_price, beds_total, baths_full, living_area, subdivision_name, city, unparsed_address, photo_url, virtual_tour_url, standard_status, modification_timestamp'
      )
      .limit(candidateLimit)

    for (const row of legacyListings ?? []) {
      const r = row as {
        listing_key?: string | null
        list_price?: number | null
        beds_total?: number | null
        baths_full?: number | null
        living_area?: number | null
        subdivision_name?: string | null
        city?: string | null
        unparsed_address?: string | null
        photo_url?: string | null
        virtual_tour_url?: string | null
        standard_status?: string | null
      }
      const listingKey = String(r.listing_key ?? '').trim()
      if (!listingKey) continue

      if (!statusAll) {
        const status = String(r.standard_status ?? '').toLowerCase()
        const isActive =
          status.length === 0 ||
          status.includes('active') ||
          status.includes('for sale') ||
          status.includes('coming soon')
        if (!isActive) continue
      }

      if (filters?.community && r.subdivision_name !== filters.community) continue
      if (filters?.city && r.city !== filters.city) continue
      const price = r.list_price ?? null
      if (filters?.minPrice != null && (price == null || price < filters.minPrice)) continue
      if (filters?.maxPrice != null && (price == null || price > filters.maxPrice)) continue

      const videoUrl = legacyVideoByKey.get(listingKey) || String(r.virtual_tour_url ?? '').trim()
      if (!videoUrl) continue
      rows.push({
        listing_key: listingKey,
        list_price: price,
        beds_total: r.beds_total ?? null,
        baths_full: r.baths_full ?? null,
        living_area: r.living_area ?? null,
        subdivision_name: r.subdivision_name ?? null,
        city: r.city ?? null,
        unparsed_address: r.unparsed_address ?? null,
        photo_url: r.photo_url ?? null,
        video_url: videoUrl,
        video_source: legacyVideoByKey.has(listingKey) ? 'listing_video' : 'virtual_tour',
      })
    }
  }

  if (filters?.sort === 'price_desc') {
    rows.sort((a, b) => (b.list_price ?? 0) - (a.list_price ?? 0))
  }
  return rows.slice(0, maxRows)
}

async function _getListingsWithVideosCachedUncached(
  city: string | null,
  community: string | null,
  sort: 'newest' | 'most_viewed' | 'price_desc',
  status: 'active' | 'all',
  limit: number
): Promise<VideoListingRow[]> {
  return getListingsWithVideos({
    city: city ?? undefined,
    community: community ?? undefined,
    sort,
    status,
    limit,
  })
}

const _getListingsWithVideosCached = unstable_cache(
  _getListingsWithVideosCachedUncached,
  ['listings-with-videos-v2'],
  { revalidate: 300, tags: ['listings-videos'] }
)

export async function getListingsWithVideosCached(filters?: {
  community?: string
  city?: string
  sort?: 'newest' | 'most_viewed' | 'price_desc'
  status?: 'active' | 'all'
  limit?: number
}): Promise<VideoListingRow[]> {
  return _getListingsWithVideosCached(
    filters?.city?.trim() || null,
    filters?.community?.trim() || null,
    filters?.sort ?? 'newest',
    filters?.status ?? 'active',
    Math.min(Math.max(filters?.limit ?? 24, 1), 60)
  )
}
