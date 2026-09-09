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
  showCoach = true,
}: {
  city: string | null | undefined
  listPrice: number | null | undefined
  beds: number | null | undefined
  photoUrl?: string | null
  /**
   * SITE-21. The coach is a fixed bar that nudges a reader toward
   * `#listing-like-alerts` five seconds in, and it earns that on a page whose
   * ask is a tour. Off market the alert IS the page's ask: it sits third from
   * the top, and the phone's sticky bar already carries "Get alerts" pointing
   * at the same anchor. A third bar saying it again is nagging, and two fixed
   * bottom bars at 375 is the mobile defect the coach's own header describes.
   */
  showCoach?: boolean
}) {
  if (!city) return null
  return (
    <>
      <ListingLikeThisSheet city={city} listPrice={listPrice} beds={beds} photoUrl={photoUrl} />
      {showCoach ? <ListingAlertCoach city={city} /> : null}
    </>
  )
}
