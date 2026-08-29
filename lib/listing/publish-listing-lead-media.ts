/**
 * Media 1 for a listing detail page.
 *
 * Matt's media-1 rule: if a VIDEO exists, it is media 1 (1280 mosaic left
 * pane, 390 first carousel slide). Stills follow. No video = first still of
 * THIS house. Never a city shot. Never a Zillow/Matterport captcha iframe.
 *
 * 3D / virtual tours stay mosaic pills and overlay tabs. They are not the
 * lead frame.
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { publishListingHeroVideo } from './publish-listing-hero-video'

export type ListingLeadMedia = { kind: 'video'; video: VideoEmbed }

export function publishListingLeadMedia(
  videos: ReadonlyArray<VideoEmbed>,
): ListingLeadMedia | null {
  const reel = publishListingHeroVideo(videos)
  if (reel) return { kind: 'video', video: reel }
  return null
}
