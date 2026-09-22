/**
 * Property-type sentence for one recorded plat, counted from the same
 * publicly active rows the place inventory lists. A plat with no measured
 * rows gets null — not a zero.
 */
import { formatCount } from '@/lib/format/count'
import {
  PLACE_STOCK_SECTION_ORDER,
  placeStockSectionKey,
  type PlaceStockSectionKey,
} from '@/lib/place/place-inventory-stock'

export type ChildStockRow = {
  listing_key: string
  geo_slug: string
  property_type: string | null
  property_sub_type: string | null
}

function summaryNoun(section: PlaceStockSectionKey, count: number): string {
  if (section === 'attached') return count === 1 ? 'townhome or condo' : 'townhomes and condos'
  if (section === 'sfr') return 'single-family'
  if (section === 'multifamily') return 'multifamily'
  if (section === 'land') return count === 1 ? 'lot' : 'land'
  return 'other'
}

export function slugFromPlaceHref(href: string): string {
  return href.split('/').filter(Boolean).at(-1)?.trim().toLowerCase() ?? ''
}

export function summarizeChildStock(rows: readonly ChildStockRow[]): string | null {
  const seen = new Set<string>()
  const counts: Record<PlaceStockSectionKey, number> = {
    sfr: 0,
    multifamily: 0,
    attached: 0,
    land: 0,
    other: 0,
  }
  for (const row of rows) {
    const key = row.listing_key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const section = placeStockSectionKey(row.property_type, row.property_sub_type) ?? 'other'
    counts[section] += 1
  }
  const parts = [...PLACE_STOCK_SECTION_ORDER, 'other' as const].flatMap((section) => {
    const n = counts[section]
    if (n === 0) return []
    return [`${formatCount(n)} ${summaryNoun(section, n)}`]
  })
  return parts.length > 0 ? parts.join(' · ') : null
}

export function childStockDetails<T extends { href: string }>(
  children: readonly T[],
  rows: readonly ChildStockRow[],
): Array<T & { detail?: string }> {
  const bySlug = new Map<string, ChildStockRow[]>()
  for (const row of rows) {
    const slug = row.geo_slug.trim().toLowerCase()
    if (!slug) continue
    const bucket = bySlug.get(slug) ?? []
    bucket.push(row)
    bySlug.set(slug, bucket)
  }
  return children.map((child) => {
    const detail = summarizeChildStock(bySlug.get(slugFromPlaceHref(child.href)) ?? [])
    return detail ? { ...child, detail } : { ...child }
  })
}
