'use client'

/**
 * Dual-thumb range with tick stops. Adapted from beUI range-slider: ticks,
 * snap on release, navy fill. Bounce is refused (the catalog job says reduce
 * it; house motion is 120–200ms ease-out). No second palette, no glass.
 *
 * The caller owns the numbers and the URL. This paints the track.
 */

import { useCallback, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import {
  V3_PRICE_STOPS,
  clamp,
  formatPriceRange,
  formatPriceStop,
  valueFromVisualPercent,
  visualPercent,
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

type DragWhich = 'low' | 'high'

function order(a: number, b: number): { low: number; high: number } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
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
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<DragWhich | null>(null)
  const first = stops[0] ?? 0
  const last = stops[stops.length - 1] ?? first
  const lo = clamp(low, first, last)
  const hi = clamp(high, first, last)
  const pair = order(lo, hi)
  const fmt = format ?? ((n: number) => formatPriceStop(n, stops))
  const rangeText = formatRange
    ? formatRange(pair.low, pair.high)
    : formatPriceRange(pair.low, pair.high, stops)

  const emit = useCallback(
    (nextLow: number, nextHigh: number, commit: boolean) => {
      const next = order(nextLow, nextHigh)
      onChange?.(next.low, next.high)
      if (commit) onCommit?.(next.low, next.high)
    },
    [onChange, onCommit],
  )

  const valueAt = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return pair.low
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return pair.low
      const pct = ((clientX - rect.left) / rect.width) * 100
      return valueFromVisualPercent(pct, stops)
    },
    [pair.low, stops],
  )

  const whichFor = useCallback(
    (clientX: number): DragWhich => {
      const el = trackRef.current
      if (!el) return 'low'
      const rect = el.getBoundingClientRect()
      const pct = rect.width <= 0 ? 0 : ((clientX - rect.left) / rect.width) * 100
      const loPct = visualPercent(pair.low, stops)
      const hiPct = visualPercent(pair.high, stops)
      return Math.abs(pct - loPct) <= Math.abs(pct - hiPct) ? 'low' : 'high'
    },
    [pair.high, pair.low, stops],
  )

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const which = whichFor(event.clientX)
    setDragging(which)
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = valueAt(event.clientX)
    if (which === 'low') emit(next, pair.high, false)
    else emit(pair.low, next, false)
  }

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const next = valueAt(event.clientX)
    if (dragging === 'low') emit(next, pair.high, false)
    else emit(pair.low, next, false)
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const next = valueAt(event.clientX)
    const committed = dragging === 'low' ? order(next, pair.high) : order(pair.low, next)
    setDragging(null)
    emit(committed.low, committed.high, true)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // capture already gone
    }
  }

  const nudge = (which: DragWhich, dir: -1 | 1) => {
    const i = stops.findIndex((s) => s === (which === 'low' ? pair.low : pair.high))
    const from = i < 0
      ? stops.findIndex((s) => s >= (which === 'low' ? pair.low : pair.high))
      : i
    const nextI = clamp((from < 0 ? 0 : from) + dir, 0, stops.length - 1)
    const next = stops[nextI]!
    if (which === 'low') emit(next, pair.high, true)
    else emit(pair.low, next, true)
  }

  const loPct = visualPercent(pair.low, stops)
  const hiPct = visualPercent(pair.high, stops)
  const fillLeft = Math.min(loPct, hiPct)
  // An unconstrained range is the whole domain. Filling it 100% navy reads as
  // a decorative rule, not two thumbs on a track (SITE-72 first viewport).
  const unconstrained = pair.low <= first && pair.high >= last
  const fillWidth = unconstrained ? 0 : Math.abs(hiPct - loPct)

  return (
    <div className={cn(V3_ROOT_CLASS, 'v3-range', className)}>
      <div className="v3-range__head">
        <p className="v3-range__label" id={`${uid}-label`}>{label}</p>
        <p className="v3-range__value" aria-live="polite">{rangeText}</p>
      </div>
      <div
        ref={trackRef}
        className="v3-range__track"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="v3-range__rail" aria-hidden />
        <span
          className="v3-range__fill"
          aria-hidden
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, right: 'auto' }}
        />
        <span className="v3-range__ticks" aria-hidden>
          {stops.map((stop, i) => (
            <span
              key={stop}
              className="v3-range__tick"
              style={{ left: `${(i / Math.max(1, stops.length - 1)) * 100}%` }}
            />
          ))}
        </span>
        <button
          type="button"
          className="v3-range__thumb"
          style={{ left: `${loPct}%`, zIndex: dragging === 'low' ? 2 : 1 }}
          data-dragging={dragging === 'low' ? 'true' : undefined}
          role="slider"
          aria-labelledby={`${uid}-label`}
          aria-label={`Minimum ${label}`}
          aria-valuemin={first}
          aria-valuemax={pair.high}
          aria-valuenow={pair.low}
          aria-valuetext={fmt(pair.low)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault()
              nudge('low', 1)
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault()
              nudge('low', -1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              emit(first, pair.high, true)
            } else if (event.key === 'End') {
              event.preventDefault()
              emit(pair.high, pair.high, true)
            }
          }}
        />
        <button
          type="button"
          className="v3-range__thumb"
          style={{ left: `${hiPct}%`, zIndex: dragging === 'high' ? 2 : 1 }}
          data-dragging={dragging === 'high' ? 'true' : undefined}
          role="slider"
          aria-labelledby={`${uid}-label`}
          aria-label={`Maximum ${label}`}
          aria-valuemin={pair.low}
          aria-valuemax={last}
          aria-valuenow={pair.high}
          aria-valuetext={fmt(pair.high)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault()
              nudge('high', 1)
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault()
              nudge('high', -1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              emit(pair.low, pair.low, true)
            } else if (event.key === 'End') {
              event.preventDefault()
              emit(pair.low, last, true)
            }
          }}
        />
      </div>
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
