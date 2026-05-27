import { cn } from '@/lib/utils'

/**
 * TabularNumber — render any non-currency numeric value with locked
 * en-US grouping + font-variant-numeric: tabular-nums so column
 * alignment stays clean across stats cards and tables.
 *
 * Currency is the Price primitive's job (rounds to thousand, prefixes $).
 * Percent is the PercentChange primitive's job (signed arrow, 1 decimal).
 * Day counts are the DaysCount primitive's job (integer + ' days').
 *
 * Use this primitive for raw counts: 1,247 listings, 612 active homes,
 * 38 days on market displays where the "days" suffix is rendered
 * separately, etc.
 *
 * Examples:
 *   <TabularNumber value={1247} />            → 1,247
 *   <TabularNumber value={null} />            → —
 *   <TabularNumber value={1247.5} fractionDigits={1} /> → 1,247.5
 */

type Props = {
  value: number | null | undefined
  /** Decimal places. Defaults to 0 (integer formatting). */
  fractionDigits?: number
  /** Override the default em-dash placeholder when value is null. */
  fallback?: string
  className?: string
}

export function TabularNumber({
  value,
  fractionDigits = 0,
  fallback = '—',
  className,
}: Props) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const formatted = hasValue
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    : fallback
  return <span className={cn('tabular-nums', className)}>{formatted}</span>
}
