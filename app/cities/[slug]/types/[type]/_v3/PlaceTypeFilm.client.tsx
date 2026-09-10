'use client'

/**
 * Fold filmstrip of photographed listings.
 *
 * SITE-89: at 375 the houses sat in #homes below the atlas — invisible in the
 * fold. Adapted from the shadcn carousel job into house V3Carousel. Contact-
 * sheet tiles (price on the photo) so the strip is inventory, not a portal
 * search card. Desktop: opening's second column beside the claim so the
 * vertical lock stays H1 → claim → Atlas. Mobile: thin strip under the claim.
 */

import Link from 'next/link'
import Image from 'next/image'
import { V3Carousel } from '@/components/site/v3/V3Carousel.client'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import './place-type-page.css'

const FOLD_CAP = 10

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
      <p className="place-type-film__eyebrow">On the market</p>
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
                    sizes="(max-width: 40rem) 48vw, 9rem"
                    priority={i < 4}
                  />
                ) : null}
                <span className="place-type-film__scrim" aria-hidden />
                <span className="place-type-film__meta">
                  <span className="place-type-film__price">{ask ?? '—'}</span>
                </span>
              </span>
            </Link>
          )
        })}
      </V3Carousel>
    </div>
  )
}
