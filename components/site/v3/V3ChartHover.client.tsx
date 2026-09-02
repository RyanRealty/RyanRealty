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
  /** Columns in x order; each holds the readings of every series at that x. */
  columns: readonly V3ChartHoverColumn[]
  /** The chart's caption, for the layer's accessible name. */
  label: string
}

export function V3ChartHover({ columns, label }: V3ChartHoverProps) {
  const [active, setActive] = useState<number | null>(null)
  // A touch reading stays after the finger lifts (a phone has no hover to
  // hold it); the next tap outside the plot clears it.
  const [held, setHeld] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  const fracs = useMemo(() => columns.map((c) => c.frac), [columns])

  const nearest = useCallback(
    (clientX: number) => {
      const el = ref.current
      if (!el || fracs.length === 0) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0) return null
      const f = (clientX - r.left) / r.width
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
    [fracs],
  )

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const i = nearest(e.clientX)
      if (i != null) setActive(i)
      if (e.pointerType === 'touch') setHeld(true)
    },
    [nearest],
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
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((a) => {
        const base = a ?? (e.key === 'ArrowRight' ? -1 : columns.length)
        const next = e.key === 'ArrowRight' ? base + 1 : base - 1
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
  const tipLeft = col ? `${Math.min(Math.max(col.frac * 100, 0), 100)}%` : undefined
  const flip = col ? col.frac > 0.62 : false
  const reading = col ? `${col.tick}: ${col.readings.map((r) => `${r.name} ${r.label}`).join(', ')}` : ''

  return (
    <div
      ref={ref}
      className="v3-chart__hover"
      role="group"
      aria-label={`${label}. Move across the chart or use the arrow keys to read each value.`}
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
          <div className="v3-chart__crosshair" style={{ left: tipLeft }} aria-hidden="true" />
          {col.readings.map((r) => (
            <span
              key={r.name}
              className={cn('v3-chart__hoverdot', r.emphasis && 'v3-chart__hoverdot--em')}
              style={{ left: tipLeft, top: `${r.frac * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <div className={cn('v3-chart__tip', flip && 'v3-chart__tip--flip')} style={{ left: tipLeft }} aria-hidden="true">
            <p className="v3-chart__tip-tick">{col.tick}</p>
            <dl className="v3-chart__tip-list">
              {col.readings.map((r) => (
                <div key={r.name} className={cn('v3-chart__tip-row', r.emphasis && 'v3-chart__tip-row--em')}>
                  <dt>{r.name}</dt>
                  <dd>{r.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : null}
      <p id={`${uid}-live`} className="v3-chart__live" aria-live="polite">
        {reading}
      </p>
    </div>
  )
}
