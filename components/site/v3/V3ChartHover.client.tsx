'use client'
/**
 * The hover layer for a V3Chart line: a crosshair at the nearest x, a dot on
 * every series at that x, and a reading of each series' formatted value.
 * Pointer, touch, and keyboard (arrow keys) all drive it; the reading is
 * announced through a polite live region.
 *
 * It mounts OVER the server-rendered SVG and never touches it: the columns
 * arrive as fractions of the plot box, so the layer draws in CSS percentages
 * and costs one absolutely positioned div per frame. An HTML chart is
 * interactive (TASTE.md: a chart the reader cannot interrogate is a picture
 * of a chart); this is the interrogation.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type V3ChartHoverReading = { name: string; label: string; frac: number; emphasis: boolean }
export type V3ChartHoverColumn = { frac: number; tick: string; readings: V3ChartHoverReading[] }

export type V3ChartHoverProps = {
  /**
   * The stops, in reading order. On an x chart these are columns across the
   * plot; on a y chart they are the ROWS of a range plot, each carrying one
   * reading.
   */
  columns: readonly V3ChartHoverColumn[]
  /** The chart's caption, for the layer's accessible name. */
  label: string
  /**
   * Which way the stops run. 'x' is the default and is every line and bar
   * chart: the reader moves across and the crosshair is vertical.
   *
   * 'y' is the RANGE plot — one row per named place, a value on a shared
   * track. Those rows shipped with `aria-hidden="true"` over the whole plot
   * and a native `title` as their only reading: invisible to a keyboard, dead
   * on touch, and slow on a pointer. 57 rows across nine call sites could not
   * be interrogated at all, which TASTE calls a picture of a chart. Same
   * component, same pointer/touch/keyboard/live-region contract, turned
   * ninety degrees.
   */
  axis?: 'x' | 'y'
}

export function V3ChartHover({ columns, label, axis = 'x' }: V3ChartHoverProps) {
  const vertical = axis === 'y'
  const [active, setActive] = useState<number | null>(null)
  // A touch reading stays after the finger lifts (a phone has no hover to
  // hold it); the next tap outside the plot clears it.
  const [held, setHeld] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  const fracs = useMemo(() => columns.map((c) => c.frac), [columns])

  const nearest = useCallback(
    (client: number) => {
      const el = ref.current
      if (!el || fracs.length === 0) return null
      const r = el.getBoundingClientRect()
      const span = vertical ? r.height : r.width
      if (span <= 0) return null
      const f = (client - (vertical ? r.top : r.left)) / span
      let best = 0
      let bestD = Infinity
      fracs.forEach((x, i) => {
        const d = Math.abs(x - f)
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      return best
    },
    [fracs, vertical],
  )

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const i = nearest(vertical ? e.clientY : e.clientX)
      if (i != null) setActive(i)
      if (e.pointerType === 'touch') setHeld(true)
    },
    [nearest, vertical],
  )

  useEffect(() => {
    if (!held) return
    const el = ref.current
    const onDown = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) {
        setHeld(false)
        setActive(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [held])

  const onKey = (e: React.KeyboardEvent) => {
    if (columns.length === 0) return
    // Arrows follow the axis the reader sees: left/right across a line chart,
    // up/down through a stack of rows.
    const forward = vertical ? 'ArrowDown' : 'ArrowRight'
    const back = vertical ? 'ArrowUp' : 'ArrowLeft'
    if (e.key === forward || e.key === back) {
      e.preventDefault()
      setActive((a) => {
        const base = a ?? (e.key === forward ? -1 : columns.length)
        const next = e.key === forward ? base + 1 : base - 1
        return Math.max(0, Math.min(columns.length - 1, next))
      })
    } else if (e.key === 'Escape') {
      setActive(null)
    } else if (e.key === 'Home') {
      setActive(0)
    } else if (e.key === 'End') {
      setActive(columns.length - 1)
    }
  }

  const col = active != null ? columns[active] ?? null : null
  const pos = col ? `${Math.min(Math.max(col.frac * 100, 0), 100)}%` : undefined
  // Only the horizontal tip needs flipping; a row tip spans the plot's width
  // and has no edge to fall off.
  const flip = col ? !vertical && col.frac > 0.62 : false
  // A row chart's tick IS the series name, so repeating it would read
  // "Madras: Madras 5.9 mo".
  const reading = col
    ? vertical
      ? `${col.tick}: ${col.readings.map((r) => r.label).join(', ')}`
      : `${col.tick}: ${col.readings.map((r) => `${r.name} ${r.label}`).join(', ')}`
    : ''

  return (
    <div
      ref={ref}
      className="v3-chart__hover"
      role="group"
      aria-label={
        vertical
          ? `${label}. Move down the rows or use the arrow keys to read each value.`
          : `${label}. Move across the chart or use the arrow keys to read each value.`
      }
      tabIndex={0}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch' && !held) setActive(null)
      }}
      onBlur={() => {
        if (!held) setActive(null)
      }}
      onKeyDown={onKey}
    >
      {col ? (
        <>
          <div
            className={cn('v3-chart__crosshair', vertical && 'v3-chart__crosshair--row')}
            style={vertical ? { top: pos } : { left: pos }}
            aria-hidden="true"
          />
          {/* A row plot already draws its own dot on the track, so a second
              mark on top of it would be two dots for one value. */}
          {vertical
            ? null
            : col.readings.map((r) => (
                <span
                  key={r.name}
                  className={cn('v3-chart__hoverdot', r.emphasis && 'v3-chart__hoverdot--em')}
                  style={{ left: pos, top: `${r.frac * 100}%` }}
                  aria-hidden="true"
                />
              ))}
          {/*
            NO FLOATING TIP ON A ROW CHART. A range plot already prints every
            value at the end of its own stem, and its sample count in its own
            column, so a tip would re-print a number the reader is looking at
            — and the first build did it directly on top of the row it
            described, hiding two ticks. The crosshair marks which row is
            active and the live region below carries the full reading, note
            and all, for a reader who cannot see the highlight.
          */}
          {vertical ? null : (
          <div
            className={cn('v3-chart__tip', flip && 'v3-chart__tip--flip')}
            style={{ left: pos }}
            aria-hidden="true"
          >
            <p className="v3-chart__tip-tick">{col.tick}</p>
            <dl className="v3-chart__tip-list">
              {col.readings.map((r) => (
                <div
                  key={r.name || r.label}
                  className={cn('v3-chart__tip-row', r.emphasis && 'v3-chart__tip-row--em')}
                >
                  {r.name ? <dt>{r.name}</dt> : null}
                  <dd>{r.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          )}
        </>
      ) : null}
      <p id={`${uid}-live`} className="v3-chart__live" aria-live="polite">
        {reading}
      </p>
    </div>
  )
}
