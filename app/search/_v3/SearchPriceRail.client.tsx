'use client'

/**
 * Official beui-range-slider as one dual-thumb tick-stop track.
 * Two stacked sliders read as a dotted single-thumb plus a navy capsule (Mini 51).
 */
import { RangeSlider } from '@/components/motion/range-slider'
import { cn } from '@/lib/utils'
import {
  V3_PRICE_STOPS,
  formatPriceRange,
  formatPriceStop,
  snapToStops,
} from '@/components/site/v3/V3Range.logic'

export type SearchPriceRailProps = {
  low: number
  high: number
  onChange: (low: number, high: number) => void
  onCommit: (low: number, high: number) => void
  className?: string
}

function stopIndex(value: number): number {
  const snapped = snapToStops(value, V3_PRICE_STOPS)
  const exact = V3_PRICE_STOPS.indexOf(snapped as (typeof V3_PRICE_STOPS)[number])
  if (exact >= 0) return exact
  let best = 0
  for (let i = 1; i < V3_PRICE_STOPS.length; i++) {
    const stop = V3_PRICE_STOPS[i] ?? 0
    const bestStop = V3_PRICE_STOPS[best] ?? 0
    if (Math.abs(stop - value) < Math.abs(bestStop - value)) best = i
  }
  return best
}

function order(a: number, b: number): { low: number; high: number } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
}

export function SearchPriceRail({
  low,
  high,
  onChange,
  onCommit,
  className,
}: SearchPriceRailProps) {
  const lastIdx = Math.max(0, V3_PRICE_STOPS.length - 1)
  const first = V3_PRICE_STOPS[0] ?? 0
  const last = V3_PRICE_STOPS[lastIdx] ?? first
  const pair = order(
    Math.min(Math.max(low, first), last),
    Math.min(Math.max(high, first), last),
  )
  const loIdx = stopIndex(pair.low)
  const hiIdx = stopIndex(pair.high)

  return (
    <div
      className={cn('srch-price-beui', className)}
      onPointerUp={() => onCommit(pair.low, pair.high)}
    >
      <p className="srch-price-beui__value" aria-live="polite">
        {formatPriceRange(pair.low, pair.high, V3_PRICE_STOPS)}
      </p>
      <RangeSlider
        values={[loIdx, hiIdx]}
        min={0}
        max={lastIdx}
        step={1}
        showTicks
        aria-label="Minimum ask"
        maxAriaLabel="Maximum ask"
        formatValueText={(i) => formatPriceStop(V3_PRICE_STOPS[i] ?? pair.low, V3_PRICE_STOPS)}
        onValuesChange={([nextLo, nextHi]) => {
          const ordered = order(
            V3_PRICE_STOPS[nextLo] ?? pair.low,
            V3_PRICE_STOPS[nextHi] ?? pair.high,
          )
          onChange(ordered.low, ordered.high)
        }}
      />
      <div className="srch-price-beui__ends" aria-hidden>
        <span>Min ask</span>
        <span>Max ask</span>
      </div>
    </div>
  )
}
