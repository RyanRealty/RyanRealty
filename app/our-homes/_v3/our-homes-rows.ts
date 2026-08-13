/**
 * Brokerage listing rows for /our-homes. A row earns a place when it has a
 * ListingKey, a street, and a list price. "Address on request" is not a name.
 */

import type { V3LedgerFigureRow } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import type { PriceDropTile } from '@/lib/data'
import { listingDetailPath } from '@/lib/slug'
import { livePrice } from '@/app/_v3/live-format'

export const SHOWN_LISTINGS = 12

export function ourHomesRows(listings: readonly PriceDropTile[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const listing of listings) {
    if (rows.length >= SHOWN_LISTINGS) break
    const key = listing.ListingKey?.trim()
    if (!key) continue
    const price = livePrice(listing.ListPrice)
    if (!price) continue
    const street = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const city = listing.City?.trim()
    const meta = [
      listing.BedroomsTotal != null ? `${listing.BedroomsTotal} bd` : null,
      listing.BathroomsTotal != null ? `${listing.BathroomsTotal} ba` : null,
      listing.TotalLivingAreaSqFt != null
        ? `${listing.TotalLivingAreaSqFt.toLocaleString('en-US')} sqft`
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')
    rows.push({
      href: listingDetailPath(
        key,
        { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City },
        { city: listing.City, subdivision: listing.SubdivisionName },
        { mlsNumber: listing.ListNumber },
      ),
      when: v3Text(city || 'Central Oregon'),
      what: v3Text(street),
      detail: meta ? v3Text(meta) : undefined,
      value: v3Text(price),
      id: key,
      ...(listing.PhotoURL ? { media: { src: listing.PhotoURL } } : {}),
    })
  }
  return rows
}
