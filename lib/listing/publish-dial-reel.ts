/**
 * The reel a listing card may play after its photograph (SITE-194).
 *
 * Matt 2026-09-24, on the dial: "as we toggle through or navigate those
 * cards, have the primary photo come in first; after a second or two, play
 * the video associated with it if there is one."
 *
 * "The video associated with it" is the SAME reel the listing page leads
 * with: publishListingHeroVideo picks a walkthrough reel and never a 3D tour
 * (Matterport, Zillow pano). A card cannot show player chrome over the
 * photograph (Matt: no play button on tiles), so the reel must play itself
 * silently with no controls: toTileBackgroundVideo knows which hosts can
 * (a direct file, Vimeo, YouTube, Cloudflare Stream) and returns null for
 * the rest (Aryeo, Drive, unknown). Such a listing keeps its photograph on
 * the card and its video on its own page.
 *
 * Pure and client-safe: the DAL and the dial both call it.
 */
import type { VideoEmbed } from '@/lib/data/types/video'
import { toTileBackgroundVideo } from '@/lib/video-embed'

export type DialReel = {
  /** How the card mounts it: an <iframe> for a hosted player, a <video> for a file. */
  kind: 'iframe' | 'video'
  /** The silent, looping, chrome-less source. */
  src: string
  posterUrl?: string
}

export function publishDialReel(video: VideoEmbed | null | undefined): DialReel | null {
  if (!video) return null
  if (video.isVirtualTour) return null
  if (video.embedType === 'link') return null
  const quiet = toTileBackgroundVideo({ url: video.url, embedType: video.embedType })
  if (!quiet) return null
  const reel: DialReel = { kind: quiet.embedType === 'video-tag' ? 'video' : 'iframe', src: quiet.url }
  const poster = video.posterUrl?.trim()
  if (poster) reel.posterUrl = poster
  return reel
}
