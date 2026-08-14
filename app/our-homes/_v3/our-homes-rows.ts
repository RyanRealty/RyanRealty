/**
 * Office listings -> Field rows for /our-homes. A row earns a place when it
 * has a ListingKey, a street, and a list price. Count is a caption.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { PriceDropTile } from '@/lib/data'
import { listingDetailPath, slugify } from '@/lib/slug'
import { livePrice } from '@/app/_v3/live-format'

export const SHOWN_LISTINGS = 12

export const OUR_HOMES_TRACE =
  'active and pending single-family listings where ListOfficeName is Ryan Realty LLC, regional MLS'

export function ourHomesCaption(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 home listed by this office' : `${count} homes listed by this office`
}

export function ourHomesTowns(
  listings: readonly PriceDropTile[],
): { label: string; href: string }[] {
  const seen = new Set<string>()
  const towns: { label: string; href: string }[] = []
  for (const listing of listings) {
    const city = listing.City?.trim()
    if (!city) continue
    const key = city.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    towns.push({ label: city, href: `/cities/${slugify(city)}` })
  }
  return towns
}

export function ourHomesFieldItems(listings: readonly PriceDropTile[]): V3FieldItem[] {
  const items: V3FieldItem[] = []
  for (const listing of listings) {
    if (items.length >= SHOWN_LISTINGS) break
    const key = listing.ListingKey?.trim()
    if (!key) continue
    const price = livePrice(listing.ListPrice)
    if (!price || !/\$/.test(price)) continue
    const street = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const meta = [
      listing.BedroomsTotal != null ? `${listing.BedroomsTotal} bd` : null,
      listing.BathroomsTotal != null ? `${listing.BathroomsTotal} ba` : null,
      listing.TotalLivingAreaSqFt != null
        ? `${listing.TotalLivingAreaSqFt.toLocaleString('en-US')} sqft`
        : null,
      listing.City?.trim() || null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')
    const photo = listing.PhotoURL?.trim()
    const lat = listing.Latitude
    const lng = listing.Longitude
    items.push({
      id: key,
      href: listingDetailPath(
        key,
        { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City },
        { city: listing.City, subdivision: listing.SubdivisionName },
        { mlsNumber: listing.ListNumber },
      ),
      priceLabel: price,
      title: street,
      ...(photo ? { photoSrc: photo } : {}),
      ...(meta ? { meta } : {}),
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    })
  }
  return items
}
