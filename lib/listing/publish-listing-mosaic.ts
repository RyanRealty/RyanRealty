/**
 * Listing mosaic: one lead cell + stacked stills and leftover media tiles.
 * Lead is 3:2 cover-crop. A marketing reel, when leftover has one, is the lead.
 * Floor, 3D, and a Google map sit as tiles when those media exist.
 */

export const LISTING_MOSAIC_THUMB_COUNT = 2
export const LISTING_MOSAIC_SIDE_MAX = 4
export const LISTING_MOSAIC_PHOTO_QUALITY = 90
export const LISTING_MOSAIC_LEAD_SIZES = '(max-width: 63.99rem) 100vw, 66vw'
export const LISTING_MOSAIC_THUMB_SIZES = '(max-width: 63.99rem) 100vw, 33vw'
export const LISTING_MOSAIC_THUMB_WIDE_SIZES = '(max-width: 63.99rem) 100vw, 17vw'
export const LISTING_MOSAIC_CAROUSEL_SIZES = '100vw'

const MOSAIC_TARGET_EDGE = 1600

export function publishListingMosaicThumbs<T>(
  photos: ReadonlyArray<T>,
  leadIsVideo: boolean,
): T[] {
  const start = leadIsVideo ? 0 : 1
  return photos.slice(start, start + LISTING_MOSAIC_THUMB_COUNT)
}

export type ListingMosaicTile =
  | { kind: 'photo'; photoIndex: number }
  | { kind: 'tour' }
  | { kind: 'floor' }
  | { kind: 'map' }

/**
 * Side cells beside the lead. Photos only: two stills. When 3D, a floor
 * plan, or a map exist, those occupy real tiles and the stack can grow
 * to four. No fake 3D. No map tile without a key+point (caller sets hasMap).
 */
export function publishListingMosaicTiles(input: {
  photoCount: number
  leadIsVideo: boolean
  hasTour: boolean
  hasFloor: boolean
  hasMap: boolean
}): ListingMosaicTile[] {
  const extras: ListingMosaicTile[] = []
  if (input.hasTour) extras.push({ kind: 'tour' })
  if (input.hasFloor) extras.push({ kind: 'floor' })
  if (input.hasMap) extras.push({ kind: 'map' })

  const photoStart = input.leadIsVideo ? 0 : 1
  const available = Math.max(0, input.photoCount - photoStart)
  // Photos only: two stills. One extra (usually the map): two stills plus
  // that tile, so the extra can span the bottom of the stack. Two or three
  // extras: fill up to four cells.
  const photoCap =
    extras.length === 0
      ? LISTING_MOSAIC_THUMB_COUNT
      : Math.min(LISTING_MOSAIC_THUMB_COUNT, Math.max(0, LISTING_MOSAIC_SIDE_MAX - extras.length))
  const photoSlots = Math.min(available, photoCap)
  const photos: ListingMosaicTile[] = []
  for (let i = 0; i < photoSlots; i += 1) {
    photos.push({ kind: 'photo', photoIndex: photoStart + i })
  }
  return [...photos, ...extras]
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
