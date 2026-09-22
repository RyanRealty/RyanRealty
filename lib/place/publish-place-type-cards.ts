/**
 * Cards for the place-page property-type slider.
 * Detached leftover is the first card. Extra types come from public segments.
 * Miss omits. Nothing is invented.
 *
 * The KPI body opens the place-type page (`/cities/{slug}/types/{preset}` or
 * `/communities/{slug}/types/{preset}`). A house photograph on the card opens
 * that listing. A homes-for-sale city path rewrites to the city type page.
 * Unknown keys keep a defined query.
 */
import {
  publicSegmentDisplayBits,
  publicSegmentFilterParams,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { formatPriceCompact, formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'
import { placeTypeKey, type PlaceTypeKey } from '@/lib/place/place-type-style'

export type PlaceTypeCover = {
  photoUrl: string
  listingHref: string | null
  street: string | null
  price: string | null
}

export type PlaceTypeCard = {
  key: string
  href: string
  title: string
  count: string | null
  bits: string[]
  active: boolean
  photoUrl: string | null
  /** The photographed house, when the thumb is a real listing still. */
  listingHref: string | null
  listingStreet: string | null
  listingPrice: string | null
}

export function resolvePlaceTypeCover(
  value: string | PlaceTypeCover | null | undefined,
): PlaceTypeCover | null {
  if (!value) return null
  if (typeof value === 'string') {
    const photoUrl = value.trim()
    return photoUrl ? { photoUrl, listingHref: null, street: null, price: null } : null
  }
  const photoUrl = value.photoUrl?.trim()
  if (!photoUrl) return null
  return {
    photoUrl,
    listingHref: value.listingHref?.trim() || null,
    street: value.street?.trim() || null,
    price: value.price?.trim() || null,
  }
}

type CoverListingRow = {
  photoUrl?: string | null
  PhotoURL?: string | null
  listingKey?: string | null
  ListingKey?: string | null
  listNumber?: string | null
  ListNumber?: string | number | null
  listPrice?: number | null
  ListPrice?: number | null
  streetNumber?: string | null
  StreetNumber?: string | null
  streetName?: string | null
  StreetName?: string | null
  streetSuffix?: string | null
  StreetSuffix?: string | null
  city?: string | null
  City?: string | null
  boundaryCity?: string | null
  BoundaryCity?: string | null
  boundaryNeighborhood?: string | null
  BoundaryNeighborhood?: string | null
  subdivisionName?: string | null
  SubdivisionName?: string | null
  propertySubType?: string | null
  PropertySubType?: string | null
  propertyType?: string | null
  PropertyType?: string | null
}

export function coverFromListingRow(row: CoverListingRow): PlaceTypeCover | null {
  const photoRaw = row.PhotoURL ?? row.photoUrl
  if (!photoRaw?.trim()) return null
  const listingKey = row.listingKey ?? row.ListingKey ?? null
  const listNumberRaw = row.listNumber ?? row.ListNumber
  const listNumber = listNumberRaw != null ? String(listNumberRaw) : null
  const listPrice = row.ListPrice ?? row.listPrice ?? null
  const street = publishStreetLine({
    streetNumber: row.streetNumber ?? row.StreetNumber,
    streetName: row.streetName ?? row.StreetName,
    streetSuffix: row.streetSuffix ?? row.StreetSuffix,
  })
  return {
    photoUrl: listingRowPhotoSrc(photoRaw, LISTING_FIELD_LEAD_PHOTO_SIZE),
    listingHref:
      listingKey || listNumber
        ? listingTileHref({
            listingKey,
            listNumber,
            streetNumber: row.streetNumber ?? row.StreetNumber,
            streetName: row.streetName ?? row.StreetName,
            city: row.city ?? row.City,
            boundaryCity: row.boundaryCity ?? row.BoundaryCity ?? null,
            boundaryNeighborhood: row.boundaryNeighborhood ?? row.BoundaryNeighborhood ?? null,
            subdivisionName: row.subdivisionName ?? row.SubdivisionName ?? null,
          })
        : null,
    street,
    price:
      listPrice != null && Number.isFinite(listPrice) && listPrice > 0
        ? formatPriceCompact(listPrice)
        : null,
  }
}

/** One Active listing with a photo, per card key. Codes fit getListingTiles. */
export const PLACE_TYPE_COVER_SPECS: ReadonlyArray<{
  key: PlaceTypeKey
  propertyType?: string
  propertySubType?: string
}> = [
  { key: 'sfr', propertySubType: 'Single Family Residence' },
  { key: 'condo', propertySubType: 'Condominium' },
  { key: 'townhome', propertySubType: 'Townhouse' },
  { key: 'manufactured_land', propertySubType: 'Manufactured On Land' },
  { key: 'manufactured_park', propertySubType: 'In Park' },
  { key: 'multifamily_2_4', propertyType: 'C' },
  { key: 'land', propertyType: 'D' },
  { key: 'farm', propertyType: 'E' },
  { key: 'commercial_sale', propertyType: 'F' },
  { key: 'business', propertyType: 'H' },
]

/** Place-type URL slugs. Same values the old search presets used. */
export const PLACE_TYPE_SEARCH_PRESET: Partial<Record<PlaceTypeKey, string>> = {
  sfr: 'single-family',
  condo: 'condos',
  townhome: 'townhomes',
  multifamily_2_4: 'multi-family',
  land: 'lots-and-land',
  manufactured_land: 'manufactured-on-land',
  manufactured_park: 'manufactured-in-park',
  farm: 'farms',
  commercial_sale: 'commercial',
  business: 'businesses',
}

export const PLACE_TYPE_PAGE_SLUGS = [
  'single-family',
  'condos',
  'townhomes',
  'multi-family',
  'lots-and-land',
  'manufactured-on-land',
  'manufactured-in-park',
  'farms',
  'commercial',
  'businesses',
] as const

export type PlaceTypePageSlug = (typeof PLACE_TYPE_PAGE_SLUGS)[number]

const PRESET_TO_KEY = Object.fromEntries(
  Object.entries(PLACE_TYPE_SEARCH_PRESET).map(([key, slug]) => [slug, key]),
) as Record<string, PlaceTypeKey>

export function placeTypeKeyFromPageSlug(slug: string): PlaceTypeKey | null {
  const key = PRESET_TO_KEY[slug.trim().toLowerCase()]
  return key ?? null
}

/**
 * City `/homes-for-sale/{city}` and already-canonical `/cities/{slug}` /
 * `/communities/{slug}` bases become `/…/types/{preset}`. A three-segment
 * search path (neighborhood / plat) keeps the search preset until those
 * grains have a type page.
 */
export function placeTypeLandingPath(browsePath: string, preset: string): string | null {
  const base = browsePath.trim().replace(/\/+$/, '') || '/homes-for-sale'
  const cities = base.match(/^\/cities\/([^/]+)$/)
  if (cities) return `/cities/${cities[1]}/types/${preset}`
  const communities = base.match(/^\/communities\/([^/]+)$/)
  if (communities) return `/communities/${communities[1]}/types/${preset}`
  const citySearch = base.match(/^\/homes-for-sale\/([^/]+)$/)
  if (citySearch) return `/cities/${citySearch[1]}/types/${preset}`
  return null
}

export function placeTypeCoverPhotos(
  listings: ReadonlyArray<CoverListingRow>,
): Record<string, PlaceTypeCover> {
  const covers: Record<string, PlaceTypeCover> = {}
  for (const row of listings) {
    const cover = coverFromListingRow(row)
    if (!cover) continue
    const key = placeTypeKey(
      row.PropertyType ?? row.propertyType,
      row.PropertySubType ?? row.propertySubType,
    )
    if (!covers[key]) covers[key] = cover
  }
  return covers
}

export function searchParamsQuery(
  sp: Record<string, string | string[] | undefined> | undefined,
): string {
  if (!sp) return ''
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(sp)) {
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value) params.set(key, value)
  }
  return params.toString()
}

