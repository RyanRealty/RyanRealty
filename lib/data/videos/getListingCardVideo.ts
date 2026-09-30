/**
 * getListingCardVideo — the one reel a listing CARD may play (SITE-194).
 *
 * The dial's card resolves the same hero reel the listing page leads with,
 * through the cached per-listing videos read (getListingVideos, the videos
 * cache window), so no place page adds a per-card `listings.details` read
 * to its server render: the card asks for it after the photograph has
 * painted, through GET /api/listings/[listingKey]/card-video.
 */
import { publishListingHeroVideo } from '@/lib/listing/publish-listing-hero-video'
import { publishDialReel, type DialReel } from '@/lib/listing/publish-dial-reel'
import { getListingVideos } from './getListingVideos'

export type ListingCardVideo = {
  listingKey: string
  /** Null when the listing has no walkthrough reel a card can play silently. */
  reel: DialReel | null
}

export async function getListingCardVideo(listingKey: string): Promise<ListingCardVideo> {
  const key = listingKey.trim()
  const videos = await getListingVideos(key)
  return { listingKey: key, reel: publishDialReel(publishListingHeroVideo(videos)) }
}
