'use client'

/**
 * V3 DRAWING. The drawing that answers a typed address (site queue SITE-02b).
 *
 * WHY IT EXISTS. The place ask and the /sell ask both answered with a
 * label-and-value ledger — "Months of supply 3.9", "Days to pending 23",
 * "Comparable sales 6" — and the separate evaluator scored the community page
 * 59 with the defect named exactly: "a label/value ledger rather than a
 * drawing". DATA_GRAPHICS.md has said the same thing since it was locked: months
 * of supply is TWO BARS, homes for sale against a month of sales, never a tile
 * that says 3.9 and makes the reader do the division.
 *
 * ONE PRIMITIVE, THREE DRAWINGS, ONE SET OF PROPS (TASTE.md, "design the CLASS,
 * not the instance"). The same component draws the community ask, the /sell
 * answer, and any later surface that answers with these figures:
 *
 *   pair  — two named counts on one shared scale. Months of supply: homes for
 *           sale against homes that go under contract in a typical month, with
 *           the verdict as the figure's caption.
 *   strip — N marks on one shared axis with a reading per mark. The comparable
 *           closes by close month, address-free and price-free (Matt's ruling:
 *           a typed address on a public page gets no dollar figure).
 *   rule  — one mark on a declared axis with a context mark. Days to pending on
 *           0 to 120 with the city median beside it.
 *
 * Geometry is lib/charts/plot.ts (buildPairPlot, buildStripPlot), the same file
 * V3Chart, the admin charts and the print documents draw from, so no second
 * chart kit arrives with this one.
 *
 * WHAT EVERY DRAWING OWES.
 *  · A CLAIM. One plain sentence above the figure, in the words a person would
 *    say. TASTE.md: a data section is a sentence first, figures second.
 *  · A READING. Hover, tap and keyboard all reveal the SAME row — the exact
 *    figures, the window, and n. Hit targets are larger than the mark.
 *  · A SOURCE. The section-0 trace, per figure, in the figure's own footer —
 *    never pooled at the foot of the section where a reader cannot tell which
 *    number it belongs to. The component throws without one, because a drawn
 *    number with no source is the failure section 0 exists to stop.
 *  · AN HONEST n. A distribution under V3_DRAWING_MIN_STRIP closes is not drawn;
 *    the figure says so in one quiet line (DATA_GRAPHICS.md small-n rule).
 *
 * MOTION. One draw-on when the answer enters the viewport, under
 * V3_DRAWING_DRAW_MS, transform and opacity only, no count-ups ever. Under
 * prefers-reduced-motion the final frame renders immediately.
 *
 * G68: nothing here rounds or classifies months of supply. Every figure and
 * every verdict arrives as a string the server already formatted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPairPlot, buildStripPlot } from '@/lib/charts/plot'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3SourceDisclosure } from './atoms'
import './tokens.css'
import './V3Drawing.css'

/**
 * Closes a distribution needs before it is drawn at all. DATA_GRAPHICS.md:
 * "If a row's n is too small to be honest (fewer than 6 closes in the window
 * for a typical) omit the graphic. Do not pad."
 */
export const V3_DRAWING_MIN_STRIP = 6

/** The draw-on budget. TASTE.md motion band: entrances at most 300ms. */
export const V3_DRAWING_DRAW_MS = 280

/** One named count in a `pair` drawing. */
export type V3DrawingBar = {
  /** What this bar counts, as a person says it. Never jargon. */
  name: string
  /** Y geometry only — never written on screen (the data contract, section 0). */
  value: number
  /** The count as the caller formatted it. */
  label: string
  /** The window, population and definition a hover or a tap reveals. */
  note?: string
}

/** One mark on a `strip` or a `rule`. */
export type V3DrawingPoint = {
  /** Stable key. Never an address. */
  id: string
  /** X in the axis' own units (months back, days, square feet). */
  at: number
  /** How this mark's x reads — "July 2026". */
  tick: string
  /** The full reading: the facts this mark carries, already formatted. */
  label: string
}

