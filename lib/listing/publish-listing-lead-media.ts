/**
 * Media 1 for a listing detail page.
 *
 * Matt's media-1 rule: if a video or 3D tour exists, it is media 1
 * (1280 mosaic left pane, 390 first carousel slide, gallery slide 1).
 * Stills follow. No video = first still of THIS house. Never a city shot.
 *
 * This is a LAYOUT pick over the already-fetched `getListingVideos` +
 * `getListingPhotos` rows. It does not invent media or swap the source.
 *
 * `publishListingHeroVideo` still names the unmute-able reel. This function
 * is the wider lead: reel first, then a virtual tour, else null (caller
 * uses the first still).
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { isListingVirtualTour, publishListingHeroVideo } from './publish-listing-hero-video'

export type ListingLeadMedia =
  | { kind: 'video'; video: VideoEmbed }
  | { kind: 'tour'; video: VideoEmbed }

function isPlayable(video: VideoEmbed): boolean {
  return video.embedType === 'iframe' || video.embedType === 'video-tag'
}

export function publishListingLeadMedia(
  videos: ReadonlyArray<VideoEmbed>,
): ListingLeadMedia | null {
  const reel = publishListingHeroVideo(videos)
  if (reel) return { kind: 'video', video: reel }

  const tour = videos.find((video) => {
    if (!isPlayable(video)) return false
    return isListingVirtualTour({
      url: video.url,
      hint: video.source,
      isVirtualTour: video.isVirtualTour,
    })
  })
  if (tour) return { kind: 'tour', video: tour }
  return null
}
