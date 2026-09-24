import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'

type LeadRow = { PhotoURL?: string | null; photoUrls?: string[] | null }

/**
 * The image the split page leads with: the first card's first photo, at the
 * size the card itself paints (SplitCardMedia maps every card URL through
 * `listingRowPhotoSrc(url, LISTING_FIELD_LEAD_PHOTO_SIZE)`, 800x600), so
 * `WebPage.primaryImageOfPage` names the exact URL in the server HTML
 * (JSON-LD equals the visible page). The split branch shows no place banner,
 * so the banner is never its lead image. Null when the first card has no photo.
 */
export function splitLeadImageUrl(listings: readonly LeadRow[]): string | null {
  const first = listings[0]
  if (!first) return null
  const raw = first.photoUrls && first.photoUrls.length > 0 ? first.photoUrls[0] : first.PhotoURL
  if (!raw || !raw.trim()) return null
  return listingRowPhotoSrc(raw, LISTING_FIELD_LEAD_PHOTO_SIZE) || null
}