export type V3DrawingFigure = {
  /** Stable key, and the drawing's DOM id seed. */
  key: string
  draw: 'pair' | 'strip' | 'rule'
  /** The sentence above the drawing, in the words a person would say. */
  claim: string
  /** The figure's short name — its accessible name and its label. */
  caption: string
  /** The section-0 trace for THIS figure: table, filter, window, n, read date. */
  source: string
  /** `pair`: the two named counts. */
  bars?: readonly V3DrawingBar[]
  /** `pair`: the verdict, as the figure's caption under the bars. */
  verdict?: string
  /** `strip` and `rule`: the marks. */
  points?: readonly V3DrawingPoint[]
  /** `rule`: the declared domain and its tick labels. */
  axis?: {
    min?: number
    max?: number
    ticks?: readonly { at: number; label: string }[]
  }
  /** `rule`: the context mark (the city median). */
  context?: { value: number; label: string }
  /** `strip`: what the marks counted, drawn once beside n. */
  sampleKey?: string
  /**
   * A real decline, drawdown or breached threshold. The ONLY thing that puts
   * --rr-exception on this surface (CLAUDE.md section 3). Never decoration.
   */
  exception?: boolean
  /**
   * The one quiet line when the drawing is omitted — too few closes, a figure
   * the place does not publish, an address that did not match. The figure still
   * renders: an answer that silently drops a question is not an answer.
   */
  emptyReason?: string
}

export type V3DrawingProps = {
  figures: readonly V3DrawingFigure[]
  /** Names the whole answer for a screen reader. */
  label?: string
  id?: string
  className?: string
}

/** The prompt under a drawing before the reader has asked it anything. */
const IDLE = {
  pair: 'Hover, tap or tab a bar for what it counts.',
  strip: 'Hover, tap or tab a sale for its size and its month.',
  rule: 'Hover, tap or tab a mark for the window behind it.',
} as const

type Reading = { key: string; text: string } | null

/**
 * Draw-on state. One observer for the whole answer: TASTE.md wants ONE
 * orchestrated reveal, not twenty micro-interactions, and a reader who has
 * asked for reduced motion gets the finished drawing on the first frame.
 */
function useDrawn(ref: React.RefObject<HTMLElement | null>): boolean {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver !== 'function') {
      setDrawn(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [ref])
  return drawn
}

export function V3Drawing({ figures, label, id, className }: V3DrawingProps) {
  const root = useRef<HTMLDivElement | null>(null)
  const drawn = useDrawn(root)
  const [reading, setReading] = useState<Reading>(null)

  // WHY THESE ARE PLAIN STRINGS AND NOT `V3Text`. The rest of the register
  // brands its visible strings so an empty one cannot compile. These figures
  // are shaped by ONE function in lib/ (lib/site/answer-figures.ts) that both
  // address asks call, and lib/ may not import a component to reach `v3Text`.
  // So the guarantee the brand gives at compile time is taken here at runtime
  // instead, on the same three fields that would otherwise render blank.
  for (const figure of figures) {
    if (figure.source.trim().length === 0) {
      throw new Error(
        `V3Drawing: figure "${figure.key}" has no source. Every drawn figure carries ` +
          'its own section-0 trace — table, filter, window, n, read date. A number ' +
          'on a public page with no source does not ship.',
      )
    }
    if (figure.claim.trim().length === 0 || figure.caption.trim().length === 0) {
      throw new Error(
        `V3Drawing: figure "${figure.key}" has no claim or no caption. A data section ` +
          'is a sentence first and figures second (TASTE.md); a drawing with no claim ' +
          'is decoration, and one with no caption has no accessible name.',
      )
    }
  }

  /**
   * Hover, tap and keyboard all reach ONE reading row, and a click SETS it
   * rather than toggling it.
   *
   * It was a toggle, and a mouse user who hovered a mark and then clicked it
   * lost the row they had just asked for — hover had already set that key, so
   * the click read as the second press of a toggle (browser, 2026-09-08). A tap
   * on a touch screen fires mouseenter first for the same reason, so the toggle
   * could never be the way a reading is dismissed either. Moving off, tabbing
   * away, or asking a different mark is.
   */
  const show = useCallback((key: string, text: string) => setReading({ key, text }), [])
  const clear = useCallback(
    (key: string) => setReading((current) => (current?.key === key ? null : current)),
    [],
  )

  return (
    <div
      ref={root}
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-drawing', drawn && 'is-drawn', className)}
      style={{ ['--v3-drawing-draw' as string]: `${V3_DRAWING_DRAW_MS}ms` }}
      aria-label={label}
      role={label ? 'group' : undefined}
    >
      {figures.map((figure, index) => (
        <V3DrawingFigureView
          key={figure.key}
          figure={figure}
          first={index === 0}
          reading={reading}
          show={show}
          clear={clear}

        />
      ))}
    </div>
  )
}

