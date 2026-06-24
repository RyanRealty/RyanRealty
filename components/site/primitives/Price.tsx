import { cn } from '@/lib/utils'

/**
 * Price — render a currency value rounded to the nearest thousand per the
 * locked brand voice (`$895,000` not `$894,750`).
 *
 * Renders `—` for null / undefined / NaN to match the data-placeholder
 * convention used elsewhere on numeric surfaces.
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

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

function format(value: number, compact: boolean, exact: boolean): string {
  if (exact) {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  if (compact) {
    if (value >= 1_000_000) {
      const m = value / 1_000_000
      // 1 decimal for under 10M, 0 decimals at/above (e.g. $12M not $12.0M)
      return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `$${Math.round(value / 1000)}k`
    }
    return `$${Math.round(value)}`
  }
  return `$${roundToThousand(value).toLocaleString('en-US')}`
}

export function Price({ value, compact = false, exact = false, fallback = '—', className }: Props) {
  const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0
  return (
    <span className={cn('tabular-nums', className)}>
      {hasValue ? format(value, compact, exact) : fallback}
    </span>
  )
}
