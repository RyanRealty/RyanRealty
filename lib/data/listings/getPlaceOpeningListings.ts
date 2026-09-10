/**
 * Recent listing photos + 30-day new counts by the types a place actually has
 * (SITE-43 alerts strip). Houses counts on the page stay leftoverHudKpis /
 * publicPace.newCount30d. Condo and land 30-day counts come from listing_tile_mv
 * (active, on_market_date in the last 30 days) and the source line names that.
 *
 * Photos are never a count. Do not print this file's house tally next to the
 * leftover door.
 */

import { cacheTag, CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import {
  getListingTiles,
  getListingTilesCount,
  type GetListingTilesFilter,
} from '@/lib/data/listings/getListingTiles'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'

export type PlaceOpeningTypeKey = 'houses' | 'condo' | 'land'

export type PlaceOpeningListing = {
  href: string
  photoSrc: string
  title: string
}

export type PlaceOpeningListingBucket = {
  key: PlaceOpeningTypeKey
  label: string
  noun: { one: string; many: string }
  newCount30d: number | null
  source: 'listing_tile_mv'
  listings: PlaceOpeningListing[]
}

const TYPES: readonly {
  key: PlaceOpeningTypeKey
  label: string
  noun: { one: string; many: string }
  propertyType: string
  propertySubType?: string
}[] = [
  {
    key: 'houses',
    label: 'Houses',
    noun: { one: 'house', many: 'houses' },
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
  },
  {
    key: 'condo',
    label: 'Condos',
    noun: { one: 'condo', many: 'condos' },
    propertyType: 'B',
  },
  {
    key: 'land',
    label: 'Land',
    noun: { one: 'lot', many: 'lots' },
    propertyType: 'D',
  },
]

function since30d(now = new Date()): string {
  return new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
}

export type PlaceOpeningListingsInput = {
  city?: string
  neighborhood?: string
  subdivision?: string
}

function geoFilter(input: PlaceOpeningListingsInput): GetListingTilesFilter {
  return {
    city: input.city,
    neighborhood: input.neighborhood,
    subdivision: input.subdivision,
    status: 'active',
    sort: 'newest',
  }
}

async function fetchPlaceOpeningListings(
  input: PlaceOpeningListingsInput,
): Promise<PlaceOpeningListingBucket[]> {
  const since = since30d()
  const geo = geoFilter(input)
  const buckets = await Promise.all(
    TYPES.map(async (type) => {
      const base = {
        ...geo,
        propertyType: type.propertyType,
        propertySubType: type.propertySubType,
      }
      const [count, tiles] = await Promise.all([
        getListingTilesCount({ ...base, onMarketAfter: since, limit: 1 }),
        getListingTiles({ ...base, limit: 8 }),
      ])
      const listings: PlaceOpeningListing[] = []
      for (const tile of tiles) {
        const photo = tile.photoUrl?.trim()
        if (!photo) continue
        const title =
          publishStreetLine({
            streetNumber: tile.streetNumber,
            streetName: tile.streetName,
            streetSuffix: tile.streetSuffix,
          }) ?? tile.city ?? type.label
        listings.push({ href: listingTileHref(tile), photoSrc: listingRowPhotoSrc(photo), title })
        if (listings.length >= 4) break
      }
      const newCount30d = count > 0 ? count : null
      return {
        key: type.key,
        label: type.label,
        noun: type.noun,
        newCount30d,
        source: 'listing_tile_mv' as const,
        listings,
      }
    }),
  )
  return buckets.filter((bucket) => bucket.newCount30d != null || bucket.listings.length > 0)
}

export const getPlaceOpeningListings = (
  input: PlaceOpeningListingsInput,
): Promise<PlaceOpeningListingBucket[]> => {
  const key = JSON.stringify({
    city: input.city ?? '',
    neighborhood: input.neighborhood ?? '',
    subdivision: input.subdivision ?? '',
  })
  return makeResilientCached(
    () => fetchPlaceOpeningListings(input),
    ['place-opening-listings-v1', key],
    { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
    [],
  )()
}
