/**
 * Marketing-video hero vs 3D tour.
 *
 * Matt: listing videos and virtual tours are different. The hero Unmute
 * control only works on a native <video>. A Zillow 3D / Matterport pano
 * in details.Videos is still a tour — it is not a muted reel.
 *
 * Founding case: 61579 Rockway (220226183) shipped UNMUTE over a
 * zillow.com/view-imx pano named "3D Video" with zero <video> elements.
 */

import type { VideoEmbed } from '@/lib/data/types/video'

export function isListingVirtualTour(input: {
  url?: string | null
  name?: string | null
  hint?: string | null
  isVirtualTour?: boolean
}): boolean {
  if (input.isVirtualTour) return true
  const hint = `${input.hint ?? ''} ${input.name ?? ''}`.toLowerCase()
  if (hint.includes('virtual-tour') || hint.includes('virtual tour')) return true
  if (/\b3d\b/.test(hint) && !hint.includes('video-tag')) return true
  const url = (input.url ?? '').toLowerCase()
  if (!url) return false
  if (url.includes('zillow.com/view-imx')) return true
  if (url.includes('matterport.com')) return true
  if (url.includes('initialviewtype=pano')) return true
  return false
}

function isPlayable(video: VideoEmbed): boolean {
  return video.embedType === 'iframe' || video.embedType === 'video-tag'
}

export function publishListingHeroVideo(
  videos: ReadonlyArray<VideoEmbed>,
): VideoEmbed | null {
  return (
    videos.find((v) => {
      if (!isPlayable(v)) return false
      return !isListingVirtualTour({
        url: v.url,
        hint: v.source,
        isVirtualTour: v.isVirtualTour,
      })
    }) ?? null
  )
}

/** Matterport / Zillow 3D. Distinct from the marketing reel. */
export function publishListingVirtualTour(
  videos: ReadonlyArray<VideoEmbed>,
): VideoEmbed | null {
  return (
    videos.find((video) => {
      if (!isPlayable(video)) return false
      return isListingVirtualTour({
        url: video.url,
        hint: video.source,
        isVirtualTour: video.isVirtualTour,
      })
    }) ?? null
  )
}

export function publishListingHeroUnmute(video: VideoEmbed | null): boolean {
  return video?.embedType === 'video-tag'
}
