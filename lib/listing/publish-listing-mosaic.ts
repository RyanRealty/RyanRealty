/**
 * Listing hero media (SITE-45): one frame of THIS house plus a filmstrip
 * that indexes every still. The photograph shows the whole still: on a wide
 * screen it sits whole (object-fit: contain) in a viewport-tall navy well; on
 * a phone the FRAME takes the photograph's own shape (listingFrameAspect), so
 * a cover fit crops nothing and no navy band sits above or below it (Matt
 * 2026-09-25, "I hate all the wasted space"). A marketing reel, when leftover
 * has one, leads. 3D, floor, and street view are tools on the strip, not
 * tiles. The map is the atlas below the fold, never a Google static beside the
 * photo. The four-cell side grid this file used to size
 * (publishListingMosaicTiles) went with the mosaic.
 */

export const LISTING_MOSAIC_PHOTO_QUALITY = 75
/** The desktop frame fills the 62fr main column beside the broker card. */
export const LISTING_MOSAIC_LEAD_SIZES = '(max-width: 63.99rem) 100vw, 66vw'
export const LISTING_MOSAIC_CAROUSEL_SIZES = '100vw'
/** A filmstrip thumb (SITE-45): under 6rem wide at every viewport. */
export const LISTING_MOSAIC_STRIP_SIZES = '96px'

const MOSAIC_TARGET_EDGE = 1600

/**
 * The phone frame's default shape, width over height: 3:2. Basis: the lead
 * photo of 590 active Central Oregon listings measured 2026-09-25 (Supabase
 * listings.PhotoURL, Spark 1600x1200 derivative, JPEG header): 68.5% sit at
 * 3:2 (1.42 to 1.6), 16.3% at 4:3, 13.6% at 16:10 or wider, 1.6% square or
 * portrait. The frame server-renders at this shape so most listings never move.
 */
export const LISTING_FRAME_ASPECT_DEFAULT = 3 / 2
/** The squarest frame a phone gets. A portrait still covers into it. */
export const LISTING_FRAME_ASPECT_MIN = 4 / 3
/** The widest frame a phone gets. A panorama covers into it. */
export const LISTING_FRAME_ASPECT_MAX = 16 / 9
/**
 * Inside this distance of the default the frame keeps the default: a
 * 1537x1023 still (1.502) is a 3:2 photograph, and re-shaping the frame by
 * half a pixel is a layout shift that buys nothing.
 */
const LISTING_FRAME_ASPECT_SNAP = 0.02

/**
 * The phone frame's shape for a lead still of `width` x `height` natural
 * pixels, or null when the default already fits it.
 *
 * WHY THE FRAME FOLLOWS THE PHOTOGRAPH. MLS stills carry their required marks
 * burned into the pixels at the corners ("Digitally Altered" top left, the
 * ODS source mark bottom left). A fixed frame with a cover fit crops a 4:3
 * still's top and bottom by 5.6% each and a 16:9 still's sides by 7.8% each,
 * which is exactly where those marks sit; a contain fit puts navy bands
 * around the photograph. A frame shaped like the photograph does neither.
 * Outside 4:3 to 16:9 the frame stops at the bound and the still covers into
 * it (a portrait still is anchored at its foot in CSS, which keeps the
 * bottom-left source mark and the house, and gives up sky).
 */
export function listingFrameAspect(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const ratio = width / height
  const bounded = Math.min(LISTING_FRAME_ASPECT_MAX, Math.max(LISTING_FRAME_ASPECT_MIN, ratio))
  if (Math.abs(bounded - LISTING_FRAME_ASPECT_DEFAULT) < LISTING_FRAME_ASPECT_SNAP) return null
  return Math.round(bounded * 10000) / 10000
}

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
