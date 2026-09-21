/**
 * SITE-128 Tip Ready #1 — competitive first-look helpers.
 *
 * Fold listings + photo cards only. One place boundary is the caller's
 * GeoJSON (city ring or neighborhood ring). Child cells / amenity geom /
 * crumbs / keep-exploring stay out of this file.
 */

import type { ListingForMap } from '@/components/SearchMapClustered'
import type { ListingTileRow } from '@/app/actions/listings'
import type { PlaceOpeningListing, PlaceOpeningListingBucket } from '@/lib/data/listings/getPlaceOpeningListings'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPublishedSaleAskCompact } from '@/lib/listing/publish-listing-ask'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'

export const PLACE_LOOK_CARD_LIMIT = 6
/** Spread-sample only. 240 city pins SuperCluster into one count bubble at
 *  city zoom (Matt phone FAIL: "Bend Right Now / 240 cluster only"). First
 *  look needs readable $ pills on one ring, not a cream cluster atlas. */
export const CITY_LOOK_PIN_CAP = 36

export type PlaceLookCard = PlaceOpeningListing

export type AtlasDotLike = {
  k: string
  href?: string
  lat: number
  lng: number
  p: number | null
  t?: string
  s?: string
  photo?: string | null
  street?: string | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
}

const PIN_STATUS = new Set(['active', 'pending'])

function finiteCoord(lat: unknown, lng: unknown): lat is number {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
}

/** Houses-first photo rail from the place opening buckets. Photos only. */
export function photoCardsFromOpening(
  buckets: readonly PlaceOpeningListingBucket[],
  limit = PLACE_LOOK_CARD_LIMIT,
): PlaceLookCard[] {
  const cards: PlaceLookCard[] = []
  const order = ['houses', 'condo', 'land'] as const
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const key of order) {
    const bucket = byKey.get(key)
    if (!bucket) continue
    for (const listing of bucket.listings) {
      if (!listing.photoSrc?.trim()) continue
      cards.push(listing)
      if (cards.length >= limit) return cards
    }
  }
  return cards
}

/** Fallback rail when opening buckets have no photographs. */
export function photoCardsFromMapListings(
  listings: readonly ListingForMap[],
  limit = PLACE_LOOK_CARD_LIMIT,
): PlaceLookCard[] {
  const cards: PlaceLookCard[] = []
  for (const listing of listings) {
    const photo = listing.PhotoURL?.trim()
    if (!photo) continue
    const key = listing.ListingKey != null ? String(listing.ListingKey) : ''
    if (!key) continue
    const title =
      publishStreetLine({
        streetNumber: listing.StreetNumber,
        streetName: listing.StreetName,
        streetSuffix: listing.StreetSuffix,
      }) ?? listing.City ?? 'Home'
    const price = formatPublishedSaleAskCompact({
      price: listing.ListPrice,
      propertyType: listing.PropertyType,
    })
    cards.push({
      href: listingTileHref({
        listingKey: key,
        listNumber: listing.ListNumber != null ? String(listing.ListNumber) : null,
        streetNumber: listing.StreetNumber,
        streetName: listing.StreetName,
        city: listing.City,
        boundaryCity: listing.BoundaryCity ?? null,
        boundaryNeighborhood: listing.BoundaryNeighborhood ?? null,
        subdivisionName: listing.SubdivisionName ?? null,
      }),
      photoSrc: listingRowPhotoSrc(photo),
      title,
      price,
      beds: listing.BedroomsTotal ?? null,
      baths: listing.BathroomsTotal ?? null,
      sqft: listing.TotalLivingAreaSqFt ?? null,
    })
    if (cards.length >= limit) break
  }
  return cards
}

export function placeLookPhotoCards(input: {
  buckets: readonly PlaceOpeningListingBucket[]
  listings: readonly ListingForMap[]
  limit?: number
}): PlaceLookCard[] {
  const limit = input.limit ?? PLACE_LOOK_CARD_LIMIT
  const fromOpening = photoCardsFromOpening(input.buckets, limit)
  if (fromOpening.length > 0) return fromOpening
  return photoCardsFromMapListings(input.listings, limit)
}

