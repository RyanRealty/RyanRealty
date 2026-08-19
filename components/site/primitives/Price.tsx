import { publishMoneyText } from '@/lib/listing/publish-listing-figure'
import { cn } from '@/lib/utils'

/**
 * Price — render a currency value rounded to the nearest thousand per the
 * locked brand voice (`$895,000` not `$894,750`).
 *
 * Renders `—` for null / undefined / NaN to match the data-placeholder
 * convention used elsewhere on numeric surfaces.
 *
 * ALSO renders `—` when the requested register would print `$0` for an amount
 * that is not zero. The nearest-thousand rule turned every value under $500
 * into "$0", and that shipped: 735 Purcell (MLS 220174840) published a listing
 * history of "Listed $0 / Price change $0 / Back on market $0" off lease rates
 * of $2.50–$2.75, and six Active listings published "$0 per square foot" beside
 * their ask. Zero dollars is not a smaller number — it is a different claim.
 * The rule lives in lib/listing/publish-listing-figure.ts (publishMoneyText) so
 * one predicate governs the primitive and the gate.
 *
 * Always wraps the digits in font-variant-numeric: tabular-nums so column
 * alignment stays clean across stats cards + tables.
 *
 * Examples:
 *   <Price value={895000} />            → $895,000
 *   <Price value={895000} compact />    → $895k
 *   <Price value={771} exact />         → $771      (no thousand-rounding)
 *   <Price value={null} />              → —
 *
 * `exact` is for figures the nearest-thousand rule would destroy — price per
 * sqft ($771, not $1,000), monthly payment line items ($3,059/mo, not
 * $3,000/mo). It renders whole dollars with comma grouping, no rounding to the
 * thousand. The headline brand convention (nearest $1,000) still governs the
 * default mode used for list/sale prices.
 */

type Props = {
  value: number | null | undefined
  /** When true, format as $895k / $1.5M instead of full $895,000. */
  compact?: boolean
  /** When true, render exact whole dollars ($771) with no thousand-rounding. */
  exact?: boolean
  /** Override the default em-dash placeholder when value is null. */
  fallback?: string
  className?: string
}

export function Price({ value, compact = false, exact = false, fallback = '—', className }: Props) {
  const published = publishMoneyText(value, exact ? 'exact' : compact ? 'compact' : 'thousand')
  return <span className={cn('tabular-nums', className)}>{published ?? fallback}</span>
}
