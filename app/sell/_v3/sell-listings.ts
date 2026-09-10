/**
 * Office listings as house rows for the Sell shop (photo, price, beds,
 * baths, sqft, street). Same query as /our-homes. Cap six: a longer
 * ledger without encoding is a table.
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
    const detail = [
      listing.BedroomsTotal != null ? `${listing.BedroomsTotal} bd` : null,
      listing.BathroomsTotal != null ? `${listing.BathroomsTotal} ba` : null,
      listing.TotalLivingAreaSqFt != null
        ? `${listing.TotalLivingAreaSqFt.toLocaleString('en-US')} sqft`
        : null,
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
