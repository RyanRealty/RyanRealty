import type { PriceDropFieldItem } from './drops-field-items'
import { DROPS_CITY_SLUGS, cityLabel } from './drops-constants'

export type PriceDropBandKey = 'all' | 'under-5' | '5-10' | '10-plus'

export type PriceDropBand = {
  key: PriceDropBandKey
  /** Visible label. No inventory lecture — the set size is not the name. */
  label: string
  items: PriceDropFieldItem[]
}

export type PriceDropCityDoor = {
  slug: string
  label: string
  href: string
}

const BANDS: ReadonlyArray<{
  key: PriceDropBandKey
  label: string
  match: (pct: number | null | undefined) => boolean
}> = [
  { key: 'all', label: 'All cuts', match: () => true },
  {
    key: 'under-5',
    label: 'Under 5%',
    match: (pct) => pct != null && Number.isFinite(pct) && pct > 0 && pct < 5,
  },
  {
    key: '5-10',
    label: '5 to 10%',
    match: (pct) => pct != null && Number.isFinite(pct) && pct >= 5 && pct < 10,
  },
  {
    key: '10-plus',
    label: '10% and up',
    match: (pct) => pct != null && Number.isFinite(pct) && pct >= 10,
  },
]

/**
 * Cut-size bands for the opening switch. `All cuts` always leads. Empty
 * bands are omitted so a week with no 10% markdowns does not offer a door
 * into nothing.
 */
export function priceDropBands(items: readonly PriceDropFieldItem[]): PriceDropBand[] {
  return BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    items: band.key === 'all' ? [...items] : items.filter((item) => band.match(item.cutPct)),
  })).filter((band) => band.key === 'all' || band.items.length > 0)
}

/**
 * City doors that have at least one photographed cut on this pull, and that
 * this family actually pre-renders. Sorted by the same drop-percent order
 * the Field already uses (first seen = deepest remaining).
 */
export function priceDropCityDoors(items: readonly PriceDropFieldItem[]): PriceDropCityDoor[] {
  const seen = new Set<string>()
  const doors: PriceDropCityDoor[] = []
  for (const item of items) {
    const slug = item.citySlug?.trim()
    if (!slug || seen.has(slug) || !DROPS_CITY_SLUGS.includes(slug)) continue
    seen.add(slug)
    doors.push({
      slug,
      label: item.city?.trim() || cityLabel(slug),
      href: `/price-drops/${slug}`,
    })
  }
  return doors
}
