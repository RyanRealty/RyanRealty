import { cn } from '@/lib/utils'

/**
 * PercentChange — signed arrow + percent value at one decimal, per the
 * locked brand voice ("↑ 2.1% YoY").
 *
 * Color tokens:
 *   - up:   `text-success` (positive change, "good" by convention)
 *   - down: `text-destructive`
 *   - flat: `text-muted-foreground` (within +/- 0.05 absolute)
 *
 * Some "good change" semantics flip depending on context — e.g. days on
 * market going DOWN is "good." Pass `direction="invert"` to swap up/down
 * colors so the destructive token applies to up-arrows on
 * lower-is-better metrics.
 *
 * Pass an explicit suffix like "YoY" or "MoM" for the trailing label.
 *
 * Examples:
 *   <PercentChange value={2.1} suffix="YoY" />               → ↑ 2.1% YoY  (green)
 *   <PercentChange value={-6} suffix="vs last month" />      → ↓ 6.0% vs last month  (red)
 *   <PercentChange value={-6} suffix="" direction="invert" /> → ↓ 6.0%  (green — invert)
 *   <PercentChange value={0.02} />                            → · 0.0%  (flat, muted)
 *   <PercentChange value={null} />                            → —
 */

type Props = {
  /** Percent value as a number (e.g. 2.1 for "2.1%"). */
  value: number | null | undefined
  suffix?: string
  /**
   * `'normal'` (default): up = good (green), down = bad (red).
   * `'invert'`: up = bad (red), down = good (green). Use for metrics
   * where lower-is-better (DOM, MoS, etc.).
   */
  direction?: 'normal' | 'invert'
  /** Override the default em-dash placeholder when value is null. */
  fallback?: string
  className?: string
}

const FLAT_THRESHOLD = 0.05

export function PercentChange({
  value,
  suffix,
  direction = 'normal',
  fallback = '—',
  className,
}: Props) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return <span className={cn('tabular-nums', className)}>{fallback}</span>
  }

  const abs = Math.abs(value)
  const isFlat = abs < FLAT_THRESHOLD
  const isUp = value > 0 && !isFlat
  const arrow = isFlat ? '·' : isUp ? '↑' : '↓'
  const isGood = direction === 'invert' ? !isUp : isUp
  const colorClass = isFlat
    ? 'text-muted-foreground'
    : isGood
      ? 'text-success'
      : 'text-destructive'

  return (
    <span className={cn('tabular-nums inline-flex items-center gap-1', colorClass, className)}>
      <span aria-hidden>{arrow}</span>
      <span>{abs.toFixed(1)}%</span>
      {suffix ? <span>{suffix}</span> : null}
    </span>
  )
}
