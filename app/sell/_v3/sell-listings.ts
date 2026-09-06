/**
 * Office listings as house rows for the Sell shop (photo, price, beds,
 * baths, sqft, street). Same query as /our-homes. Cap six: a longer
 * ledger without encoding is a table.
 */
import type { V3LedgerFigureRow } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import type { PriceDropTile } from '@/lib/data'
import { listingDetailPath } from '@/lib/slug'
import { livePrice } from '@/app/_v3/live-format'

export const SHOWN_LISTINGS = 6

export const OUR_LISTINGS_TRACE =
  'active and pending single-family listings where ListOfficeName is Ryan Realty LLC, regional MLS'

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
    const city = listing.City?.trim()
    rows.push({
      id: key,
      href: listingDetailPath(
        key,
        { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City },
        { city: listing.City, subdivision: listing.SubdivisionName },
        { mlsNumber: listing.ListNumber },
      ),
      what: v3Text(street),
      value: v3Text(price),
      ...(city ? { when: v3Text(city) } : {}),
      ...(detail ? { detail: v3Text(detail) } : {}),
      ...(photo ? { media: { src: photo } } : {}),
    })
  }
  return rows
}
