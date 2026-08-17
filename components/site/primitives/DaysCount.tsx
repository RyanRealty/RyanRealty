import { formatPlaceDays } from '@/lib/market/publish-place-days'
import { cn } from '@/lib/utils'

/**
 * DaysCount — published days + " day(s)" via publishPlaceDays.
 * Pulse medians keep the half-day (39.5). Whole days stay whole.
 * Zero (a listing just on market) prints "0 days". Always tabular-nums.
 *
 * Examples:
 *   <DaysCount value={38} />       → 38 days
 *   <DaysCount value={39.5} />     → 39.5 days
 *   <DaysCount value={1} />        → 1 day
 *   <DaysCount value={0} />        → 0 days
 *   <DaysCount value={null} />     → —
 */

type Props = {
  value: number | null | undefined
  /** Override the default em-dash placeholder when value is null. */
  fallback?: string
  className?: string
}

export function DaysCount({ value, fallback = '—', className }: Props) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return <span className={cn('tabular-nums', className)}>{fallback}</span>
  }
  if (value <= 0) {
    return <span className={cn('tabular-nums', className)}>0 days</span>
  }
  return <span className={cn('tabular-nums', className)}>{formatPlaceDays(value)}</span>
}
