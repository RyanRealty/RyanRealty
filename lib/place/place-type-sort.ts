/**
 * The place-type list's sort. Its own module, and deliberately leaf: the
 * control that uses it is a client island, and lib/place/place-type-page.ts
 * reaches getMetric → the Supabase service client → `server-only`, so a client
 * import of the sort from there fails the build with an "Invalid import"
 * (measured 2026-09-09). Nothing here imports anything but a type.
 */
import type { V3ListingRowData } from '@/components/site/v3'

export const PLACE_TYPE_SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price low' },
  { key: 'price-desc', label: 'Price high' },
  { key: 'beds', label: 'Most beds' },
] as const

export type PlaceTypeSort = (typeof PLACE_TYPE_SORTS)[number]['key']

export function isPlaceTypeSort(value: string | null | undefined): value is PlaceTypeSort {
  return PLACE_TYPE_SORTS.some((s) => s.key === value)
}

/**
 * Reorder the photographed rows. `newest` is the order the read returned, so
 * it is the identity — never a re-sort on a field the row does not carry.
 * Ties break on the listing key so the order is stable across renders, and a
 * missing figure sorts last rather than as a zero.
 */
export function sortPlaceTypeRows(
  rows: readonly V3ListingRowData[],
  sort: PlaceTypeSort,
): readonly V3ListingRowData[] {
  if (sort === 'newest') return rows
  const out = [...rows]
  const num = (v: number | null | undefined): number => (v == null || !Number.isFinite(v) ? -1 : v)
  out.sort((a, b) => {
    if (sort === 'price-asc') return num(a.price) - num(b.price) || a.listingKey.localeCompare(b.listingKey)
    if (sort === 'price-desc') return num(b.price) - num(a.price) || a.listingKey.localeCompare(b.listingKey)
    return num(b.beds) - num(a.beds) || num(b.price) - num(a.price) || a.listingKey.localeCompare(b.listingKey)
  })
  return out
}
