/**
 * Cards for the place-page property-type slider.
 * Detached leftover is the first card. Extra types come from public segments.
 * Miss omits. Nothing is invented.
 */
import {
  publicSegmentDisplayBits,
  publicSegmentFilterParams,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

export type PlaceTypeCard = {
  key: string
  href: string
  title: string
  count: string | null
  bits: string[]
  active: boolean
  photoUrl: string | null
}

function withParams(
  path: string,
  current: URLSearchParams,
  next: { propertyType?: string; propertySubTypes?: string },
): string {
  const params = new URLSearchParams(current.toString())
  params.delete('propertyType')
  params.delete('propertySubTypes')
  params.delete('page')
  if (next.propertyType) params.set('propertyType', next.propertyType)
  if (next.propertySubTypes) params.set('propertySubTypes', next.propertySubTypes)
  const q = params.toString()
  return q ? `${path}?${q}` : path
}

const SUBTYPE_TO_CARD: Record<string, string> = {
  'Single Family Residence': 'sfr',
  Condominium: 'condo',
  Townhouse: 'townhome',
  'Manufactured On Land': 'manufactured_land',
  'In Park': 'manufactured_park',
}

const TYPE_TO_CARD: Record<string, string> = {
  A: 'sfr',
  D: 'land',
  Land: 'land',
  C: 'multifamily_2_4',
  'multi-family': 'multifamily_2_4',
  B: 'manufactured_park',
  farm: 'farm',
  Commercial: 'commercial_sale',
  business: 'business',
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
    const sub = row.PropertySubType ?? row.propertySubType ?? ''
    const type = row.PropertyType ?? row.propertyType ?? ''
    const key = SUBTYPE_TO_CARD[sub] ?? TYPE_TO_CARD[type]
    if (key && !covers[key]) covers[key] = photo
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

export function publishPlaceTypeCards(input: {
  path: string
  search: string
  placeName: string
  sfrCount: number | null
  sfrMedian: number | null
  sfrMos: number | null
  segments: readonly PublicSegmentRow[]
  covers?: Readonly<Record<string, string>>
}): PlaceTypeCard[] {
  const current = new URLSearchParams(input.search.startsWith('?') ? input.search.slice(1) : input.search)
  const activeType = current.get('propertyType') ?? ''
  const activeSubs = current.get('propertySubTypes') ?? ''
  const covers = input.covers ?? {}
  const cards: PlaceTypeCard[] = []

  const sfrBits: string[] = []
  if (input.sfrMedian != null && input.sfrMedian > 0) sfrBits.push(formatPriceExact(input.sfrMedian))
  if (input.sfrMos != null && input.sfrMos > 0) sfrBits.push(`${formatMonthsOfSupply(input.sfrMos)} months`)
  cards.push({
    key: 'sfr',
    href: withParams(input.path, current, {
      propertyType: 'A',
      propertySubTypes: 'Single Family Residence',
    }),
    title: `Single-family in ${input.placeName}`,
    count: input.sfrCount != null ? input.sfrCount.toLocaleString('en-US') : null,
    bits: sfrBits,
    photoUrl: covers.sfr ?? null,
    active:
      activeType !== 'all' &&
      ((activeType === 'A' && activeSubs === 'Single Family Residence') ||
        (!activeType && !activeSubs)),
  })

  for (const row of input.segments) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    const filter = publicSegmentFilterParams(row.segment)
    if (!filter) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    cards.push({
      key: row.segment,
      href: withParams(input.path, current, filter),
      title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} in ${input.placeName}`,
      count: row.activeCount.toLocaleString('en-US'),
      bits: publicSegmentDisplayBits(row).slice(0, 3),
      photoUrl: covers[row.segment] ?? null,
      active:
        (filter.propertyType != null && filter.propertyType === activeType) ||
        (filter.propertySubTypes != null && filter.propertySubTypes === activeSubs),
    })
  }
  return cards
}
