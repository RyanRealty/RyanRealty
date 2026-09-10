import type { V3FieldItem } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
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
  /** "was $599K, -8.3%" — kept off the beds/baths line so inventory stays clear. */
  dropLine?: string
  /** "3 bd · 2 ba · 1,600 sqft · Old Bend" without the drop clause. */
  specs?: string
}

function namedPrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const label = formatPrice(n)
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

    // Full ask for "was", not compact — $1.25M → "$1.3M" next to -12.0% fails §0.
    const was = namedPrice(drop.originalListPrice)
    const pct =
      drop.lastDropPct != null && Number.isFinite(drop.lastDropPct)
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : null
    const dropLine =
      was && pct ? `was ${was}, ${pct}` : pct ? pct : was ? `was ${was}` : null

    const subdivision = displaySubdivision(drop.subdivisionName)
    const inventory = [
      drop.beds != null ? `${drop.beds} bd` : null,
      drop.baths != null ? `${drop.baths} ba` : null,
      drop.sqft != null ? `${drop.sqft.toLocaleString('en-US')} sqft` : null,
      subdivision,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')
    // Field list / a11y still get one meta line; the rail card splits drop vs specs.
    const meta = [dropLine, inventory]
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
      ...(dropLine ? { dropLine } : {}),
      ...(inventory ? { specs: inventory } : {}),
      ...(meta ? { meta } : {}),
      ...(photoSrc ? { photoSrc: listingRowPhotoSrc(photoSrc) } : {}),
      lat: drop.lat,
      lng: drop.lng,
    })
  }

  return items
}
