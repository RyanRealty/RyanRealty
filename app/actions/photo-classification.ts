'use server'

import { createClient } from '@supabase/supabase-js'
import type { PhotoTag } from '../../lib/photo-classification'
import { getCityListings, getCommunityListings } from '@/lib/data'

const HERO_PREFERRED_TAGS: PhotoTag[] = [
  'exterior_front',
  'aerial_drone',
  'view_mountain',
  'view_water',
  'view_forest',
  'pool_outdoor_living',
]

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

  // DAL: read active tiles via city or community filter.
  const withSub = subdivision?.trim()
  const tiles = withSub
    ? await getCommunityListings(withSub, { status: 'active', limit: 500 })
    : await getCityListings(city.trim(), { status: 'active', limit: 500 })
  const listingRows = (withSub
    ? tiles.filter((t) => t.city?.toLowerCase().trim() === city.trim().toLowerCase())
    : tiles
  ).map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
  }))

  const keys = new Set<string>()
  for (const r of listingRows) {
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
