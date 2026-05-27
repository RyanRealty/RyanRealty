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
 *   <Price value={null} />              → —
 */

type Props = {
  value: number | null | undefined
  /** When true, format as $895k / $1.5M instead of full $895,000. */
  compact?: boolean
  /** Override the default em-dash placeholder when value is null. */
  fallback?: string
  className?: string
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

function format(value: number, compact: boolean): string {
  if (compact) {
    if (value >= 1_000_000) {
      const m = value / 1_000_000
      // 1 decimal for under 10M, 0 decimals at/above (e.g. $12M not $12.0M)
      return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `$${Math.round(value / 1000)}k`
    }
    return `$${value}`
  }
  return `$${roundToThousand(value).toLocaleString('en-US')}`
}

export function Price({ value, compact = false, fallback = '—', className }: Props) {
  const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0
  return (
    <span className={cn('tabular-nums', className)}>
      {hasValue ? format(value, compact) : fallback}
    </span>
  )
}
