import { ListingLikeThisSheet } from '@/components/site/listing-detail/ListingLikeThisSheet.client'
import { ListingAlertCoach } from '@/components/site/listing-detail/ListingAlertCoach.client'

/**
 * Listing-detail B1 capture: city + price band (+ beds) for homes like this.
 * Server-safe wrapper so app/listing page stays under the file-size budget.
 * `#listing-like-alerts` is the anchor for PriceCtaStrip + RoomRestyle + coach.
 * The Sheet owns that id.
 */
export function ListingLikeThisAlerts({
  city,
  listPrice,
  beds,
  photoUrl,
}: {
  city: string | null | undefined
  listPrice: number | null | undefined
  beds: number | null | undefined
  photoUrl?: string | null
}) {
  if (!city) return null
  return (
    <>
      <ListingLikeThisSheet city={city} listPrice={listPrice} beds={beds} photoUrl={photoUrl} />
      <ListingAlertCoach city={city} />
    </>
  )
}
