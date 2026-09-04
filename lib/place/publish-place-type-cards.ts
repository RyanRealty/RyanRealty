/**
 * Cards for the place-page property-type slider.
 * Detached leftover is the first card. Extra types come from public segments.
 * Miss omits. Nothing is invented.
 *
 * Each card opens the place-type page (`/cities/{slug}/types/{preset}` or
 * `/communities/{slug}/types/{preset}`). A homes-for-sale city path rewrites
 * to the city type page. Unknown keys keep a defined query.
 */
import {
  publicSegmentDisplayBits,
  publicSegmentFilterParams,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { placeTypeKey, type PlaceTypeKey } from '@/lib/place/place-type-style'

export type PlaceTypeCard = {
  key: string
  href: string
  title: string
  count: string | null
  bits: string[]
  active: boolean
  photoUrl: string | null
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
  listings: ReadonlyArray<{
    photoUrl?: string | null
    PhotoURL?: string | null
    propertySubType?: string | null
    PropertySubType?: string | null
    propertyType?: string | null
    PropertyType?: string | null
  }>,
): Record<string, string> {
  const covers: Record<string, string> = {}
  for (const row of listings) {
    const photo = row.PhotoURL ?? row.photoUrl
    if (!photo) continue
    const key = placeTypeKey(
      row.PropertyType ?? row.propertyType,
      row.PropertySubType ?? row.propertySubType,
    )
    if (!covers[key]) covers[key] = photo
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
  covers?: Readonly<Record<string, string>>
}): PlaceTypeCard[] {
  const covers = input.covers ?? {}
  const cards: PlaceTypeCard[] = []
  const sfrFilter = {
    propertyType: 'A',
    propertySubTypes: 'Single Family Residence',
  }

  const sfrBits: string[] = []
  if (input.sfrMedian != null && input.sfrMedian > 0) sfrBits.push(formatPriceExact(input.sfrMedian))
  if (input.sfrMos != null && input.sfrMos > 0) sfrBits.push(`${formatMonthsOfSupply(input.sfrMos)} months`)
  cards.push({
    key: 'sfr',
    href: placeTypeSearchHref(input.browsePath, 'sfr', sfrFilter),
    title: `Single-family in ${input.placeName}`,
    count: input.sfrCount != null ? input.sfrCount.toLocaleString('en-US') : null,
    bits: sfrBits,
    photoUrl: covers.sfr ?? null,
    active: false,
  })

  for (const row of input.segments) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    const filter = publicSegmentFilterParams(row.segment)
    if (!filter) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    cards.push({
      key: row.segment,
      href: placeTypeSearchHref(input.browsePath, row.segment, filter),
      title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} in ${input.placeName}`,
      count: row.activeCount.toLocaleString('en-US'),
      bits: publicSegmentDisplayBits(row).slice(0, 3),
      photoUrl: covers[row.segment] ?? null,
      active: false,
    })
  }
  return cards
}
