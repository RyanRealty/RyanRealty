/**
 * getListingCardVideo — the ONE reel a listing card may play, for ONE listing.
 *
 * The listing dial (V3ListingDial, Matt 2026-09-24) shows a card's photograph
 * first and, after the reader has rested on the card, plays that listing's
 * walkthrough reel. The reel is the listing page's own (publishListingHeroVideo
 * through publishListingCardVideo), so this reads what getListingVideos reads:
 * listing_videos, video_tours_cache, and the one listing's details.Videos /
 * VirtualTours, every listings read narrowed by ListNumber or ListingKey.
 *
 * WHY A SEPARATE READ. A dial holds up to dozens of listings, and a page that
 * read every card's ~10 KB details document to learn which ones have a reel
 * would pay that for every card on every render (docs/TOAST_READ_DISCIPLINE.md).
 * So pages never ask: the dial asks for the card in front of the reader, one
 * listing per request, through /api/listings/[listingKey]/card-video.
 *
 * CACHED. The answer (a few hundred bytes, not the whole video list) is held
 * in unstable_cache on the videos window and tagged with the listing, so the
 * same revalidation that refreshes the listing page refreshes the card. The
 * route puts a CDN window in front of it.
 *
 * NEVER A CACHED EMPTY FROM A FAILED READ. The inner read throws on a
 * transient error (unstable_cache does not store a rejection); one uncached
 * retry, then `degraded: true`, which the route answers no-store.
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { z } from 'zod'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchListingVideosUncached } from '@/lib/data/videos/getListingVideos'
import { publishListingCardVideo, type ListingCardVideo } from '@/lib/listing/publish-listing-card-video'

/** A ListingKey (26 digits) or a ListNumber (9 digits); nothing else reaches the database. */
export const LISTING_CARD_VIDEO_KEY = /^[A-Za-z0-9_-]{1,64}$/

const InputSchema = z.object({ listingKey: z.string().regex(LISTING_CARD_VIDEO_KEY) })

export type ListingCardVideoResult = {
  video: ListingCardVideo | null
  /** True when the read failed twice: the empty is not a fact about the listing. */
  degraded: boolean
}

async function resolveCardVideo(listingKey: string): Promise<ListingCardVideo | null> {
  const videos = await fetchListingVideosUncached(listingKey)
  return publishListingCardVideo(videos)
}

export async function getListingCardVideo(listingKey: string): Promise<ListingCardVideoResult> {
  const parsed = InputSchema.safeParse({ listingKey })
  if (!parsed.success) return { video: null, degraded: false }
  const key = parsed.data.listingKey
  // v2 2026-09-25: Vimeo srcs carry the unlisted-video privacy hash (v1 could
  // hold a hashless src, which the player refuses to play).
  const cached = unstable_cache(() => resolveCardVideo(key), ['listing-card-video-v2', key], {
    revalidate: CACHE_WINDOWS.videos,
    tags: [cacheTag.listing(key), cacheTag.videos],
  })
  try {
    return { video: await cached(), degraded: false }
  } catch {
    try {
      return { video: await resolveCardVideo(key), degraded: false }
    } catch (err) {
      console.error('[getListingCardVideo]', key, err instanceof Error ? err.message : err)
      return { video: null, degraded: true }
    }
  }
}
