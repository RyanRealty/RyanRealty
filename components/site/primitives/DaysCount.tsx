import { cn } from '@/lib/utils'

/**
 * DaysCount — integer + " days" or " day" suffix per brand voice rule
 * "Days = integer + 'days'". Always tabular-nums.
 *
 * Examples:
 *   <DaysCount value={38} />       → 38 days
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
  const rounded = Math.max(0, Math.round(value))
  const unit = rounded === 1 ? 'day' : 'days'
  return (
    <span className={cn('tabular-nums', className)}>
      {rounded.toLocaleString('en-US')} {unit}
    </span>
  )
}
