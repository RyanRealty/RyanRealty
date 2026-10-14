/**
 * VideoObject structured data for a listing's MLS video tour (2026-10-14).
 *
 * Google requires name, thumbnailUrl and uploadDate, plus contentUrl or
 * embedUrl. This publishes a VideoObject ONLY when all of them are real:
 *
 *   player      a YouTube or Vimeo player. Their embed URL is derivable from
 *               the video URL alone; no other provider's is, without fetching
 *               its page at render time, which we never do.
 *   uploadDate  the MLS media record's own ModificationTimestamp (VideoEmbed
 *               .uploadDate, lib/listing/listing-video-assembly.ts). No date,
 *               no VideoObject: a date is never invented.
 *   thumbnail   YouTube's own still (i.ytimg.com/vi/{id}/hqdefault.jpg, served
 *               for every public video). Vimeo's still needs a Vimeo API call,
 *               so a Vimeo tour uses the listing's MLS lead photo of the same
 *               home, from the MLS CDN; with no lead photo, no VideoObject.
 *
 * The video is the listing broker's work, linked and embedded, never re-hosted
 * (ODS): no contentUrl (there is no file of ours), and no Ryan Realty publisher.
 */
import type { VideoInput } from '@/lib/site/json-ld'
import type { VideoEmbed } from '@/lib/data/types/video'
import { parseListingVideoEmbedForTile, parseVimeoRef, vimeoPlayerSrc } from '@/lib/video-embed'

export type ListingVideoPlayer = {
  provider: 'youtube' | 'vimeo'
  id: string
  /** Player URL for VideoObject.embedUrl and the video sitemap's player_loc. */
  embedUrl: string
  /** The provider's own still, when derivable without a network call. */
  thumbnailUrl: string | null
}

/** The YouTube or Vimeo player behind a (cleaned) listing video URL. Pure. */
export function listingVideoPlayer(url: string | null | undefined): ListingVideoPlayer | null {
  if (!url) return null
  const tile = parseListingVideoEmbedForTile(url)
  if (tile?.kind === 'youtube') {
    const id = /\/embed\/([A-Za-z0-9_-]{11})/.exec(tile.src)?.[1]
    if (!id) return null
    return {
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  }
  if (tile?.kind === 'vimeo') {
    const ref = parseVimeoRef(url)
    if (!ref) return null
    return { provider: 'vimeo', id: ref.id, embedUrl: vimeoPlayerSrc(ref), thumbnailUrl: null }
  }
  return null
}

export type ListingVideoSchemaInput = {
  videos: readonly VideoEmbed[]
  /** "Video tour of 56328 Fireglass Loop, Bend, OR". */
  name: string
  description: string
  /** The listing page (relative is fine; buildJsonLd absolutizes). */
  pageUrl: string
  /** The listing's MLS lead photo: the still for a Vimeo tour. */
  leadPhotoUrl?: string | null
  /** Most VideoObjects one page carries. */
  max?: number
}

/** A dated, playable listing video with everything its sitemap entry needs. */
export type PublishedListingVideo = {
  player: ListingVideoPlayer
  thumbnailUrl: string
  uploadDate: string
}

/** The listing videos that qualify for a VideoObject, de-duplicated, capped. */
export function publishListingVideos(
  videos: readonly VideoEmbed[],
  leadPhotoUrl: string | null | undefined,
  max: number = 3,
): PublishedListingVideo[] {
  const lead = typeof leadPhotoUrl === 'string' && leadPhotoUrl.startsWith('https://') ? leadPhotoUrl : null
  const out: PublishedListingVideo[] = []
  const seen = new Set<string>()
  for (const v of videos) {
    if (out.length >= max) break
    if (!v.uploadDate) continue
    const player = listingVideoPlayer(v.url)
    if (!player) continue
    const key = `${player.provider}:${player.id}`
    if (seen.has(key)) continue
    const thumbnailUrl = player.thumbnailUrl ?? lead
    if (!thumbnailUrl) continue
    seen.add(key)
    out.push({ player, thumbnailUrl, uploadDate: v.uploadDate })
  }
  return out
}

/**
 * The one description every surface gives a listing video tour: sourced to the
 * MLS listing and crediting the listing brokerage (ODS §5-3 P), so the listing
 * page, /videos and video.xml say the same thing.
 */
export function listingVideoDescription(place: string, listOfficeName: string | null | undefined): string {
  const office = listOfficeName?.trim()
  return `Video tour of ${place}, from the MLS listing.${office ? ` Listing courtesy of ${office}.` : ''}`
}

/** VideoObject inputs for a listing page; empty when no video qualifies. */
export function publishListingVideoSchemas(input: ListingVideoSchemaInput): VideoInput[] {
  return publishListingVideos(input.videos, input.leadPhotoUrl, input.max ?? 3).map((v, i) => ({
    type: 'video' as const,
    name: i === 0 ? input.name : `${input.name}, video ${i + 1}`,
    description: input.description,
    url: input.pageUrl,
    embedUrl: v.player.embedUrl,
    thumbnailUrl: v.thumbnailUrl,
    uploadDate: v.uploadDate,
    publishedByRyanRealty: false,
  }))
}
