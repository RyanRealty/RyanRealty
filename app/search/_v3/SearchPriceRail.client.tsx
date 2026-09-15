'use client'

/**
 * First-viewport price control. The catalog RangeSlider is the live object
 * (one track, ticks, fill to the thumb) — not the dual-track house stack.
 */
import { RangeSlider } from '@/components/motion/range-slider'
import { cn } from '@/lib/utils'
import {
  V3_PRICE_STOPS,
  formatPriceRange,
  formatPriceStop,
  snapToStops,
} from '@/components/site/v3'

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

export function SearchPriceRail({
  low,
  high,
  onChange,
  onCommit,
  className,
}: SearchPriceRailProps) {
  const lastIdx = Math.max(0, V3_PRICE_STOPS.length - 1)
  const hiIdx = stopIndex(high)
  const first = V3_PRICE_STOPS[0] ?? 0
  const last = V3_PRICE_STOPS[lastIdx] ?? first
  const lo = Math.min(Math.max(low, first), last)
  const hi = V3_PRICE_STOPS[hiIdx] ?? last

  return (
    <div
      className={cn('srch-price-beui', className)}
      onPointerUp={() => onCommit(lo, hi)}
    >
      <p className="srch-price-beui__value" aria-live="polite">
        {formatPriceRange(lo, hi, V3_PRICE_STOPS)}
      </p>
      <RangeSlider
        value={hiIdx}
        min={0}
        max={lastIdx}
        step={1}
        showTicks
        aria-label="Maximum ask"
        formatValueText={(i) => formatPriceStop(V3_PRICE_STOPS[i] ?? hi, V3_PRICE_STOPS)}
        onValueChange={(i) => {
          const next = V3_PRICE_STOPS[i] ?? hi
          onChange(lo, next)
        }}
      />
    </div>
  )
}
