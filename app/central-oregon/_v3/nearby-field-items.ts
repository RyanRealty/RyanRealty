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
  /** Live MLS photograph URL, when the source row carries one. */
  photoUrl?: string | null
  /**
   * "City, OR zip" (or "OR zip" when the feed carries no city), built by every
   * lifestyle-detail DAL function's rowToHome. These rows mix cities — a trail
   * or golf course near a city line pulls Bend and Sisters inventory into the
   * same set — so the bare city gets spliced into the row title below.
   */
  cityLine?: string
}

/** Bare city out of "City, OR zip". Empty when the feed carried no city. */
function cityFromCityLine(cityLine: string | undefined): string {
  if (!cityLine) return ''
  const marker = ', OR'
  const idx = cityLine.indexOf(marker)
  if (idx <= 0) return ''
  return cityLine.slice(0, idx).trim()
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
    const street = tile.addressLine.trim()
    if (!street) continue
    const city = cityFromCityLine(tile.cityLine)
    const title = city ? `${street}, ${city}` : street
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

    const photoSrc = tile.photoUrl?.trim() || undefined

    items.push({
      id,
      href,
      priceLabel: formatPrice(tile.price),
      title,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
      ...(photoSrc ? { photoSrc } : {}),
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
    typeKey?: string
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
      ...(item.typeKey ? { typeKey: item.typeKey } : {}),
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