export function placeTypeSearchHref(
  browsePath: string,
  key: string,
  filter: { propertyType?: string; propertySubTypes?: string },
): string {
  const base = browsePath.trim().replace(/\/+$/, '') || '/homes-for-sale'
  const preset = PLACE_TYPE_SEARCH_PRESET[key as PlaceTypeKey]
  if (preset) {
    const landing = placeTypeLandingPath(base, preset)
    if (landing) return landing
    return `${base}/${preset}`
  }
  const params = new URLSearchParams()
  if (filter.propertyType) params.set('propertyType', filter.propertyType)
  if (filter.propertySubTypes) params.set('propertySubTypes', filter.propertySubTypes)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export function publishPlaceTypeCards(input: {
  browsePath: string
  placeName: string
  sfrCount: number | null
  sfrMedian: number | null
  sfrMos: number | null
  segments: readonly PublicSegmentRow[]
  covers?: Readonly<Record<string, string | PlaceTypeCover>>
}): PlaceTypeCard[] {
  const covers = input.covers ?? {}
  const cards: PlaceTypeCard[] = []
  const sfrFilter = {
    propertyType: 'A',
    propertySubTypes: 'Single Family Residence',
  }

  const sfrCover = resolvePlaceTypeCover(covers.sfr)
  const sfrBits: string[] = []
  if (input.sfrMedian != null && input.sfrMedian > 0) sfrBits.push(formatPriceExact(input.sfrMedian))
  if (input.sfrMos != null && input.sfrMos > 0) sfrBits.push(`${formatMonthsOfSupply(input.sfrMos)} months`)
  cards.push({
    key: 'sfr',
    href: placeTypeSearchHref(input.browsePath, 'sfr', sfrFilter),
    title: `Single-family in ${input.placeName}`,
    count: input.sfrCount != null ? input.sfrCount.toLocaleString('en-US') : null,
    bits: sfrBits,
    photoUrl: sfrCover?.photoUrl ?? null,
    listingHref: sfrCover?.listingHref ?? null,
    listingStreet: sfrCover?.street ?? null,
    listingPrice: sfrCover?.price ?? null,
    active: false,
  })

  for (const row of input.segments) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    const filter = publicSegmentFilterParams(row.segment)
    if (!filter) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    const cover = resolvePlaceTypeCover(covers[row.segment])
    cards.push({
      key: row.segment,
      href: placeTypeSearchHref(input.browsePath, row.segment, filter),
      title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} in ${input.placeName}`,
      count: row.activeCount.toLocaleString('en-US'),
      bits: publicSegmentDisplayBits(row).slice(0, 3),
      photoUrl: cover?.photoUrl ?? null,
      listingHref: cover?.listingHref ?? null,
      listingStreet: cover?.street ?? null,
      listingPrice: cover?.price ?? null,
      active: false,
    })
  }
  return cards
}
