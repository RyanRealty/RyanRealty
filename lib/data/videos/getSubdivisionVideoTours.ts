import type { SupabaseClient } from '@supabase/supabase-js'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import { fetchListingsWithVideos } from '@/lib/fetch-listings-with-videos'
import type { VideoListingRowShape } from '@/lib/video-tours-listing-videos-join'

/**
 * Subdivision-scoped video-tour probe for the plat detail page — the DAL home
 * for the read that used to go through app/actions/videos (ci:page-action-imports
 * requires page reads to come from @/lib/data; the shrink-only baseline pinned
 * the old uncached entry, so this is the ratchet's prescribed fix, not a rename).
 *
 * 300s cache matters here: uncached, this cascade was the single worst page
 * rail in the 2026-08-21 profile (sub:video-tours, 85 SSG timeouts; the
 * has_virtual_tour candidates query alone measured 1368ms before
 * idx_listings_city_vt_modts, 416ms after). fetchListingsWithVideos' client
 * parameter is vestigial (its reads all go through DAL candidates); the anon
 * client satisfies the signature.
 */
async function fetchSubdivisionVideoTours(
  community: string,
  city: string,
  limit: number,
): Promise<VideoListingRowShape[]> {
  return fetchListingsWithVideos(supabaseAnon() as unknown as SupabaseClient, {
    community,
    city,
    status: 'active',
    limit,
  })
}

export const getSubdivisionVideoTours = makeResilientCached(
  fetchSubdivisionVideoTours,
  ['subdivision-video-tours-v1'],
  { revalidate: 300, tags: ['listings-videos'] },
  [],
)
