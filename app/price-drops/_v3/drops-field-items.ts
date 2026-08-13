import type { V3FieldItem } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { listingDetailPath, displaySubdivision } from '@/lib/slug'

function namedPrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const label = formatPrice(n)
  return /\$/.test(label) ? label : null
}

function namedCompact(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const label = formatPriceCompact(n)
  return /\$/.test(label) ? label : null
}

/**
 * Field rows for this week's price drops. Sorted by lastDropPct descending
 * (Matt 2026-07-12: percent, not dollars, so the list is not only pricey homes
 * with modest markdowns). A row that cannot name a street and a current price
 * is dropped, not defaulted.
 */
export function priceDropFieldItems(drops: readonly PriceDrop[]): V3FieldItem[] {
  const sorted = [...drops].sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
  const items: V3FieldItem[] = []

  for (const drop of sorted) {
    const street = [drop.streetNumber, drop.streetName, drop.streetSuffix]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (!street) continue

    const priceLabel = namedPrice(drop.listPrice)
    if (!priceLabel) continue

    const was = namedCompact(drop.originalListPrice)
    const pct =
      drop.lastDropPct != null && Number.isFinite(drop.lastDropPct)
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : null
    const dropLine =
      was && pct ? `was ${was}, ${pct}` : pct ? pct : was ? `was ${was}` : null

    const subdivision = displaySubdivision(drop.subdivisionName)
    const specs = [
      dropLine,
      drop.beds != null ? `${drop.beds} bd` : null,
      drop.baths != null ? `${drop.baths} ba` : null,
      drop.sqft != null ? `${drop.sqft.toLocaleString('en-US')} sqft` : null,
      subdivision,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')

    items.push({
      id: drop.listingKey,
      href: listingDetailPath(
        drop.listingKey,
        {
          streetNumber: drop.streetNumber,
          streetName: drop.streetName,
          city: drop.city,
          postalCode: drop.postalCode,
        },
        { city: drop.city, subdivision: drop.subdivisionName },
        { mlsNumber: drop.listNumber },
      ),
      priceLabel,
      title: street,
      ...(specs ? { meta: specs } : {}),
      lat: drop.lat,
      lng: drop.lng,
    })
  }

  return items
}
