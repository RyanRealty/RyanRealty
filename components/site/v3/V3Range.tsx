'use client'

/**
 * Dual range with tick stops. Wraps the installed beUI range-slider
 * (`components/motion/range-slider.tsx`) twice (low / high). Navy fill,
 * house stops, bounce reduced to the catalog spring (respects reduced motion).
 *
 * The caller owns the numbers and the URL. This paints the track.
 */

import { useCallback, useId } from 'react'
import { RangeSlider } from '@/components/motion/range-slider'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import {
  V3_PRICE_STOPS,
  clamp,
  formatPriceRange,
  formatPriceStop,
  snapToStops,
  type V3RangeStops,
} from './V3Range.logic'
import './tokens.css'
import './V3Range.css'

export type V3RangeProps = {
  label: string
  low: number
  high: number
  stops?: V3RangeStops
  onChange?: (low: number, high: number) => void
  /** Fires on pointer-up / keyboard, once per gesture. */
  onCommit?: (low: number, high: number) => void
  format?: (n: number) => string
  formatRange?: (low: number, high: number) => string
  className?: string
}

function order(a: number, b: number): { low: number; high: number } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
}

function stopIndex(value: number, stops: V3RangeStops): number {
  const snapped = snapToStops(value, stops)
  const exact = stops.indexOf(snapped)
  if (exact >= 0) return exact
  let best = 0
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs((stops[i] ?? 0) - value) < Math.abs((stops[best] ?? 0) - value)) best = i
  }
  return best
}

export function V3Range({
  label,
  low,
  high,
  stops = V3_PRICE_STOPS,
  onChange,
  onCommit,
  format,
  formatRange,
  className,
}: V3RangeProps) {
  const uid = useId()
  const first = stops[0] ?? 0
  const last = stops[stops.length - 1] ?? first
  const lo = clamp(low, first, last)
  const hi = clamp(high, first, last)
  const pair = order(lo, hi)
  const fmt = format ?? ((n: number) => formatPriceStop(n, stops))
  const rangeText = formatRange
    ? formatRange(pair.low, pair.high)
    : formatPriceRange(pair.low, pair.high, stops)
  const lastIdx = Math.max(0, stops.length - 1)
  const loIdx = stopIndex(pair.low, stops)
  const hiIdx = stopIndex(pair.high, stops)

  const emit = useCallback(
    (nextLow: number, nextHigh: number, commit: boolean) => {
      const next = order(nextLow, nextHigh)
      onChange?.(next.low, next.high)
      if (commit) onCommit?.(next.low, next.high)
    },
    [onChange, onCommit],
  )

  return (
    <div
      className={cn(V3_ROOT_CLASS, 'v3-range', className)}
      onPointerUp={() => onCommit?.(pair.low, pair.high)}
    >
      <div className="v3-range__head">
        <p className="v3-range__label" id={`${uid}-label`}>
          {label}
        </p>
        <p className="v3-range__value" aria-live="polite">
          {rangeText}
        </p>
      </div>
      <RangeSlider
        value={loIdx}
        min={0}
        max={lastIdx}
        step={1}
        showTicks
        aria-label={`Minimum ${label}`}
        formatValueText={(i) => fmt(stops[i] ?? pair.low)}
        onValueChange={(i) => {
          const next = stops[i] ?? pair.low
          emit(next, pair.high, false)
        }}
        className="v3-range__beui"
      />
      <RangeSlider
        value={hiIdx}
        min={0}
        max={lastIdx}
        step={1}
        showTicks
        aria-label={`Maximum ${label}`}
        formatValueText={(i) => fmt(stops[i] ?? pair.high)}
        onValueChange={(i) => {
          const next = stops[i] ?? pair.high
          emit(pair.low, next, false)
        }}
        className="v3-range__beui"
      />
      <div className="v3-range__ends" aria-hidden>
        <span>{fmt(first)}</span>
        <span>{fmt(last)}</span>
      </div>
    </div>
  )
}

export {
  V3_PRICE_STOPS,
  formatPriceRange,
  formatPriceStop,
  rangeToUrl,
  urlToRange,
} from './V3Range.logic'
