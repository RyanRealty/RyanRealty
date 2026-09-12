'use client'

/**
 * Fold rail of photographed listings (SITE-89).
 *
 * Adapted from the shadcn carousel job into house V3Carousel `mode="rail"`.
 * Cards carry price + address + beds/baths/sqft on 800×600 plates — never the
 * 320×240 ledger thumb. Prev/next stay the installed shadcn controls (icons),
 * restyled navy/cream — do not replace them with DIY chevrons (demoMatch).
 *
 * Layout lock keeps this AFTER Atlas: H1 → claim → Atlas → rail.
 */

import Link from 'next/link'
import Image from 'next/image'
import { V3Carousel } from '@/components/site/v3'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
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

/** Pick photographed rows that read as the claim's band, not only the floor. */
function filmRows(
  rows: readonly V3ListingRowData[],
  bandLow: number | null,
  bandHigh: number | null,
): V3ListingRowData[] {
  const filmed = rows.filter((r) => Boolean(r.photoUrl?.trim()))
  if (filmed.length === 0) return []

  const low = bandLow != null && Number.isFinite(bandLow) ? bandLow : null
  const high = bandHigh != null && Number.isFinite(bandHigh) ? bandHigh : null
  const inBand =
    low != null && high != null
      ? filmed.filter((r) => {
          const p = r.price
          return p != null && p >= low && p <= high
        })
      : filmed

  const pool = (inBand.length >= 4 ? inBand : filmed)
    .slice()
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))

  if (pool.length <= FOLD_CAP) return pool

  /* Spread across the band so the rail matches the sentence, not twelve $470Ks. */
  const picks: V3ListingRowData[] = []
  const seen = new Set<string>()
  const push = (row: V3ListingRowData | undefined) => {
    if (!row || seen.has(row.listingKey)) return
    seen.add(row.listingKey)
    picks.push(row)
  }
  push(pool[0])
  push(pool[pool.length - 1])
  const steps = FOLD_CAP - 2
  for (let i = 1; i <= steps; i += 1) {
    const idx = Math.round((i / (steps + 1)) * (pool.length - 1))
    push(pool[idx])
    if (picks.length >= FOLD_CAP) break
  }
  return picks.slice(0, FOLD_CAP)
}

export function PlaceTypeFilm({
  rows,
  label,
  bandLow = null,
  bandHigh = null,
}: {
  rows: readonly V3ListingRowData[]
  label: string
  bandLow?: number | null
  bandHigh?: number | null
}) {
  const filmed = filmRows(rows, bandLow, bandHigh)
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
          const shareKind = publishListingShareKind({
            propertySubType: listing.propertySubType,
            subdivisionName: listing.subdivisionName,
            city: listing.city,
            listNumber: listing.listNumber,
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
                    sizes="(max-width: 40rem) 70vw, 14rem"
                    priority={i < 4}
                  />
                ) : null}
              </span>
              <span className="place-type-film__body">
                <span className="place-type-film__price">{ask ?? '—'}</span>
                {shareKind ? <span className="place-type-film__share">{shareKind}</span> : null}
                <span className="place-type-film__addr">{listing.addressLine}</span>
                {specs ? <span className="place-type-film__specs">{specs}</span> : null}
              </span>
            </Link>
          )
        })}
      </V3Carousel>
    </div>
  )
}
