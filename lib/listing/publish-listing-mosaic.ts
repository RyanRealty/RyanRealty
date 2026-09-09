/**
 * Listing hero media (SITE-45): one frame of THIS house plus a filmstrip
 * that indexes every still. The frame is 3:2 cover-crop; a marketing reel,
 * when leftover has one, leads. 3D, floor, and street view are tools on the
 * strip, not tiles. The map is the atlas below the fold, never a Google
 * static beside the photo. The four-cell side grid this file used to size
 * (publishListingMosaicTiles) went with the mosaic.
 */

export const LISTING_MOSAIC_PHOTO_QUALITY = 90
/** The desktop frame fills the 62fr main column beside the broker card. */
export const LISTING_MOSAIC_LEAD_SIZES = '(max-width: 63.99rem) 100vw, 66vw'
export const LISTING_MOSAIC_CAROUSEL_SIZES = '100vw'
/** A filmstrip thumb (SITE-45): under 6rem wide at every viewport. */
export const LISTING_MOSAIC_STRIP_SIZES = '96px'

const MOSAIC_TARGET_EDGE = 1600

/**
 * Prefer a larger Spark/MLS derivative when the URL already carries a size
 * in the path (`/640x480/`) or a width query (`w` / `width` / `wid`).
 * Does not invent a size on URLs that have none.
 */
export function preferListingMosaicPhotoUrl(url: string): string {
  if (!url) return url
  try {
    const parsed = new URL(url)
    for (const key of ['w', 'width', 'wid'] as const) {
      const raw = parsed.searchParams.get(key)
      if (raw && /^\d+$/.test(raw)) {
        const n = Number(raw)
        if (n > 0 && n < MOSAIC_TARGET_EDGE) {
          parsed.searchParams.set(key, String(MOSAIC_TARGET_EDGE))
          return parsed.toString()
        }
        return url
      }
    }
    const nextPath = parsed.pathname.replace(/\/(\d{2,4})x(\d{2,4})\//, (match, w, h) => {
      const width = Number(w)
      const height = Number(h)
      if (!width || !height || width >= MOSAIC_TARGET_EDGE) return match
      const nextHeight = Math.round((MOSAIC_TARGET_EDGE * height) / width)
      return `/${MOSAIC_TARGET_EDGE}x${nextHeight}/`
    })
    if (nextPath === parsed.pathname) return url
    parsed.pathname = nextPath
    return parsed.toString()
  } catch {
    return url
  }
}
