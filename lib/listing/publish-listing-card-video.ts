/**
 * The reel a listing CARD may play on its own (Matt 2026-09-24, the listing
 * dial: "have the primary photo come in first; after a second or two, play
 * the video associated with it if there is one").
 *
 * ONE DEFINITION OF "THE VIDEO". The card plays the reel the listing page
 * leads with, chosen by publishListingHeroVideo: a walkthrough reel, never a
 * 3D tour, a Matterport or a Zillow pano (the Rockway class). A card that
 * previewed a different video from the page it opens would be a second
 * definition, so when the page's reel is one a card cannot play silently
 * (an Aryeo or Google Drive player carries its own play button and chrome),
 * the card stays on its photograph rather than reaching for another video.
 *
 * WHAT A CARD CAN PLAY. Only what can run muted, looping and chrome-less:
 *   file     a progressive file in a native <video> (mp4, webm, mov, m4v),
 *   youtube  the youtube-nocookie player with controls=0,
 *   vimeo    the Vimeo player in background mode,
 *   stream   the Cloudflare Stream player with controls=false.
 * Every iframe host here is already in the CSP frame-src (ci:embed-csp-parity).
 *
 * Pure and client-safe: the card-video route shapes its answer with it and
 * the dial builds the player src with it.
 */

import type { VideoEmbed } from '@/lib/data/types/video'
import { parseVimeoRef, vimeoPlayerSrc } from '@/lib/video-embed'
import { publishListingHeroUnmute, publishListingHeroVideo } from './publish-listing-hero-video'

export type ListingCardVideoKind = 'file' | 'youtube' | 'vimeo' | 'stream'

export type ListingCardVideo = {
  kind: ListingCardVideoKind
  embedType: 'video-tag' | 'iframe'
  /** The reel as the listing page holds it: a file URL, or an embed URL. */
  url: string
  /** The host's own still, when the DAL has one (YouTube). The card's photograph is the real poster. */
  posterUrl: string | null
}

/** YouTube ids are eleven characters; watch, embed, shorts and youtu.be forms. */
const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

export function listingCardYoutubeId(url: string): string | null {
  return YOUTUBE_ID.exec(url)?.[1] ?? null
}

/** Which silent player can run this embed, or null when none can. */
export function listingCardVideoKind(video: Pick<VideoEmbed, 'embedType' | 'url'>): ListingCardVideoKind | null {
  const url = parseUrl(video.url)
  if (!url) return null
  if (video.embedType === 'video-tag') return 'file'
  if (video.embedType !== 'iframe') return null
  const host = url.hostname.toLowerCase()
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') || host === 'youtu.be') {
    return listingCardYoutubeId(url.toString()) ? 'youtube' : null
  }
  if (host.endsWith('vimeo.com')) return parseVimeoRef(url.toString()) ? 'vimeo' : null
  if (host.endsWith('cloudflarestream.com') || host.endsWith('videodelivery.net')) return 'stream'
  return null
}

/** The card's reel: the listing page's hero reel when a card can play it silently, else null. */
export function publishListingCardVideo(videos: ReadonlyArray<VideoEmbed>): ListingCardVideo | null {
  const reel = publishListingHeroVideo(videos)
  if (!reel) return null
  const kind = listingCardVideoKind(reel)
  if (!kind) return null
  return {
    kind,
    embedType: kind === 'file' ? 'video-tag' : 'iframe',
    url: reel.url.trim(),
    posterUrl: reel.posterUrl?.trim() || null,
  }
}

/**
 * The card-video route's answer, read back in the browser. Nothing is trusted
 * as sent: the kind is re-derived from the URL, so a body that names a player
 * the URL is not for is refused.
 */
export function parseListingCardVideo(raw: unknown): ListingCardVideo | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const url = typeof rec.url === 'string' ? rec.url.trim() : ''
  const embedType = rec.embedType === 'video-tag' || rec.embedType === 'iframe' ? rec.embedType : null
  if (!url || !embedType) return null
  const kind = listingCardVideoKind({ embedType, url })
  if (!kind || kind !== rec.kind) return null
  const posterUrl = typeof rec.posterUrl === 'string' && /^https?:\/\//i.test(rec.posterUrl) ? rec.posterUrl : null
  return { kind, embedType, url, posterUrl }
}

/** Sound is offered only where the listing page offers it: a native <video> (publishListingHeroUnmute). */
export function listingCardVideoCanUnmute(video: Pick<ListingCardVideo, 'kind' | 'embedType' | 'url'>): boolean {
  return (
    video.kind === 'file' &&
    publishListingHeroUnmute({ source: 'mls-other', embedType: video.embedType, url: video.url, professional: true })
  )
}

/**
 * The src the card mounts: muted, inline, looping, no controls. `origin` is
 * the page's own origin, which the YouTube player needs before it will report
 * that it is playing (the dial fades the reel in only on that report).
 */
export function listingCardVideoSrc(video: Pick<ListingCardVideo, 'kind' | 'url'>, origin?: string | null): string | null {
  const url = parseUrl(video.url)
  if (!url) return null
  switch (video.kind) {
    case 'file':
      return url.toString()
    case 'youtube': {
      const id = listingCardYoutubeId(url.toString())
      if (!id) return null
      const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        playsinline: '1',
        controls: '0',
        loop: '1',
        playlist: id,
        rel: '0',
        modestbranding: '1',
        iv_load_policy: '3',
        disablekb: '1',
        fs: '0',
        enablejsapi: '1',
      })
      if (origin && /^https?:\/\//.test(origin)) params.set('origin', origin)
      return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
    }
    case 'vimeo': {
      // An unlisted Vimeo reel plays only with its privacy hash, which
      // vimeoPlayerSrc carries from either the path or the `h` param.
      const ref = parseVimeoRef(url.toString())
      if (!ref) return null
      return vimeoPlayerSrc(ref, {
        background: '1',
        autoplay: '1',
        muted: '1',
        loop: '1',
        playsinline: '1',
        dnt: '1',
      })
    }
    case 'stream': {
      url.searchParams.set('autoplay', 'true')
      url.searchParams.set('muted', 'true')
      url.searchParams.set('loop', 'true')
      url.searchParams.set('controls', 'false')
      url.searchParams.set('preload', 'auto')
      // Bars, if a frame ever shows any, are the photograph beneath, never black.
      url.searchParams.set('letterboxColor', 'transparent')
      return url.toString()
    }
    default:
      return null
  }
}
