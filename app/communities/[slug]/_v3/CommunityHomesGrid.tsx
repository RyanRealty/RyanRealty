import { V3_ROOT_CLASS, V3Heading, V3ListingRow, type V3ListingRowData } from '@/components/site/v3'
import { publicCountState } from '@/lib/listing-status-public'

/**
 * Server-rendered active listing grid. Same rows the map dials use, filtered
 * to homes still for sale. A crawler and a no-JS reader see every card.
 */
export function CommunityHomesGrid({
  placeName,
  homes,
  id = 'homes',
}: {
  placeName: string
  homes: readonly V3ListingRowData[]
  id?: string
}) {
  const rows = homes.filter((home) => publicCountState(home.standardStatus) === 'for-sale')
  if (rows.length === 0) return null
  return (
    <section id={id} className={`${V3_ROOT_CLASS} community-homes-grid`} aria-labelledby="homes-heading">
      <V3Heading level={2} id="homes-heading">
        {placeName} homes for sale
      </V3Heading>
      <ol className="community-homes-grid__list">
        {rows.map((listing, index) => (
          <li key={listing.listingKey}>
            <V3ListingRow listing={listing} priority={index < 3} />
          </li>
        ))}
      </ol>
    </section>
  )
}
