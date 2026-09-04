/**
 * Listing mosaic: one lead cell plus up to four stills of THIS house.
 * Lead is 3:2 cover-crop. A marketing reel, when leftover has one, is the lead.
 * 3D, floor, and street view are captions on the mosaic, not tiles.
 * The map is the atlas below the fold, never a Google static in the grid.
 */

export const LISTING_MOSAIC_THUMB_COUNT = 4
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

export type ListingMosaicTile = { kind: 'photo'; photoIndex: number }

/**
 * Side cells beside the lead. Stills of this house only, up to four.
 * Do not mint 3D, floor, or map tiles. Miss omits. Do not invent a cell.
 */
export function publishListingMosaicTiles(input: {
  photoCount: number
  leadIsVideo: boolean
}): ListingMosaicTile[] {
  const photoStart = input.leadIsVideo ? 0 : 1
  const available = Math.max(0, input.photoCount - photoStart)
  const photoSlots = Math.min(available, LISTING_MOSAIC_SIDE_MAX)
  const photos: ListingMosaicTile[] = []
  for (let i = 0; i < photoSlots; i += 1) {
    photos.push({ kind: 'photo', photoIndex: photoStart + i })
  }
  return photos
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
