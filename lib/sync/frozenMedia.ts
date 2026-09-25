/**
 * Frozen media: a closed listing's photos stay as we captured them.
 *
 * Once a listing closes the sync freezes its media (media_finalized), because
 * the MLS often trims a sold listing's gallery. When a frozen row has to be
 * rewritten anyway (the MLS corrected a fact a statistic reads, see
 * lib/sync/listingDrift.ts), the rewrite must not shrink the gallery we hold.
 *
 * The rule, per media collection: keep whichever copy has more items. The
 * primary photo URL follows the Photos collection it came with.
 */

export const MEDIA_DETAIL_KEYS = ['Photos', 'FloorPlans', 'Videos', 'VirtualTours', 'Documents', 'OpenHouses'] as const

/** What we hold for a frozen row: its primary photo and the media collections inside details. */
export type HeldMedia = {
  PhotoURL: string | null
  has_virtual_tour: boolean | null
  OpenHouses: unknown
  details: Partial<Record<(typeof MEDIA_DETAIL_KEYS)[number], unknown>>
}

function count(v: unknown): number {
  return Array.isArray(v) ? v.length : 0
}

/**
 * Merge held media into a freshly mapped row, in place, and return it. Only
 * collections where we hold more items than the MLS now serves are kept; the
 * rest take the MLS copy. The row keeps media_finalized = true.
 *
 * Kept values are written back explicitly, never by deleting the key: a
 * batched upsert sends the union of every row's columns, so a missing key
 * would write NULL over the value we meant to keep.
 */
export function mergeFrozenMedia(row: Record<string, unknown>, held: HeldMedia): Record<string, unknown> {
  const details =
    row.details && typeof row.details === 'object' && !Array.isArray(row.details)
      ? { ...(row.details as Record<string, unknown>) }
      : {}
  let keptPhotos = false
  for (const key of MEDIA_DETAIL_KEYS) {
    const ours = held.details[key]
    if (count(ours) > count(details[key])) {
      details[key] = ours
      if (key === 'Photos') keptPhotos = true
      // The mapper derives has_virtual_tour from Videos (lib/listing-mapper.ts).
      if (key === 'Videos') row.has_virtual_tour = held.has_virtual_tour
      if (key === 'OpenHouses') row.OpenHouses = held.OpenHouses
    }
  }
  row.details = details
  // The held primary photo follows the held gallery, but a null never replaces a URL the MLS sent.
  if (held.PhotoURL && (keptPhotos || !row.PhotoURL)) row.PhotoURL = held.PhotoURL
  row.media_finalized = true
  return row
}
