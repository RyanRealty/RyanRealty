import { ListingLikeThisSheet } from '@/components/site/listing-detail/ListingLikeThisSheet.client'

/**
 * One alerts ask on the listing Sheet. The coach and mid-page nags stay off.
 * `#listing-like-alerts` lives on the form.
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
  return <ListingLikeThisSheet city={city} listPrice={listPrice} beds={beds} />
}
