/**
 * Join `listing_videos` to `listings` by ListingKey for fast video hub queries.
 * Shared by `app/actions/videos.ts` and the video tours cache cron (no 'use server').
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveListingKeyFromRow } from '@/lib/pick-video-from-details'

export const LISTING_VIDEO_SELECT_MAIN =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, City, StreetNumber, StreetName, PhotoURL, StandardStatus, details, ModificationTimestamp, has_virtual_tour, year_built, price_per_sqft'

export type VideoListingRowShape = {
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

export function rowCity(row: Record<string, unknown>): string | null {
  const v = row.City ?? row.city
  return v != null && String(v).trim() ? String(v).trim() : null
}

export function rowSubdivision(row: Record<string, unknown>): string | null {
  const v = row.SubdivisionName ?? row.subdivision_name
  return v != null && String(v).trim() ? String(v).trim() : null
}

export function rowListPrice(row: Record<string, unknown>): number | null {
  const p = row.ListPrice ?? row.list_price
  if (p == null) return null
  const n = typeof p === 'number' ? p : Number(p)
  return Number.isFinite(n) ? n : null
}

export function rowMeetsStatusFilter(row: Record<string, unknown>, statusAll: boolean): boolean {
  if (statusAll) return true
  const s = String(row.StandardStatus ?? row.standard_status ?? '').trim().toLowerCase()
  return (
    s.length === 0 ||
    s.includes('active') ||
    s.includes('for sale') ||
    s.includes('coming soon')
  )
}

export function unparsedFromRow(row: Record<string, unknown>): string | null {
  const u = row.unparsed_address
  if (u != null && String(u).trim()) return String(u).trim()
  const line = [row.StreetNumber, row.StreetName]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  return line || null
}

export function rowInCitiesList(row: Record<string, unknown>, citiesLower: Set<string>): boolean {
  const c = rowCity(row)
  if (!c) return false
  return citiesLower.has(c.toLowerCase())
}

export type FetchVideoRowsViaListingVideosJoinOpts = {
  maxRows: number
  priceDesc: boolean
  citiesLower: Set<string> | null
  /** Max rows read from listing_videos (newest first). Higher = better coverage for hub. */
  listingVideosLimit?: number
}

export async function fetchVideoRowsViaListingVideosJoin(
  supabase: SupabaseClient,
  opts: FetchVideoRowsViaListingVideosJoinOpts
): Promise<VideoListingRowShape[]> {
  const { maxRows, priceDesc, citiesLower } = opts
  const lvLimit =
    opts.listingVideosLimit ??
    (citiesLower != null && citiesLower.size > 0 ? 400 : 150)

  void supabase
  const { getRecentListingVideoRows, getListingVideoCandidates } = await import('@/lib/data')
  const lvRows = await getRecentListingVideoRows(lvLimit)
  if (!lvRows.length) return []

  const urlByKey = new Map<string, string>()
  for (const lv of lvRows) {
    const lk = String(lv.listing_key ?? '').trim()
    const vu = String(lv.video_url ?? '').trim()
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
  const chunkResults = await Promise.all(
    slices.map((slice) => getListingVideoCandidates({ byKeys: slice, limit: slice.length }))
  )
  for (const eaData of chunkResults) {
    for (const row of eaData) {
      const rec = row as Record<string, unknown>
      const k = resolveListingKeyFromRow(rec)
      if (k && !byKey.has(k)) byKey.set(k, rec)
    }
  }

  const rows: VideoListingRowShape[] = []
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

function isVideoSource(v: unknown): v is 'virtual_tour' | 'listing_video' {
  return v === 'virtual_tour' || v === 'listing_video'
}

function numField(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Parse JSONB from video_tours_cache into typed rows (drops invalid entries). */
export function parseVideoListingRowsFromCacheJson(raw: unknown): VideoListingRowShape[] {
  if (!Array.isArray(raw)) return []
  const out: VideoListingRowShape[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const listing_key = String(o.listing_key ?? '').trim()
    const video_url = String(o.video_url ?? '').trim()
    if (!listing_key || !video_url) continue
    const src = o.video_source
    if (!isVideoSource(src)) continue
    out.push({
      listing_key,
      list_number: o.list_number != null ? String(o.list_number) : null,
      list_price: numField(o.list_price),
      beds_total: numField(o.beds_total),
      baths_full: numField(o.baths_full),
      living_area: numField(o.living_area),
      subdivision_name: o.subdivision_name != null ? String(o.subdivision_name) : null,
      city: o.city != null ? String(o.city) : null,
      unparsed_address: o.unparsed_address != null ? String(o.unparsed_address) : null,
      photo_url: o.photo_url != null ? String(o.photo_url) : null,
      video_url,
      video_source: src,
    })
  }
  return out
}
