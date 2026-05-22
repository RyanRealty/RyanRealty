/**
 * getListingVideos — fetch listing videos with 3-tier MLS fallback.
 *
 * STUB: implementation lands in Wave 1 (Step 1.8). Today returns [] and
 * logs a warning.
 *
 * The fallback order (per docs/DATA_ACCESS_LAYER.md "Listing videos"):
 *   1. listing_videos table — our own publishes (rare)
 *   2. video_tours_cache — nightly MLS feed (Aryeo, Vimeo, YouTube, etc.)
 *   3. listings.details.Videos JSONB — raw MLS payload
 *
 * The listing detail page embeds whatever the listing agent paid for. We
 * do not render videos for other agents' listings — they're already
 * professionally produced.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { supabaseServer } from '@/lib/data/client'
import type { VideoEmbed } from '@/lib/data/types/video'

const InputSchema = z.object({ listingKey: z.string().min(1).max(100) })

export const getListingVideos = unstable_cache(
  async (listingKey: string): Promise<VideoEmbed[]> => {
    InputSchema.parse({ listingKey })

    // TODO(Wave 1 Step 1.8): implement the 3-tier fallback.
    //
    // Tier 1: listing_videos (our own publishes — rare, only the 3 listings WE list)
    // Tier 2: video_tours_cache (nightly MLS feed, professionally produced)
    // Tier 3: listings.details.Videos JSONB (raw MLS payload, catches stragglers)
    console.warn('[getListingVideos] STUB — 3-tier fallback not yet wired. Returning [] for', listingKey)

    const supabase = await supabaseServer()
    void supabase // silence unused-import until impl lands

    return []
  },
  ['listing-videos'],
  {
    revalidate: CACHE_WINDOWS.videos,
    tags: [cacheTag.listings, cacheTag.videos],
  }
)
