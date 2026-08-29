import { V3Field } from '@/components/site/v3'
import { formatPriceExact } from '@/lib/format/money'
import { cn } from '@/lib/utils'
import type { ListingFace } from '@/lib/listing/listing-face'
import { ListingSectionHead } from './ListingSectionHead'

/**
 * See location. V3 Field plot with a navy pin. Google static tiles
 * stay out of the listing hero and out of this job.
 */

type Props = {
  lat: number | null
  lng: number | null
  lifestyleLine?: string | null
  className?: string
  addressLine?: string | null
  cityLine?: string | null
  href?: string | null
  price?: number | null
  heading?: string | false
  face?: ListingFace
}

export function ListingLocationMap({
  lat,
  lng,
  lifestyleLine,
  className,
  addressLine,
  cityLine,
  href,
  price,
  heading = 'See location',
  face = 'house',
}: Props) {
  if (lat == null || lng == null) return null

  const dest = href?.trim() || '#listing-location'
  const title = addressLine?.trim() || (face === 'land' ? 'This lot' : 'This home')
  const priceLabel = price != null ? formatPriceExact(price) : 'Ask for price'

  return (
    <section id="listing-location" className={cn('section', className)}>
      <ListingSectionHead heading={heading} />
      <V3Field
        ariaLabel="See location"
        items={[
          {
            id: dest,
            href: dest,
            priceLabel,
            title,
            meta: cityLine?.trim() || undefined,
            lat,
            lng,
          },
        ]}
      />
      {lifestyleLine ? (
        <p className="listing-location-note">{lifestyleLine}</p>
      ) : null}
    </section>
  )
}
