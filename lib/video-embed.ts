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
 * Like extractIframeSrcFromMarkup but also accepts protocol-relative srcs
 * (`//www.youtube.com/embed/...`), which MLS RETS feeds emit constantly. Returns
 * the raw src (still protocol-relative if that is how it came) for the caller to
 * normalize, or null when no usable src is present.
 */
function extractIframeSrcFromMarkupLoose(raw: string): string | null {
  const m = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  const s = m?.[1]?.trim()
  if (!s) return null
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//') ? s : null
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

/**
 * Normalize a raw video / virtual-tour URL into an embeddable form + render mode:
 *   - 'iframe'    YouTube/Vimeo/Matterport (canonical embed src) + Aryeo/Cloudflare
 *   - 'video-tag' direct progressive file (.mp4/.webm/.mov)
 *   - 'link'      hosts that block framing (Dropbox folders) → watch link
 * Returns null to drop the entry (MapRight parcel maps are not walkthrough videos).
 *
 * Lives in this pure module (no server-only deps) so BOTH the server DAL
 * (getListingVideos) and CLIENT components (VideoListingCard inline play) can
 * resolve a scalar URL to the same CSP-safe embed without pulling `next/cache`
 * into the browser bundle. The embed hosts here mirror the CSP `frame-src`
 * allow-list (ci:embed-csp-parity). getListingVideos re-exports this symbol so
 * every existing `normalizeEmbed` import keeps working unchanged.
 */
export function normalizeEmbed(
  raw: string | null,
  hintSource?: string | null,
): { url: string; embedType: 'iframe' | 'video-tag' | 'link'; posterUrl?: string } | null {
  if (!raw) return null
  let url = raw.trim()
  // MLS video fields frequently arrive as an <iframe ...> snippet (sometimes
  // wrapped in a <div>, sometimes with a protocol-relative //host src). Pull the
  // src out first so the host checks below see a real URL instead of bailing at
  // the http(s) guard. (This is the #1 reason hosted embeds were silently
  // dropping out of the video feed.)
  if (url.includes('<iframe')) {
    const inner = extractIframeSrcFromMarkupLoose(url)
    if (inner) url = inner
    else return null
  }
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) return null
  const low = url.toLowerCase()
  const hint = (hintSource ?? '').toLowerCase()

  if (low.includes('mapright') || hint.includes('mapright')) return null

  // Dropbox FIRST (before the generic .mp4 check): it blocks IFRAME framing, and
  // www.dropbox.com/<file>.mp4 serves an HTML PREVIEW, not the file — so the raw
  // share URL is useless in a <video> tag. If the link points at a video FILE,
  // rewrite to dl.dropboxusercontent.com (+ raw=1) which serves it inline, so it
  // becomes a proper SHOWCASE HERO instead of a buried watch-link. Folders stay a link.
  if (low.includes('dropbox.com')) {
    if (/\.(mp4|m4v|mov|webm)(\?|$)/i.test(low)) {
      let direct = url.replace(/:\/\/(?:www\.)?dropbox\.com/i, '://dl.dropboxusercontent.com')
      direct = direct.replace(/([?&])dl=0\b/i, '$1raw=1')
      if (!/[?&](?:dl|raw)=/i.test(direct)) direct += (direct.includes('?') ? '&' : '?') + 'raw=1'
      return { url: direct, embedType: 'video-tag' }
    }
    return { url, embedType: 'link' }
  }

  // Google Drive: agents often "host" a tour as a Drive video FILE. The /view
  // share URL blocks framing and is not a playable file, but /preview embeds a
  // player iframe. Rewrite file/d/<id>/... -> file/d/<id>/preview.
  const gdrive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/)
  if (gdrive) return { url: `https://drive.google.com/file/d/${gdrive[1]}/preview`, embedType: 'iframe' }

  const parsed = parseListingVideoEmbedForTile(url)
  if (parsed) return { url: parsed.src, embedType: 'iframe', posterUrl: parsed.posterUrl ?? undefined }

  if (isDirectListingVideoFileUrl(url)) return { url, embedType: 'video-tag' }

  // Hosted players + 3D tours that allow framing (Aryeo verified framable;
  // Matterport + Zillow 3D Home view-imx are built for MLS/IDX embedding, so
  // they stay ON-site in an iframe rather than sending the visitor off to a
  // competitor — important since these arrive via details.VirtualTours).
  if (
    low.includes('aryeo.com') ||
    low.includes('cloudflarestream.com') ||
    low.includes('videodelivery.net') ||
    low.includes('player.vimeo.com') ||
    low.includes('matterport.com') ||
    low.includes('zillow.com/view-imx')
  ) {
    return { url, embedType: 'iframe' }
  }

  // Anything unrecognized: frame-blocked → watch link, never a broken iframe.
  return { url, embedType: 'link' }
}

/**
 * Rewrite an embed URL into a silent BACKGROUND-video URL: autoplay, muted, loop,
 * and NO player chrome / play button — for tiles where the video plays itself.
 * Vimeo `background=1` is true no-UI mode (the cleanest); YouTube `controls=0` +
 * loop(playlist) is the closest equivalent. Non-vimeo/youtube embeds (Matterport,
 * etc.) are returned unchanged. Pure + client-safe.
 */
export function toBackgroundEmbed(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host.includes('vimeo.com')) {
      u.searchParams.set('background', '1')
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('muted', '1')
      u.searchParams.set('loop', '1')
      return u.toString()
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const id = u.pathname.split('/embed/')[1]?.split('/')[0]
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('mute', '1')
      u.searchParams.set('controls', '0')
      u.searchParams.set('loop', '1')
      if (id) u.searchParams.set('playlist', id) // YouTube loop requires playlist=<id>
      u.searchParams.set('modestbranding', '1')
      u.searchParams.set('playsinline', '1')
      u.searchParams.set('rel', '0')
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}
