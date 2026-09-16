import type { V3FieldItem } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { listingTileHref, displaySubdivision } from '@/lib/slug'
import { listingMlsStreetLine, publishCardAddress } from '@/lib/listing/publish-street-line'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { medianPositive } from './drops-constants'

export type PriceDropFieldItem = V3FieldItem & {
  overlay?: string
  /**
   * This home's cut as a share of the deepest cut in the same list, 0..1
   * (SITE-49). The card draws it as a meter under the percent, so a reader
   * comparing two rows sees the difference rather than reading two percents.
   * Absent when the row carries no percent — unknown is not zero (§0).
   */
  cutShare?: number
  /**
   * Where the SHOWN set's median cut sits on that same 0..1 scale, so every
   * meter carries one shared landmark (SITE-108). Same scale, same
   * population as `cutShare`: both are shares of the deepest SHOWN cut.
   */
  medianShare?: number
  /** "13.0% off" — the mark that ranks this card, first-class in the body. */
  cutLabel?: string
  /** The same cut as a number, so the page can state the deepest it renders. */
  cutPct?: number
  /**
   * "$300,000 off the ask" — what the seller actually gave up, which the
   * percent alone does not say and the old card did not carry at all.
   */
  cutAmountLabel?: string
  /** True on the single deepest cut this page renders. */
  isDeepest?: boolean
  /** "Cut 2 days ago" — recency, from the DAL's daysSinceLastChange. */
  cutAgo?: string
  /** "was $599,000" — the prior ask, kept off the beds/baths line. */
  wasLabel?: string
  /** "was $599K, -8.3%" — the compact form V3Field's echo list still reads. */
  dropLine?: string
  /** "3 bd · 2 ba · 1,600 sqft · Old Bend" without the drop clause. */
  specs?: string
}

function namedPrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const label = formatPrice(n)
  return /\$/.test(label) ? label : null
}

/** A cut this page can rank: a positive percent it can place on the scale. */
function rankablePct(drop: PriceDrop): number | null {
  const pct = drop.lastDropPct
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null
  return pct
}

/** "Cut today" / "Cut yesterday" / "Cut 6 days ago". Null when unknown (§0). */
export function cutAgoLabel(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null
  const whole = Math.floor(days)
  if (whole === 0) return 'Cut today'
  if (whole === 1) return 'Cut yesterday'
  return `Cut ${whole} days ago`
}

/**
 * Field rows for this week's price drops. Sorted by lastDropPct descending
 * (Matt 2026-07-12: percent, not dollars, so the list is not only pricey homes
 * with modest markdowns). A row that cannot name a street and a current price
 * is dropped, not defaulted.
 *
 * SITE-108: every row also carries what a portal's price-reduced card does
 * not — this cut drawn against the deepest cut on the page with the page's
 * middle cut notched on the same scale, what the seller gave up in dollars,
 * and how many days ago the ask fell. All three come off fields getPriceDrops
 * already publishes (lastDropPct, lastDropAmount, daysSinceLastChange); none
 * of them is derived from anything this file invents.
 */
export function priceDropFieldItems(drops: readonly PriceDrop[]): PriceDropFieldItem[] {
  const sorted = [...drops].sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
  const items: PriceDropFieldItem[] = []

  /*
   * ONE POPULATION (§0). The deepest and the median are measured on the rows
   * this page KEEPS — after a row with no street or no list price has been
   * dropped — because those are the rows a reader sees and counts. Measuring
   * them on the raw pull instead puts a median beside a count that covers a
   * different set, which is the failure the SITE-108 pass collapsed: the page
   * had three medians a tenth apart, one in each place it was printed.
   * `pageMedianCut` and `pageDeepestCut` below re-read the same figures off
   * the returned items, so the route, the drawing and the Dataset publish the
   * identical number without computing it a second way.
   */
  const kept = sorted.filter(
    (drop) => Boolean(listingMlsStreetLine(drop)) && namedPrice(drop.listPrice) !== null,
  )
  const deepest = kept.reduce((max, d) => {
    const pct = rankablePct(d)
    return pct != null && pct > max ? pct : max
  }, 0)
  const median = medianPositive(kept.map((d) => d.lastDropPct))
  const medianShare =
    deepest > 0 && median != null && median > 0 ? Math.min(1, median / deepest) : null
  // The rail is sorted deepest first, so exactly one row wears the mark even
  // when two rows tie at the published grain (13.04% and 12.98% both print
  // "13.0% off" — two cards both calling themselves the deepest is a §0 read).
  let deepestTaken = false

  for (const drop of kept) {
    const priceLabel = namedPrice(drop.listPrice)
    if (!priceLabel) continue

    // Full ask for "was", not compact — $1.25M → "$1.3M" next to -12.0% fails §0.
    const was = namedPrice(drop.originalListPrice)
    const rank = rankablePct(drop)
    const pct = rank != null ? `-${rank.toFixed(1)}%` : null
    const dropLine =
      was && pct ? `was ${was}, ${pct}` : pct ? pct : was ? `was ${was}` : null
    const cutLabel = rank != null ? `${rank.toFixed(1)}% off` : null
    const cutAmount = namedPrice(drop.lastDropAmount)
    const cutAgo = cutAgoLabel(drop.daysSinceLastChange)
    const isDeepest = rank != null && deepest > 0 && rank >= deepest && !deepestTaken
    if (isDeepest) deepestTaken = true

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
      ...(deepest > 0 && rank != null ? { cutShare: Math.min(1, rank / deepest) } : {}),
      ...(medianShare != null && rank != null ? { medianShare } : {}),
      ...(cutLabel ? { cutLabel } : {}),
      ...(rank != null ? { cutPct: rank } : {}),
      ...(cutAmount ? { cutAmountLabel: `${cutAmount} off the ask` } : {}),
      ...(isDeepest ? { isDeepest: true } : {}),
      ...(cutAgo ? { cutAgo } : {}),
      ...(was ? { wasLabel: `was ${was}` } : {}),
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

/**
 * The page's middle cut and its deepest cut, read off the rows the page
 * renders. The route hands these to the deck sentence, the drawing's hairline,
 * the source line and the Dataset, so every one of them publishes the same
 * figure over the same population (§0). Null when no row carries a percent.
 */
export function pageMedianCut(items: readonly PriceDropFieldItem[]): number | null {
  return medianPositive(items.map((item) => item.cutPct))
}

export function pageDeepestCut(items: readonly PriceDropFieldItem[]): number | null {
  const deepest = items.reduce(
    (max, item) => (item.cutPct != null && item.cutPct > max ? item.cutPct : max),
    0,
  )
  return deepest > 0 ? deepest : null
}
