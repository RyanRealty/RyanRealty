import type { V3FieldItem } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { listingTileHref, displaySubdivision } from '@/lib/slug'
import { listingMlsStreetLine, publishCardAddress } from '@/lib/listing/publish-street-line'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'

export type PriceDropFieldItem = V3FieldItem & {
  overlay?: string
  /**
   * This home's cut as a share of the deepest cut in the same list, 0..1
   * (SITE-49). The card draws it as a short track under the ask, so a reader
   * comparing two rows sees the difference rather than reading two percents.
   * Absent when the row carries no percent — unknown is not zero (§0).
   */
  cutShare?: number
}

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
export function priceDropFieldItems(drops: readonly PriceDrop[]): PriceDropFieldItem[] {
  const sorted = [...drops].sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
  const items: PriceDropFieldItem[] = []
  // The deepest cut in THIS list is the track's ceiling, so the marks compare
  // the rows a reader can actually see rather than an invented scale.
  const deepest = sorted.reduce(
    (max, d) => (d.lastDropPct != null && Number.isFinite(d.lastDropPct) && d.lastDropPct > max ? d.lastDropPct : max),
    0,
  )

  for (const drop of sorted) {
    const street = listingMlsStreetLine(drop)
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

    const photoSrc = drop.photoUrl?.trim()

    items.push({
      id: drop.listingKey,
      href: listingTileHref(drop),
      priceLabel,
      title: publishCardAddress(drop),
      ...(pct ? { overlay: pct } : {}),
      ...(deepest > 0 && drop.lastDropPct != null && Number.isFinite(drop.lastDropPct) && drop.lastDropPct > 0
        ? { cutShare: Math.min(1, drop.lastDropPct / deepest) }
        : {}),
      ...(specs ? { meta: specs } : {}),
      ...(photoSrc ? { photoSrc: listingRowPhotoSrc(photoSrc) } : {}),
      lat: drop.lat,
      lng: drop.lng,
    })
  }

  return items
}
