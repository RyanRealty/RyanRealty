import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { priceBandAroundListPrice } from '@/lib/search/price-band'

/**
 * Listing-detail B1 capture: city + price band (+ beds) for "homes like this."
 * Server-safe wrapper so app/listing page stays under the file-size budget.
 * `#listing-like-alerts` is the anchor for PriceCtaStrip + RoomRestyle + coach (E4).
 *
 * E4 craft: quiet full-width section so the strip reads as part of the page
 * rhythm, not a bolted-on card under the footer.
 */
export function ListingLikeThisAlerts({
  city,
  listPrice,
  beds,
}: {
  city: string | null | undefined
  listPrice: number | null | undefined
  beds: number | null | undefined
}) {
  if (!city) return null
  return (
    <section
      id="listing-like-alerts"
      aria-label={`Listing alerts for ${city}`}
      style={{
        borderTop: '3px solid var(--navy)',
        scrollMarginTop: '5.5rem',
      }}
    >
      <KbCommunityAlerts
        communityName={city}
        city={city}
        subdivision=""
        extraFilters={{
          ...priceBandAroundListPrice(listPrice),
          ...(beds != null && beds > 0 ? { beds: String(beds) } : {}),
        }}
        headline={`${city} homes like this`}
        body={`Email when a new ${city} home lists near this price${beds != null && beds > 0 ? ` with ${beds}+ beds` : ''}. Same alert engine as search and city pages.`}
      />
    </section>
  )
}