export function listingsFromAtlasDots(dots: readonly AtlasDotLike[]): ListingForMap[] {
  const out: ListingForMap[] = []
  for (const dot of dots) {
    if (!finiteCoord(dot.lat, dot.lng)) continue
    if (dot.s && !PIN_STATUS.has(dot.s)) continue
    out.push({
      ListingKey: dot.k,
      ListPrice: dot.p,
      Latitude: dot.lat,
      Longitude: dot.lng,
      PhotoURL: dot.photo ?? null,
      StreetName: dot.street ?? null,
      BedroomsTotal: dot.beds ?? null,
      BathroomsTotal: dot.baths ?? null,
      TotalLivingAreaSqFt: dot.sqft ?? null,
    })
  }
  return out
}

export function listingsFromTiles(tiles: readonly ListingTile[]): ListingForMap[] {
  const out: ListingForMap[] = []
  for (const tile of tiles) {
    if (!finiteCoord(tile.lat, tile.lng)) continue
    const photo = tile.photoUrl?.trim()
    out.push({
      ListingKey: tile.listingKey,
      ListNumber: tile.listNumber,
      ListPrice: tile.listPrice,
      Latitude: tile.lat,
      Longitude: tile.lng,
      PhotoURL: photo ? listingRowPhotoSrc(photo) : tile.photoUrl,
      StreetNumber: tile.streetNumber,
      StreetName: tile.streetName,
      StreetSuffix: tile.streetSuffix ?? null,
      City: tile.city,
      State: 'OR',
      PostalCode: tile.postalCode,
      BedroomsTotal: tile.beds,
      BathroomsTotal: tile.baths,
      TotalLivingAreaSqFt: tile.sqft,
      PropertyType: tile.propertyType,
      PropertySubType: tile.propertySubType,
      SubdivisionName: tile.subdivisionName,
      BoundaryCity: tile.boundaryCity,
      BoundaryNeighborhood: tile.boundaryNeighborhood,
    })
  }
  return out
}

/** Spread-sample so a city cap does not keep only one neighborhood. */
export function capLookListings(
  listings: readonly ListingForMap[],
  cap = CITY_LOOK_PIN_CAP,
): ListingForMap[] {
  if (listings.length <= cap) return [...listings]
  const out: ListingForMap[] = []
  const step = listings.length / cap
  for (let i = 0; i < cap; i += 1) {
    const row = listings[Math.min(listings.length - 1, Math.floor(i * step))]
    if (row) out.push(row)
  }
  return out
}

export function listingsFromTileRows(rows: readonly ListingTileRow[]): ListingForMap[] {
  const out: ListingForMap[] = []
  for (const row of rows) {
    if (!finiteCoord(row.Latitude, row.Longitude)) continue
    const photo = row.PhotoURL?.trim()
    const sqft = (row as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt ?? null
    out.push({
      ListingKey: row.ListingKey,
      ListNumber: row.ListNumber ?? null,
      ListPrice: row.ListPrice,
      Latitude: row.Latitude,
      Longitude: row.Longitude,
      PhotoURL: photo ? listingRowPhotoSrc(photo) : row.PhotoURL,
      StreetNumber: row.StreetNumber,
      StreetName: row.StreetName,
      StreetSuffix: row.StreetSuffix ?? null,
      City: row.City,
      State: row.State,
      PostalCode: row.PostalCode,
      BedroomsTotal: row.BedroomsTotal,
      BathroomsTotal: row.BathroomsTotal,
      TotalLivingAreaSqFt: sqft,
      PropertyType: row.PropertyType,
      PropertySubType: row.PropertySubType,
      SubdivisionName: row.SubdivisionName,
      BoundaryCity: row.BoundaryCity ?? null,
      BoundaryNeighborhood: row.BoundaryNeighborhood ?? null,
    })
  }
  return out
}
