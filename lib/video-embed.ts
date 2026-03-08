/**
 * Build embed iframe HTML for YouTube and Vimeo URLs so listing videos play inline.
 * When the MLS provides only a video URL (no ObjectHtml), we can still embed it.
 */

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const VIMEO_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/

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
