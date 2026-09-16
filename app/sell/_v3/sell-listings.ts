/**
 * Office listings as house rows for the Sell shop (photo, price, beds,
 * baths, sqft, street, and whether the house is still available). Same query
 * as /our-homes. Cap six: a longer ledger without encoding is a table.
 *
 * SITE-111 information increment: the row now says the listing's MLS status
 * when it is anything other than plain Active. A seller reading "what has this
 * office listed" is reading the office's record, and "Pending" is the part of
 * that record the old row dropped. Active is the default state of a for-sale
 * row, so printing it would be noise, not information.
 */
import type { V3LedgerFigureRow } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import type { PriceDropTile } from '@/lib/data'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'
import { livePrice } from '@/app/_v3/live-format'

export const SHOWN_LISTINGS = 6

export const OUR_LISTINGS_TRACE =
  'Central Oregon MLS, active and pending single-family homes listed by Ryan Realty.'

export function sellListingRows(
  listings: readonly PriceDropTile[],
): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const listing of listings) {
    if (rows.length >= SHOWN_LISTINGS) break
    const key = listing.ListingKey?.trim()
    if (!key) continue
    const price = livePrice(listing.ListPrice)
    if (!price || !/\$/.test(price)) continue
    const street = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const status = listing.StandardStatus?.trim()
    const standing = status && status.toLowerCase() !== 'active' ? status : null
    const detail = [
      listing.BedroomsTotal != null ? `${listing.BedroomsTotal} bd` : null,
      listing.BathroomsTotal != null ? `${listing.BathroomsTotal} ba` : null,
      listing.TotalLivingAreaSqFt != null
        ? `${listing.TotalLivingAreaSqFt.toLocaleString('en-US')} sqft`
        : null,
      standing,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')
    const photo = listing.PhotoURL?.trim()
    const photoSrc = photo ? listingRowPhotoSrc(photo) : ''
    const city = listing.City?.trim()
    rows.push({
      id: key,
      href: listingTileHref({
        listingKey: key,
        listNumber: listing.ListNumber,
        streetNumber: listing.StreetNumber,
        streetName: listing.StreetName,
        city: listing.City,
        boundaryCity: listing.boundary_city,
        boundaryNeighborhood: listing.boundary_neighborhood,
        subdivisionName: listing.SubdivisionName,
      }),
      what: v3Text(street),
      value: v3Text(price),
      ...(city ? { when: v3Text(city) } : {}),
      ...(detail ? { detail: v3Text(detail) } : {}),
      ...(photoSrc ? { media: { src: photoSrc } } : {}),
    })
  }
  return rows
}
