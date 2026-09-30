import type { V3FieldItem, V3ListingDialItem } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { listingMlsStreetLine, publishCardAddress } from '@/lib/listing/publish-street-line'

export type PriceDropFieldItem = V3FieldItem & {
  overlay?: string
  /**
   * This home's cut as a share of the deepest cut in the same list, 0..1
   * (SITE-49). The card draws it as a short track under the ask, so a reader
   * comparing two rows sees the difference rather than reading two percents.
   * Absent when the row carries no percent — unknown is not zero (§0).
   */
  cutShare?: number
  /** Positive cut percent, when the row carries one. */
  cutPct?: number
  /** "was $599,000, -8.3%" — kept off the beds/baths line so inventory stays clear. */
  dropLine?: string
  /** "3 bd · 2 ba · 1,600 sqft · Old Bend" without the drop clause. */
  specs?: string
  /** MLS city, when the row names one. */
  city?: string
  /** Route slug for /price-drops/{city}, when the city is one we pre-render. */
  citySlug?: string
  /**
   * The same home as the listing dial's row (Matt 2026-09-24: the fold's
   * carousel is V3ListingDial). Built here, from the same drop, in the same
   * pass, so the dial can never hold a home, a figure or an order the Field
   * list does not. The cut is the card's own mark (2026-09-25, was a drop
   * badge on the photograph): the "was" ask and the percent exactly as
   * `dropLine` prints them, and `cutShare` as its track, the same three
   * things the carousel slide showed before the dial.
   */
  listing: V3ListingDialItem
}

/**
 * getPriceDrops keeps single-family rows only (property_type 'A', its
 * SFR_TYPE filter), and PriceDrop does not carry the type, so the dial row
 * names it: an ask on this page is a sale ask, never a lease rate.
 */
const PRICE_DROP_PROPERTY_TYPE = 'A'

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

    // publishPlatDisplayName, not displaySubdivision: the MLS value is often an
    // abbreviation ('Oww', 'DrrhLp', 'Mob Pk') that no buyer recognizes; it is
    // withheld rather than printed (visibility audit 2026-09-22, VOICE-3).
    const subdivision = publishPlatDisplayName(drop.subdivisionName)
    const city = drop.city?.trim() || null
    const citySlug = drop.citySlug?.trim() || null
    const inventory = [
      drop.beds != null ? `${drop.beds} bd` : null,
      drop.baths != null ? `${drop.baths} ba` : null,
      drop.sqft != null ? `${drop.sqft.toLocaleString('en-US')} sqft` : null,
      city,
      subdivision && subdivision !== city ? subdivision : null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')
    // Field list / a11y still get one meta line; the slide splits drop vs specs.
    const meta = [dropLine, inventory]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')

    const photoSrc = drop.photoUrl?.trim()
    const cityLine = [
      [city, drop.postalCode?.trim() || null].filter(Boolean).join(' '),
      subdivision && subdivision !== city ? subdivision : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')
    const cutShare =
      deepest > 0 && drop.lastDropPct != null && Number.isFinite(drop.lastDropPct) && drop.lastDropPct > 0
        ? Math.min(1, drop.lastDropPct / deepest)
        : null
    const listing: V3ListingDialItem = {
      listingKey: drop.listingKey,
      href: listingTileHref(drop),
      photoUrl: photoSrc || null,
      price: drop.listPrice,
      addressLine: street,
      cityLine,
      beds: drop.beds,
      baths: drop.baths,
      sqft: drop.sqft,
      pricePerSqft: null,
      propertyType: PRICE_DROP_PROPERTY_TYPE,
      propertySubType: null,
      subdivisionName: drop.subdivisionName,
      city,
      listNumber: drop.listNumber,
      ...(was || pct ? { cut: { was, pct, share: cutShare } } : {}),
    }

    items.push({
      id: drop.listingKey,
      href: listingTileHref(drop),
      priceLabel,
      title: publishCardAddress(drop),
      ...(pct ? { overlay: pct } : {}),
      ...(drop.lastDropPct != null && Number.isFinite(drop.lastDropPct) && drop.lastDropPct > 0
        ? { cutPct: drop.lastDropPct }
        : {}),
      ...(cutShare != null ? { cutShare } : {}),
      ...(dropLine ? { dropLine } : {}),
      ...(inventory ? { specs: inventory } : {}),
      ...(city ? { city } : {}),
      ...(citySlug ? { citySlug } : {}),
      ...(meta ? { meta } : {}),
      // Keep the feed URL. The slide asks Spark for a field plate at render
      // so a 320×240 ledger thumb never opens the fold.
      ...(photoSrc ? { photoSrc } : {}),
      lat: drop.lat,
      lng: drop.lng,
      listing,
    })
  }

  return items
}
