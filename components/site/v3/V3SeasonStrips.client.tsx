'use client'

/**
 * SEASON STRIPS. A monthly run folded into one strip per calendar year, the
 * months in columns, so the season repeats down the figure and a year's change
 * reads straight across it. Each month is a column standing on its row's
 * baseline, against the caller's threshold bands, and the part of a column
 * that passes the threshold the call turns on is drawn in full ink: the months
 * that crossed the line are the dark ones before a single figure is read.
 *
 * WHY IT EXISTS (2026-09-25). The monthly market report stacked the median
 * sale price line and a months-of-supply line in the same frame, same axes,
 * same caption and same resting tooltip, and a separate evaluator read the
 * pair as one shape twice. A line answers "where has it gone". This answers
 * the question supply is actually asked: which months crossed into the
 * balanced zone, and is each year crossing sooner or staying longer. It is a
 * barrel primitive, not a page one-off (PUBLIC_UI section 3): any monthly
 * figure read against a threshold folds the same way.
 *
 * INTERROGATION, on the same contract as V3ChartHover. One focusable surface.
 * A pointer or a finger over a row reads the nearest month; the arrow keys step
 * through time (left and right, across a year boundary) or to the same month a
 * year newer or older (up and down, the comparison this form exists for);
 * Home and End reach the ends; Escape, blur and a mouse leaving return to the
 * resting reading, the newest month unless the caller names another. A touch
 * reading stays after the finger lifts, until a tap lands outside. The reading
 * prints on a line above the rows, never in a card over them, and a polite live
 * region says the same words.
 *
 * DATA (CLAUDE.md section 0). `value` is geometry only and never printed. Every
 * word on screen is a string the caller formatted: the label is the printed
 * figure, the note is the caller's own call on it. Nothing here formats,
 * rounds, classifies or parses a date. A value outside [0, max] refuses the
 * drawing (./V3SeasonStrips.logic.ts) rather than standing a column on the top
 * of its row. The hidden list under the figure carries every reading in time
 * order, so a reader who cannot see the columns still has the whole run.
 *
 * Server-rendered like every client component here: the resting reading, the
 * columns and the list are in the served HTML; hydration adds the reading
 * layer and nothing else.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import {
  V3_SEASON_COLUMNS,
  cellAt,
  nearestInRow,
  samePos,
  seasonBandPlacement,
  seasonCapPct,
  seasonDrawable,
  seasonHeightPct,
  seasonStep,
  seasonTimeline,
  type V3SeasonPos,
} from './V3SeasonStrips.logic'
import './tokens.css'
import './V3SeasonStrips.css'

export type { V3SeasonPos } from './V3SeasonStrips.logic'

export type V3SeasonCell = {
  /** Geometry only. Never printed: `label` is the figure on screen. */
  value: number
  /** The reading's name, preformatted: "May 2026". */
  tick: V3Text
  /** The figure, preformatted by the caller's own formatter: "4.8 months". */
  label: V3Text
  /** The caller's call on the figure, preformatted: "a balanced market". */
  note?: V3Text
}

export type V3SeasonRow = {
  /** The row's name, the year: "2026". */
  name: V3Text
  /** Twelve slots in calendar order, January first; null where the run has no reading. */
  cells: readonly (V3SeasonCell | null)[]
}

/** A zone drawn behind every row, in the value's units, named for the key. */
export type V3SeasonBand = {
  from: number
  to: number
  label: V3Text
}

