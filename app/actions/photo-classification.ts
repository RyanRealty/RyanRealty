'use server'

import { createClient } from '@supabase/supabase-js'
import { classifyListingPhoto, type PhotoTag } from '../../lib/photo-classification'
import type { SparkPhoto } from '../../lib/spark'

const HERO_PREFERRED_TAGS: PhotoTag[] = [
  'exterior_front',
  'aerial_drone',
  'view_mountain',
  'view_water',
  'view_forest',
  'pool_outdoor_living',
]

export type RunClassificationResult = {
  success: boolean
  message: string
  listingKey?: string
  photosProcessed?: number
  photosClassified?: number
  error?: string
}

/**
 * Get photo URL from Spark photo object (prefer 1600 then 800 then 640).
 */
function photoToUrl(p: SparkPhoto): string | null {
  const url = p.Uri1600 ?? p.Uri800 ?? p.Uri640 ?? p.Uri1024 ?? p.Uri1280 ?? p.UriLarge ?? null
  return url?.trim() || null
}

/**
 * Run photo classification for one listing: read details.Photos, call Vision API per photo, upsert listing_photo_classifications.
 * If OPENAI_API_KEY is not set, skips classification and returns success with photosProcessed 0.
 */
export async function runClassificationForListing(listingKey: string): Promise<RunClassificationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { success: false, message: 'Supabase not configured.', error: 'Missing env' }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: row, error: fetchError } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, details')
    .or(`ListingKey.eq.${listingKey},ListNumber.eq.${listingKey}`)
    .maybeSingle()

  if (fetchError || !row) {
    return {
      success: false,
      message: fetchError?.message ?? 'Listing not found.',
      listingKey,
      error: fetchError?.message ?? 'Not found',
    }
  }

  const key = (row as { ListingKey?: string | null; ListNumber?: string | null }).ListingKey
    ?? (row as { ListNumber?: string | null }).ListNumber
    ?? listingKey
  const details = (row as { details?: { Photos?: SparkPhoto[] } }).details
  const photos = details?.Photos ?? []
  if (photos.length === 0) {
    return { success: true, message: 'No photos to classify.', listingKey: key, photosProcessed: 0, photosClassified: 0 }
  }

  let classified = 0
  for (let i = 0; i < photos.length; i++) {
    const url = photoToUrl(photos[i])
    if (!url) continue
    const result = await classifyListingPhoto(url)
    if (!result) continue
    const { error: upsertError } = await supabase.from('listing_photo_classifications').upsert(
      {
        listing_key: key,
        photo_index: i,
        photo_url: url,
        tags: result.tags,
        quality_score: result.qualityScore,
      },
      { onConflict: 'listing_key,photo_index' }
    )
    if (!upsertError) classified++
  }

  return {
    success: true,
    message: `Classified ${classified} of ${photos.length} photos.`,
    listingKey: key,
    photosProcessed: photos.length,
    photosClassified: classified,
  }
}

export type BestListingHeroResult = { url: string; attribution?: string } | null

/**
 * Best hero image for a city (and optional subdivision) from active listings' classified photos.
 * Prefers exterior_front, aerial_drone, views, pool; orders by quality_score. Returns null if none.
 */
export async function getBestListingHeroForGeography(
  city: string,
  subdivision?: string | null
): Promise<BestListingHeroResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim() || !anonKey?.trim()) return null

  const supabase = createClient(supabaseUrl, anonKey)

  const listingKeysQuery = supabase
    .from('listings')
    .select('ListingKey, ListNumber')
    .ilike('City', city.trim())
  const withSub = subdivision?.trim()
  if (withSub) {
    listingKeysQuery.ilike('SubdivisionName', withSub)
  }
  listingKeysQuery.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
  const { data: listingRows } = await listingKeysQuery.limit(500)

  const keys = new Set<string>()
  for (const r of listingRows ?? []) {
    const row = r as { ListingKey?: string | null; ListNumber?: string | null }
    const k = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
    if (k) keys.add(k)
  }
  if (keys.size === 0) return null

  const { data: classifications } = await supabase
    .from('listing_photo_classifications')
    .select('photo_url, quality_score, tags')
    .in('listing_key', [...keys])
    .not('photo_url', 'is', null)
    .order('quality_score', { ascending: false })
    .limit(100)

  const rows = (classifications ?? []) as { photo_url: string; quality_score: number; tags?: string[] }[]
  const withHeroTag = rows.filter((r) =>
    (r.tags ?? []).some((t) => HERO_PREFERRED_TAGS.includes(t as PhotoTag))
  )
  const best = withHeroTag.length > 0 ? withHeroTag[0] : rows[0]
  if (best?.photo_url) return { url: best.photo_url, attribution: 'Listing photo' }
  return null
}
