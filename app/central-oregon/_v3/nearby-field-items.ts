/**
 * Nearby-home tiles -> V3FieldItem for lifestyle detail Fields (parks, schools,
 * events, venues, trails, golf).
 *
 * The barrel formats nothing, so price and the supporting line are finished here
 * through lib/format. A tile with no list price would render formatPrice(null),
 * which is a lone em dash where a figure should be. Dropping is the honest
 * answer. Coordinates pass through as-is. Absent is not zero: a listing with no
 * lat/lng is listed and not plotted.
 */

import type { V3FieldItem, V3QuietItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'

export type NearbyHomeTile = {
  listingKey: string
  href: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressLine: string
  lat: number | null
  lng: number | null
}

export const NEARBY_FIELD_ROWS = 12

export function nearbyFieldItems(
  tiles: readonly NearbyHomeTile[],
  limit: number = NEARBY_FIELD_ROWS,
): V3FieldItem[] {
  const items: V3FieldItem[] = []

  for (const tile of tiles) {
    if (items.length >= limit) break
    if (tile.price == null || !Number.isFinite(tile.price) || tile.price <= 0) continue
    const title = tile.addressLine.trim()
    if (!title) continue
    const href = tile.href.trim()
    const id = tile.listingKey.trim()
    if (!href || !id) continue

    const meta = [
      tile.beds != null ? `${tile.beds} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')

    items.push({
      id,
      href,
      priceLabel: formatPrice(tile.price),
      title,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
    })
  }

  return items
}

export function fieldMapPins(items: readonly V3FieldItem[]) {
  const pins: Array<{
    id: string
    href: string
    priceLabel: string
    title: string
    lat: number
    lng: number
  }> = []
  for (const item of items) {
    if (typeof item.lat !== 'number' || typeof item.lng !== 'number') continue
    pins.push({
      id: item.id,
      href: item.href,
      priceLabel: item.priceLabel,
      title: item.title,
      lat: item.lat,
      lng: item.lng,
    })
  }
  return pins
}

/** List-price figure for Instrument / FAQ. Never calls formatPrice on null. */
export function medianListLabel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return formatPrice(n)
}

export function faqQuietItems(
  faq: ReadonlyArray<{ question: string; answer: string }>,
): V3QuietItem[] {
  const items: V3QuietItem[] = []
  for (const row of faq) {
    const term = row.question.trim()
    const body = row.answer.trim()
    if (!term || !body) continue
    items.push({ kind: 'prose', term, body })
  }
  return items
}