export type V3SeasonStripsProps = {
  /** The figure's accessible name and its visible caption. */
  caption: V3Text
  /** The one sentence the drawing exists to show, under the caption. */
  claim?: V3Text
  /** One per calendar year, NEWEST FIRST. */
  rows: readonly V3SeasonRow[]
  /** The twelve column heads, January first, as the caller writes them. */
  columns: readonly V3Text[]
  /** The domain ceiling in the value's units. The floor is zero: a column starts at zero. */
  max: number
  /** Zones behind every row. Each must ascend inside [0, max]. */
  bands?: readonly V3SeasonBand[]
  /**
   * The value the call turns on. The part of a column above it is drawn in
   * full ink. A value exactly on it has not crossed it.
   */
  threshold?: number
  /** The reading open before anyone touches the figure. Defaults to the newest month. */
  resting?: V3SeasonPos
  /** Said instead of a drawing when the run cannot be drawn honestly. */
  emptyReason?: V3Text
  id?: string
  className?: string
}

/** One reading as a sentence fragment: "May 2026: 4.8 months, a balanced market". */
function readingOf(cell: V3SeasonCell, joiner: string): string {
  return `${cell.tick}${joiner}${cell.label}${cell.note ? `, ${cell.note}` : ''}`
}

export function V3SeasonStrips({
  caption,
  claim,
  rows,
  columns,
  max,
  bands,
  threshold,
  resting,
  emptyReason,
  id,
  className,
}: V3SeasonStripsProps) {
  const uid = useId()
  const base = id ?? `seasons-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const captionId = `${base}-caption`

  const zones = useMemo(() => bands ?? [], [bands])
  const drawable = useMemo(
    () => columns.length === V3_SEASON_COLUMNS && seasonDrawable(rows, max, zones),
    [columns.length, rows, max, zones],
  )
  const timeline = useMemo(() => seasonTimeline(rows), [rows])
  const rest = useMemo<V3SeasonPos | null>(
    () => (resting && cellAt(rows, resting) ? resting : (timeline[timeline.length - 1] ?? null)),
    [resting, rows, timeline],
  )

  const [active, setActive] = useState<V3SeasonPos | null>(rest)
  // A finger has no hover to hold a reading, so a touch keeps it until the
  // next tap outside the figure (the V3ChartHover contract).
  const [held, setHeld] = useState(false)
  const plotRef = useRef<HTMLDivElement>(null)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])

  /** The row under (or nearest) the point, then the filled month nearest it in that row. */
  const locate = useCallback(
    (x: number, y: number): V3SeasonPos | null => {
      let row = -1
      let bestD = Infinity
      for (let r = 0; r < trackRefs.current.length; r += 1) {
        const el = trackRefs.current[r]
        if (!el) continue
        const box = el.getBoundingClientRect()
        const d = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0
        if (d < bestD) {
          bestD = d
          row = r
        }
      }
      const track = row >= 0 ? trackRefs.current[row] : null
      if (!track) return null
      const box = track.getBoundingClientRect()
      if (box.width <= 0) return null
      const column = Math.max(
        0,
        Math.min(V3_SEASON_COLUMNS - 1, Math.floor(((x - box.left) / box.width) * V3_SEASON_COLUMNS)),
      )
      return nearestInRow(rows, row, column)
    },
    [rows],
  )

  const onPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pos = locate(event.clientX, event.clientY)
      if (pos) setActive(pos)
      if (event.pointerType === 'touch') setHeld(true)
    },
    [locate],
  )

  useEffect(() => {
    if (!held) return
    const onDown = (event: PointerEvent) => {
      const el = plotRef.current
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setHeld(false)
        setActive(rest)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [held, rest])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = seasonStep(rows, timeline, active, event.key, rest)
    if (next === undefined) return
    event.preventDefault()
    setActive(next)
  }

  if (caption.trim().length === 0) {
    throw new Error(
      'V3SeasonStrips: caption is empty. The caption is the accessible name of the figure.',
    )
  }

  if (!drawable) {
    if (!emptyReason || emptyReason.trim().length === 0) return null
    return (
      <figure id={id} className={cn(V3_ROOT_CLASS, 'v3-seasons', className)} aria-labelledby={captionId}>
        <figcaption id={captionId} className="v3-seasons__caption">
          {caption}
        </figcaption>
        <p className="v3-seasons__empty">{emptyReason}</p>
      </figure>
    )
  }

  const current = cellAt(rows, active)
  const placed = zones.flatMap((band) => {
    const at = seasonBandPlacement(band, max)
    return at ? [{ band, at }] : []
  })

  return (
    <figure id={id} className={cn(V3_ROOT_CLASS, 'v3-seasons', className)} aria-labelledby={captionId}>
      <figcaption id={captionId} className="v3-seasons__caption">
        {caption}
      </figcaption>
      {claim ? <p className="v3-seasons__claim">{claim}</p> : null}

      {/* The reading. Visible words for a sighted reader; the live region in
          the plot says the same thing to a screen reader, so this line is
          hidden from the tree rather than read twice. */}
      <p className="v3-seasons__read" aria-hidden="true">
        {current ? (
          <>
            <span className="v3-seasons__read-tick">{current.tick}</span>
            <span className="v3-seasons__read-value">{current.label}</span>
            {current.note ? <span className="v3-seasons__read-note">{current.note}</span> : null}
          </>
        ) : null}
      </p>

      <div
        ref={plotRef}
        className="v3-seasons__plot"
        role="group"
        tabIndex={0}
        aria-label={`${caption}. Move across a year, or use the arrow keys to read each month; up and down step a year.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch' && !held) setActive(rest)
        }}
        onBlur={() => {
          if (!held) setActive(rest)
        }}
        onKeyDown={onKeyDown}
      >
        <div className="v3-seasons__rows" aria-hidden="true">
          {rows.map((row, r) => (
            <div
              key={`${r}-${row.name}`}
              className={cn('v3-seasons__row', active?.row === r && 'is-active')}
            >
              <span className="v3-seasons__name">{row.name}</span>
              <div
                className="v3-seasons__track"
                ref={(el) => {
                  trackRefs.current[r] = el
                }}
              >
                {placed.map(({ band, at }, i) => (
                  <span
                    key={`band-${i}-${band.label}`}
                    className={cn('v3-seasons__band', at.closesAtTop && 'v3-seasons__band--top')}
                    style={{ bottom: `${at.bottomPct.toFixed(3)}%`, height: `${at.heightPct.toFixed(3)}%` }}
                  />
                ))}
                {row.cells.map((cell, c) => {
                  if (!cell) return <span key={`${r}-${c}`} className="v3-seasons__cell v3-seasons__cell--none" />
                  const cap = seasonCapPct(cell.value, threshold)
                  return (
                    <span
                      key={`${r}-${c}`}
                      className={cn('v3-seasons__cell', samePos(active, { row: r, column: c }) && 'is-active')}
                    >
                      <span
                        className="v3-seasons__bar"
                        style={{ height: `${seasonHeightPct(cell.value, max).toFixed(3)}%` }}
                      >
                        {cap > 0 ? (
                          <span className="v3-seasons__cap" style={{ height: `${cap.toFixed(3)}%` }} />
                        ) : null}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="v3-seasons__cols">
            <span className="v3-seasons__name" />
            <div className="v3-seasons__colgrid">
              {columns.map((label, c) => (
                <span key={`col-${c}`} className={cn('v3-seasons__col', active?.column === c && 'is-active')}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="v3-seasons__live" aria-live="polite">
          {current ? readingOf(current, ': ') : ''}
        </p>
      </div>

      {placed.length > 0 ? (
        <ul className="v3-seasons__key" aria-hidden="true">
          {placed.map(({ band }, i) => (
            <li key={`key-${i}-${band.label}`} className="v3-seasons__keyitem">
              <span className="v3-seasons__swatch" />
              {band.label}
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="v3-seasons__data">
        {timeline.map((pos) => {
          const cell = cellAt(rows, pos)
          return cell ? <li key={`${pos.row}-${pos.column}`}>{readingOf(cell, ', ')}</li> : null
        })}
      </ol>
    </figure>
  )
}