function V3DrawingFigureView({
  figure,
  first,
  reading,
  show,
  clear,
}: {
  figure: V3DrawingFigure
  /** The first drawing carries the instruction; the rest inherit it. */
  first: boolean
  reading: Reading
  show: (key: string, text: string) => void
  clear: (key: string) => void
}) {
  const seed = `v3-drawing-${figure.key}`
  const readingId = `${seed}-reading`
  const captionId = `${seed}-caption`

  const pair = useMemo(
    () => (figure.draw === 'pair' ? buildPairPlot(figure.bars ?? []) : null),
    [figure.draw, figure.bars],
  )

  // A distribution under the honest floor is NOT drawn. A rule is one declared
  // mark against a context mark, so it has no such floor — six of them would be
  // six charts.
  const enoughMarks =
    figure.draw === 'rule' || (figure.points?.length ?? 0) >= V3_DRAWING_MIN_STRIP

  const strip = useMemo(
    () =>
      (figure.draw === 'strip' || figure.draw === 'rule') && enoughMarks
        ? buildStripPlot(
            (figure.points ?? []).map((p) => ({
              id: p.id,
              at: p.at,
              tick: p.tick,
              label: p.label,
            })),
            {
              min: figure.axis?.min,
              max: figure.axis?.max,
              ticks: figure.axis?.ticks,
              refValue: figure.context?.value,
              refLabel: figure.context?.label,
              // 7% of the track is ~23px at 375, which is what keeps two
              // marks in one lane tappable. A rule has one mark, and its lane
              // gap only has to guarantee it never shares a row.
              laneGap: figure.draw === 'rule' ? 100 : 7,
            },
          )
        : null,
    [figure.draw, figure.points, figure.axis, figure.context, enoughMarks],
  )

  const plot = figure.draw === 'pair' ? pair : strip
  const live = reading && reading.key.startsWith(`${seed}:`) ? reading.text : null

  return (
    <figure
      className={cn(
        'v3-drawing__figure',
        `v3-drawing__figure--${figure.draw}`,
        figure.exception && 'is-exception',
      )}
      aria-labelledby={captionId}
    >
      <p className="v3-drawing__claim" id={captionId}>
        {figure.claim}
      </p>

      {plot == null ? (
        <p className="v3-drawing__quiet">{figure.emptyReason ?? `No ${figure.caption} to draw yet.`}</p>
      ) : plot.kind === 'pair' ? (
        <div className="v3-drawing__pair">
          {plot.bars.map((bar) => {
            const key = `${seed}:${bar.index}`
            const text = bar.note ?? `${bar.name}: ${bar.label}`
            return (
              <button
                key={key}
                type="button"
                className={cn('v3-drawing__barrow', reading?.key === key && 'is-live')}
                aria-controls={readingId}
                aria-expanded={reading?.key === key}
                onMouseEnter={() => show(key, text)}
                onFocus={() => show(key, text)}
                onMouseLeave={() => clear(key)}
                onBlur={() => clear(key)}
                onClick={() => show(key, text)}
              >
                <span className="v3-drawing__barname">{bar.name}</span>
                <span className="v3-drawing__bartrack">
                  <span
                    className="v3-drawing__barfill"
                    style={{ ['--v3-drawing-pct' as string]: `${bar.pct.toFixed(2)}%` }}
                    aria-hidden="true"
                  />
                </span>
                <span className="v3-drawing__barvalue">{bar.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div
          className={cn('v3-drawing__strip', figure.draw === 'rule' && 'v3-drawing__strip--rule')}
          style={{ ['--v3-drawing-lanes' as string]: String(plot.lanes) }}
        >
          <div className="v3-drawing__track">
            <span className="v3-drawing__baseline" aria-hidden="true" />
            {plot.ref ? (
              <span
                className="v3-drawing__context"
                style={{ ['--v3-drawing-x' as string]: `${plot.ref.xPct.toFixed(2)}%` }}
              >
                <span
                  className={cn(
                    'v3-drawing__contextlabel',
                    plot.ref.xPct > 62 && 'v3-drawing__contextlabel--before',
                  )}
                >
                  {plot.ref.label}
                </span>
              </span>
            ) : null}
            {plot.points.map((point) => {
              const key = `${seed}:${point.id}`
              return (
                <button
                  key={key}
                  type="button"
                  className={cn('v3-drawing__mark', reading?.key === key && 'is-live')}
                  style={{
                    ['--v3-drawing-x' as string]: `${point.xPct.toFixed(2)}%`,
                    ['--v3-drawing-lane' as string]: String(point.lane),
                  }}
                  aria-controls={readingId}
                  aria-expanded={reading?.key === key}
                  onMouseEnter={() => show(key, point.label)}
                  onFocus={() => show(key, point.label)}
                  onMouseLeave={() => clear(key)}
                  onBlur={() => clear(key)}
                  onClick={() => show(key, point.label)}
                >
                  <span className="v3-drawing__dot" aria-hidden="true" />
                  <span className="v3-drawing__markname">{point.tick}</span>
                </button>
              )
            })}
          </div>
          <div className="v3-drawing__axis" aria-hidden="true">
            {plot.ticks.length > 0 ? (
              plot.ticks.map((tick) => (
                <span
                  key={`${tick.label}-${tick.xPct.toFixed(2)}`}
                  className="v3-drawing__axistick"
                  style={{ ['--v3-drawing-x' as string]: `${tick.xPct.toFixed(2)}%` }}
                >
                  {tick.label}
                </span>
              ))
            ) : (
              <>
                <span className="v3-drawing__axisend">{plot.xMinLabel}</span>
                <span className="v3-drawing__axisend v3-drawing__axisend--right">{plot.xMaxLabel}</span>
              </>
            )}
          </div>
        </div>
      )}

      {plot != null && figure.draw === 'pair' && figure.verdict ? (
        <figcaption className="v3-drawing__verdict">{figure.verdict}</figcaption>
      ) : null}

      {/* n, in words. "N 8 COMPARABLE CLOSES" in tracked caps read as a heading
          rather than as the count under a figure (looked at the shot,
          2026-09-08), and "n" is jargon a visitor does not owe us. */}
      {plot != null && plot.kind === 'strip' && figure.sampleKey ? (
        <figcaption className="v3-drawing__samplekey">
          {plot.points.length} {figure.sampleKey}
        </figcaption>
      ) : null}

      {/* THE FOOTER: what this mark says, and where the figure came from.
          One row, because three copies of "hover, tap or tab…" down one answer
          read as instructions rather than as an affordance (looked at the shot,
          2026-09-08) — so only the FIRST drawing carries the prompt, and every
          drawing carries its source in the same place, in the same form. */}
      <div className="v3-drawing__foot">
        {plot != null ? (
          <p
            id={readingId}
            className={cn('v3-drawing__reading', !live && 'is-idle')}
            aria-live="polite"
          >
            {live ?? (first ? IDLE[figure.draw] : '')}
          </p>
        ) : (
          <span />
        )}
        <V3SourceDisclosure className="v3-drawing__source" source={figure.source} />
      </div>

      {/* The hidden reading list: every drawn value in the accessibility tree,
          the way V3Chart carries its own. A drawing a screen reader cannot read
          is a picture. */}
      {plot != null ? (
        <ol className="v3-drawing__data">
          {plot.kind === 'pair'
            ? plot.bars.map((bar) => (
                <li key={`d-${bar.index}`}>{`${bar.name}, ${bar.label}`}</li>
              ))
            : plot.points.map((point) => (
                <li key={`d-${point.id}`}>{`${point.tick}, ${point.label}`}</li>
              ))}
        </ol>
      ) : null}

    </figure>
  )
}
