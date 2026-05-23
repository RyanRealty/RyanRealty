/**
 * Listing video row reads — wide projection of the `listing_videos` table
 * for the homepage / community video tile pipelines.
 *
 * Lives behind the DAL boundary. Consumers should NOT touch listing_videos
 * directly.
 */

import { supabaseAnon } from '@/lib/data/client'

export type ListingVideoRow = {
  listing_key: string
  video_url: string
  created_at?: string | null
}

/**
 * Newest N listing_videos rows. Used by fetchListingsWithVideos as the
 * "we have a video for this listing" pre-filter.
 */
export async function getRecentListingVideoRows(limit = 180): Promise<ListingVideoRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const safe = Math.min(Math.max(limit, 1), 1000)
  const { data } = await sb
    .from('listing_videos')
    .select('listing_key, video_url, created_at')
    .order('created_at', { ascending: false })
    .limit(safe)
  return ((data ?? []) as Array<ListingVideoRow>).filter(
    (r) => r.listing_key?.toString().trim() && r.video_url?.toString().trim()
  )
}

/** Generic "any N rows" read (no sort) used by the legacy fallback path. */
export async function getAnyListingVideoRows(limit = 200): Promise<ListingVideoRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const safe = Math.min(Math.max(limit, 1), 1000)
  const { data } = await sb
    .from('listing_videos')
    .select('listing_key, video_url')
    .limit(safe)
  return ((data ?? []) as Array<ListingVideoRow>).filter(
    (r) => r.listing_key?.toString().trim() && r.video_url?.toString().trim()
  )
}
