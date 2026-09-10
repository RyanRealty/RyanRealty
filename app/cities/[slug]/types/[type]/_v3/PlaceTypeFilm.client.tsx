'use client'

/**
 * Fold rail of photographed listings (SITE-89).
 *
 * Adapted from the shadcn carousel job into house V3Carousel `mode="rail"`.
 * Cards carry price + address + beds/baths/sqft on 800×600 plates — never the
 * 320×240 ledger thumb. Prev/next stay visible; swipe is Embla's.
 *
 * Desktop: second column beside the claim so the vertical lock stays
 * H1 → claim → Atlas. Mobile: compact strip under the claim so houses AND
 * Atlas share the 375 fold (a tall film used to push the map off-screen).
 */

import Link from 'next/link'
import Image from 'next/image'
import { V3Carousel } from '@/components/site/v3'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import './place-type-page.css'

const FOLD_CAP = 12

function specsLine(listing: V3ListingRowData): string | null {
  const parts: string[] = []
  if (listing.beds != null) parts.push(`${listing.beds} bd`)
  if (listing.baths != null) parts.push(`${listing.baths} ba`)
  if (listing.sqft != null && listing.sqft > 0) {
    parts.push(`${listing.sqft.toLocaleString('en-US')} sqft`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function PlaceTypeFilm({
  rows,
  label,
}: {
  rows: readonly V3ListingRowData[]
  label: string
}) {
  /* Floor-first so the rail opens near the claim's low ask, not the $11.9M end. */
  const filmed = rows
    .filter((r) => Boolean(r.photoUrl?.trim()))
    .slice()
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
    .slice(0, FOLD_CAP)
  if (filmed.length === 0) return null

  return (
    <div className="place-type-film">
      <p className="place-type-film__eyebrow">On the market</p>
      <V3Carousel label={label} mode="rail" className="place-type-film__carousel">
        {filmed.map((listing, i) => {
          const ask = formatPublishedSaleAsk({
            price: listing.price,
            propertyType: listing.propertyType,
          })
          const specs = specsLine(listing)
          const src = listing.photoUrl
            ? listingRowPhotoSrc(listing.photoUrl, LISTING_FIELD_LEAD_PHOTO_SIZE)
            : null
          return (
            <Link
              key={listing.listingKey}
              href={listing.href}
              className="place-type-film__card"
              aria-label={
                specs
                  ? `${ask ?? 'Listing'} at ${listing.addressLine}, ${specs}`
                  : `${ask ?? 'Listing'} at ${listing.addressLine}`
              }
            >
              <span className="place-type-film__media">
                {src ? (
                  <Image
                    src={src}
                    alt=""
                    width={800}
                    height={600}
                    className="place-type-film__photo"
                    sizes="(max-width: 40rem) 58vw, 12.5rem"
                    priority={i < 4}
                  />
                ) : null}
                {/* Facts on the plate so a fold peek still shows inventory, not
                    orphan photo tops (grok-4.6 blocking on desktop strip). */}
                <span className="place-type-film__scrim" aria-hidden />
                <span className="place-type-film__on-photo">
                  <span className="place-type-film__price">{ask ?? '—'}</span>
                  <span className="place-type-film__addr">{listing.addressLine}</span>
                  {specs ? <span className="place-type-film__specs">{specs}</span> : null}
                </span>
              </span>
            </Link>
          )
        })}
      </V3Carousel>
    </div>
  )
}
