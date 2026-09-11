'use client'
/**
 * THE READING LAYER, AND THE LEGEND THAT FILTERS IT.
 *
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
import type { ReactNode } from 'react'
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
  /**
   * THE RESTING READING (SITE-41). The stop that is open before anybody touches the
   * chart, and the stop the chart returns to when the pointer leaves.
   *
   * The 2026-09-09 evaluator passes on /housing-market/bend and /central-oregon both
   * reported no sign the chart was interactive: the crosshair, the tooltip and the
   * keyboard walk were all there and all invisible until a pointer happened to enter the
   * plot. Opening the newest stop shows the reader what the chart does by doing it, and
   * it costs no teaching sentence — the interaction demonstrates itself.
   *
   * Omitted, the layer rests closed exactly as it always has.
   */
  initial?: number
  /**
   * THE LEGEND THAT DOES SOMETHING (SITE-41). Pass the series names and this layer
   * also renders the chart's legend, as pressed/unpressed controls: pressing a key
   * drops that series from the drawing AND from the reading.
   *
   * It lives here, and not in a component of its own, for one reason: THE READING HAS
   * TO AGREE WITH THE DRAWING. A hidden line whose value keeps arriving in the tooltip
   * is a chart telling a reader two things at once. One piece of state hides the path,
   * filters the tooltip, filters the live region and filters the keyboard walk, so the
   * three can never disagree.
   *
   * The last visible series cannot be turned off: an empty plot under three unpressed
   * keys is nobody's idea of a state, and every reading would go with it.
   *
   * Requires `frame`. Without both, this component is the hover layer it always was.
   */
  keys?: readonly string[]
  /** The per-key class the server computed, so each key keeps its series' own ink. */
  keyClasses?: readonly string[]
  /**
   * The server-rendered frame, in three pieces, so this component can compose the same
   * frame the static branch composes and own nothing but the pressed state. The
   * geometry is still the server's: nothing here recomputes a plot.
   */
  frame?: V3ChartHoverFrame
}

export type V3ChartHoverFrame = {
  /** The y scale. */
  axis: ReactNode
  /** The SVG. */
  plot: ReactNode
  /** The x ticks. */
  xTicks: ReactNode
}

export function V3ChartHover({
  columns: allColumns,
  label,
  axis = 'x',
  initial,
  keys,
  keyClasses,
  frame,
}: V3ChartHoverProps) {
  const vertical = axis === 'y'
  const live = keys != null && keys.length > 1 && frame != null
  const [off, setOff] = useState<readonly number[]>([])
  const toggleKey = (i: number) =>
    setOff((prev) => {
      if (prev.includes(i)) return prev.filter((n) => n !== i)
      if (prev.length >= (keys?.length ?? 0) - 1) return prev
      return [...prev, i]
    })
  // The reading follows the drawing: a series that is not on the plot is not in the
  // tooltip, and a stop with nothing left to say leaves the walk entirely.
  const hidden = useMemo(
    () => new Set(off.map((i) => keys?.[i]).filter((n): n is string => Boolean(n))),
    [keys, off],
  )
  const columns = useMemo(
    () =>
      hidden.size === 0
        ? allColumns
        : allColumns
            .map((c) => ({ ...c, readings: c.readings.filter((r) => !hidden.has(r.name)) }))
            .filter((c) => c.readings.length > 0),
    [allColumns, hidden],
  )
  const rest = initial != null && initial >= 0 && initial < columns.length ? initial : null
  const [active, setActive] = useState<number | null>(rest)
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
        setActive(rest)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [held, rest])

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
      setActive(rest)
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

  const scrubValue = active ?? rest ?? 0
  const scrubber =
    !vertical && columns.length > 1 ? (
      <label className="v3-chart__scrub">
        <span className="v3-chart__scrub-label">
          {col ? col.tick : columns[scrubValue]?.tick ?? 'Month'}
        </span>
        <input
          type="range"
          className="v3-chart__scrub-input"
          min={0}
          max={columns.length - 1}
          step={1}
          value={scrubValue}
          aria-label={`Scrub ${label}`}
          aria-valuetext={columns[scrubValue]?.tick}
          onChange={(e) => {
            setHeld(true)
            setActive(Number(e.target.value))
          }}
        />
      </label>
    ) : null

  const layer = (
    <div
      ref={ref}
      className="v3-chart__hover"
      role="group"
      aria-label={
        vertical
          ? `${label}. Move down the rows or use the arrow keys to read each value.`
          : `${label}. Move across the chart, scrub the month, or use the arrow keys to read each value.`
      }
      tabIndex={0}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch' && !held) setActive(rest)
      }}
      onBlur={() => {
        if (!held) setActive(rest)
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
            className={cn(
              'v3-chart__tip',
              flip && 'v3-chart__tip--flip',
              rest != null && active === rest && 'v3-chart__tip--resting',
            )}
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

  // Non-live path mounts inside `.v3-chart__plot` (absolute overlay). Keep the
  // scrubber on the live frame path only, under the plot — not clipped inside it.
  if (!live || !keys || !frame) return layer

  return (
    <>
      <ul className="v3-chart__legend v3-chart__legend--live">
        {keys.map((name, i) => (
          <li key={`${i}-${name}`}>
            <button
              type="button"
              className={cn('v3-chart__key', 'v3-chart__key--btn', keyClasses?.[i])}
              aria-pressed={!off.includes(i)}
              onClick={() => toggleKey(i)}
            >
              <span className="v3-chart__swatch" aria-hidden="true" />
              {name}
            </button>
          </li>
        ))}
      </ul>
      {/* The same frame the static branch composes, with one extra attribute: the
          list of series indexes the stylesheet drops from the drawing. Nothing about
          the geometry is recomputed on the client. */}
      <div
        className="v3-chart__frame"
        data-off={off.length > 0 ? off.map((i) => String(i)).join(' ') : undefined}
      >
        {frame.axis}
        <div className="v3-chart__plot">
          {frame.plot}
          {columns.length > 0 ? layer : null}
        </div>
        {frame.xTicks}
        {scrubber}
      </div>
    </>
  )
}
