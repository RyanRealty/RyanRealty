/**
 * Build embed iframe HTML for YouTube and Vimeo URLs so listing videos play inline.
 * When the MLS provides only a video URL (no ObjectHtml), we can still embed it.
 */

/** Watch, short, embed, youtu.be — video IDs are 11 chars. */
const YOUTUBE_REGEX =
  /(?:youtube\.com\/watch\?[^#]*v=|youtube\.com\/(?:embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

const VIMEO_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/

export type ListingTileVideoEmbed = {
  kind: 'youtube' | 'vimeo' | 'matterport'
  /** Full iframe src (autoplay where policy allows). */
  src: string
  /** Optional poster when listing has no PhotoURL (YouTube only). */
  posterUrl?: string | null
}

/** True when `<video src>` can load a progressive file (not YouTube page URLs). */
export function isDirectListingVideoFileUrl(uri: string): boolean {
  const u = uri.trim().toLowerCase()
  if (!u || u.includes('<') || u.includes('>')) return false
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(uri)
}

function extractIframeSrcFromMarkup(raw: string): string | null {
  const m = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  const s = m?.[1]?.trim()
  return s && (s.startsWith('http://') || s.startsWith('https://')) ? s : null
}

/**
 * Resolve MLS video URL or ObjectHtml snippet to an embeddable iframe src for listing tiles.
 */
export function parseListingVideoEmbedForTile(urlOrHtml: string): ListingTileVideoEmbed | null {
  if (!urlOrHtml || typeof urlOrHtml !== 'string') return null
  let trimmed = urlOrHtml.trim()
  if (trimmed.includes('<iframe')) {
    const extracted = extractIframeSrcFromMarkup(trimmed)
    if (extracted) trimmed = extracted
    else return null
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null

  const yt = trimmed.match(YOUTUBE_REGEX)
  if (yt) {
    const id = yt[1]
    return {
      kind: 'youtube',
      src: `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1&playsinline=1`,
      posterUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    }
  }
  const vimeo = trimmed.match(VIMEO_REGEX)
  if (vimeo) {
    const id = vimeo[1]
    return {
      kind: 'vimeo',
      src: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1`,
    }
  }
  const low = trimmed.toLowerCase()
  if (low.includes('matterport.com')) {
    return { kind: 'matterport', src: trimmed }
  }
  return null
}

export function getVideoEmbedHtml(url: string, autoplay = true): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  const yt = trimmed.match(YOUTUBE_REGEX)
  if (yt) {
    const id = yt[1]
    const src = `https://www.youtube.com/embed/${id}?rel=0${autoplay ? '&autoplay=1&mute=1' : ''}`
    return `<iframe src="${escapeAttr(src)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="absolute inset-0 h-full w-full"></iframe>`
  }
  const vimeo = trimmed.match(VIMEO_REGEX)
  if (vimeo) {
    const id = vimeo[1]
    const src = `https://player.vimeo.com/video/${id}${autoplay ? '?autoplay=1' : ''}`
    return `<iframe src="${escapeAttr(src)}" title="Vimeo video" allow="fullscreen; picture-in-picture; autoplay" allowfullscreen class="absolute inset-0 h-full w-full"></iframe>`
  }
  return null
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
