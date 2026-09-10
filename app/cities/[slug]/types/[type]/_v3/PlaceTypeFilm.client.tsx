'use client'

/**
 * Fold filmstrip of photographed listings.
 *
 * SITE-89: at 375 the map used to own the whole first screen and the houses
 * sat in #homes below the atlas — invisible in the fold. Adapted from the
 * shadcn carousel job into the house V3Carousel: swipeable track, photo +
 * price + address linking to the listing. Thin on purpose so the atlas still
 * starts in the same viewport. Do not move the atlas rail (SITE-53).
 */

import Link from 'next/link'
import Image from 'next/image'
import { V3Carousel } from '@/components/site/v3/V3Carousel.client'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import './place-type-page.css'

/** Cap so the fold stays a strip, not a second inventory page. */
const FOLD_CAP = 12

export function PlaceTypeFilm({
  rows,
  label,
}: {
  rows: readonly V3ListingRowData[]
  label: string
}) {
  const filmed = rows.filter((r) => Boolean(r.photoUrl?.trim())).slice(0, FOLD_CAP)
  if (filmed.length === 0) return null

  return (
    <div className="place-type-film">
      <V3Carousel label={label} className="place-type-film__carousel">
        {filmed.map((listing, i) => {
          const ask = formatPublishedSaleAsk({
            price: listing.price,
            propertyType: listing.propertyType,
          })
          return (
            <Link
              key={listing.listingKey}
              href={listing.href}
              className="place-type-film__card"
              aria-label={`${ask ?? 'Listing'} at ${listing.addressLine}`}
            >
              <span className="place-type-film__media">
                {listing.photoUrl ? (
                  <Image
                    src={listingRowPhotoSrc(listing.photoUrl)}
                    alt={`${listing.addressLine} for sale`}
                    fill
                    sizes="(max-width: 40rem) 48vw, 11rem"
                    priority={i < 4}
                  />
                ) : null}
              </span>
              <span className="place-type-film__meta">
                <span className="place-type-film__price">{ask ?? '—'}</span>
                <span className="place-type-film__addr">{listing.addressLine}</span>
              </span>
            </Link>
          )
        })}
      </V3Carousel>
    </div>
  )
}
