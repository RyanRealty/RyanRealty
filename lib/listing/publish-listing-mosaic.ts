/**
 * Listing mosaic: one lead cell + two stacked stills.
 * Lead is 3:2 cover-crop. A marketing reel, when leftover has one, is the lead.
 */

export const LISTING_MOSAIC_THUMB_COUNT = 2

export function publishListingMosaicThumbs<T>(
  photos: ReadonlyArray<T>,
  leadIsVideo: boolean,
): T[] {
  const start = leadIsVideo ? 0 : 1
  return photos.slice(start, start + LISTING_MOSAIC_THUMB_COUNT)
}
