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

/** Progressive / hosted walkthrough reel. MLS often stuffs these in VirtualTours. */
export function isListingWalkthroughVideo(url?: string | null): boolean {
  const u = (url ?? '').toLowerCase()
  if (!u) return false
  if (u.includes('vimeo.com')) return true
  if (u.includes('youtube.com') || u.includes('youtu.be')) return true
  if (u.includes('drive.google.com/file')) return true
  if (u.includes('dropbox.com') && /\.(mp4|m4v|mov|webm)(\?|#|$)/.test(u)) return true
  if (u.includes('cloudflarestream.com') || u.includes('videodelivery.net')) return true
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(u)
}

export function isListingVirtualTour(input: {
  url?: string | null
  name?: string | null
  hint?: string | null
  isVirtualTour?: boolean
}): boolean {
  // Trailmere (220225015): Vimeo "Walkthrough Video" sits in VirtualTours
  // beside Zillow 3D. A walkthrough reel is never a 3D tour.
  if (isListingWalkthroughVideo(input.url)) return false
  const url = (input.url ?? '').toLowerCase()
  if (url.includes('zillow.com/view-imx') || url.includes('zillow.com/view-3d-home')) return true
  if (url.includes('matterport.com')) return true
  if (url.includes('cloudpano.com')) return true
  if (url.includes('initialviewtype=pano')) return true
  if (input.isVirtualTour) return true
  const hint = `${input.hint ?? ''} ${input.name ?? ''}`.toLowerCase()
  if (hint.includes('virtual-tour') || hint.includes('virtual tour')) return true
  if (/\b3d\b/.test(hint) && !hint.includes('video-tag')) return true
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

/** Card 3D control → the same on-site tour overlay the listing page uses. */
export function publishTourEmbedFromUrl(
  url: string | null | undefined,
  posterUrl?: string | null,
): VideoEmbed | null {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const mp4 = /\.mp4(\?|$)/.test(lower)
  return {
    source: lower.includes('matterport') ? 'mls-matterport' : 'mls-other',
    embedType: mp4 ? 'video-tag' : 'iframe',
    url: trimmed,
    posterUrl: posterUrl?.trim() || undefined,
    professional: true,
    isVirtualTour: isListingVirtualTour({ url: trimmed, isVirtualTour: true }) || !mp4,
  }
}
