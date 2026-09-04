'use client'
/**
 * V3 PROOF. Verified third-party words with their record.
 *
 * Pattern: the reviews page was twenty-five quotes in one column (TASTE.md:
 * a wall). Proof gives the words a record to sit in: the figures the source
 * supports (count, average, first, newest), a strip of every review placed
 * on its month so the years read at a glance, and year chips that filter.
 * On /reviews the strip and chips ARE the instrument (`archive`): full text
 * stays in the served HTML under a disclosure, not as a 7k px card list.
 * Compact bands (`record={false}`, homepage / about / team) are a reader:
 * one review in full, the rest as picks. Stars always print from the live
 * rating. Ignore `archive`.
 *
 * Honesty: every figure and every string arrives formatted from the caller
 * (the barrel never formats, ci:public-v3 rule 3). Nothing in a quote is
 * cut: `pull` is the first sentence whole and `rest` is every sentence after
 * it, so the page prints the review exactly as it was written. The strip's
 * marks are the reviews themselves, one each. Stars are the live 1-5 rating.
 * There is no aggregateRating JSON-LD on the page (self-serving).
 */
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from './atoms'
import './tokens.css'
import './V3Proof.css'

export type V3ProofQuote = {
  id: string
  /** The first sentence, whole. */
  pull: string
  /** Everything after the first sentence, in paragraphs. May be empty. */
  rest: readonly string[]
  author: string
  /** "Verified Google review, Jul 2026" */
  attribution: string
  /** 1–5, as the source records it. */
  rating: number
  year: number
  /** 0–11 */
  month: number
}

export type V3ProofFigure = { value: string; label: string }

export type V3ProofProps = {
  id: string
  eyebrow: string
  headline: string
  headingLevel?: 1 | 2
  /** One sentence the figures support. */
  claim: string
  figures: readonly V3ProofFigure[]
  quotes: readonly V3ProofQuote[]
  /** The record's own page: "View on Google". */
  source: { label: string; href: string }
  /**
   * The strip and the year chips are the record of EVERY review. A page that
   * shows a subset (the About page's newest four) turns them off, so a strip
   * of four marks never sits beside a figure that says twenty-five.
   */
  record?: boolean
  /**
   * /reviews only. Strip + year chips are the page; every quote stays in the
   * served HTML under one disclosure. Compact `record={false}` bands ignore
   * this, so the homepage newest-four path does not move.
   */
  archive?: boolean
  className?: string
}

const STRIP_W = 1000
const STRIP_H = 96
const MARK_R = 5.5

function Marks({ rating }: { rating: number }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="v3-proof__marks" aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={cn('v3-proof__star', i < n && 'is-on')}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 2.5l2.6 6.3 6.9.6-5.2 4.5 1.6 6.7L12 16.8 6.1 20.6l1.6-6.7L2.5 9.4l6.9-.6L12 2.5z" />
        </svg>
      ))}
    </span>
  )
}

function QuoteFigure({
  q,
  displayPull,
  showMarks,
}: {
  q: V3ProofQuote
  displayPull: boolean
  showMarks: boolean
}) {
  return (
    <figure className="v3-proof__quote">
      <blockquote className="v3-proof__words">
        <p className={cn('v3-proof__pull', !displayPull && 'is-long')}>{q.pull}</p>
        {q.rest.map((para) => (
          <p key={para.slice(0, 48)} className="v3-proof__para">
            {para}
          </p>
        ))}
      </blockquote>
      <figcaption className="v3-proof__who">
        <cite className="v3-proof__author">{q.author}</cite>
        <span className="v3-proof__meta">{q.attribution}</span>
        {showMarks ? <Marks rating={q.rating} /> : null}
      </figcaption>
    </figure>
  )
}

export function V3Proof({
  id,
  eyebrow,
  headline,
  headingLevel = 1,
  claim,
  figures,
  quotes,
  source,
  record = true,
  archive = false,
  className,
}: V3ProofProps) {
  const uid = useId()
  const [year, setYear] = useState<number | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  // A click on a mark scrolls the page; the card that slides under the
  // stationary pointer must not steal the focus the click just set.
  const scrollLock = useRef(false)
  const hoverCard = useCallback((qid: string) => {
    if (scrollLock.current) return
    setFocus(qid)
  }, [])
  const showMarks = quotes.length > 0
  const compactReading = useMemo(() => {
    if (record) return null
    if (focus) {
      const hit = quotes.find((q) => q.id === focus)
      if (hit) return hit
    }
    return quotes[0] ?? null
  }, [record, focus, quotes])
  const layerRef = useRef<HTMLDivElement>(null)
  const asArchive = record && archive

  const years = useMemo(() => {
    const set = new Set(quotes.map((q) => q.year))
    return [...set].sort((a, b) => a - b)
  }, [quotes])
  const first = years[0] ?? 0
  const last = years[years.length - 1] ?? first
  const span = Math.max(1, last + 1 - first)

  /* Marks: one per review at its month. A mark keeps its month exactly — the
     strip is a time axis — and rises a row whenever the row below already
     holds a mark within MIN_GAP. Stacking only same-month marks left adjacent
     months 3.5px apart at 375, two-thirds overlapped, so a tap four pixels off
     opened a different review in three of six trials (evaluator round five,
     REVIEWS-1). */
  const marks = useMemo(() => {
    /* Both spacings are the 24px WCAG 2.5.8 floor, in the units each axis is
       measured in.

       X is in strip units and the strip scales: 1000 units render as about
       335px on a 390 phone, so 24px on screen is 72 units. It was 34 — about
       11px — which is why an evaluator measured twenty-three of twenty-four
       gaps under 44px and eight pairs under one pixel.

       Y is in CSS pixels already: the layer is a fixed 6rem and y maps 1:1. The
       row pitch was one mark diameter plus three, 14px, so stacked marks in
       adjacent rows nearly touched. */
    const MIN_GAP_X = 72
    const ROW_PITCH = 24
    // Four rows is what 96px of strip holds at that pitch. Rows used to be
    // unbounded and everything past the fourth clamped to the same y, which put
    // a clamped mark three pixels from the row above it — worse than the
    // crowding the rows exist to fix.
    const ROWS = Math.max(1, Math.floor((STRIP_H - 14 - MARK_R) / ROW_PITCH) + 1)
    const rowLastX: number[] = new Array(ROWS).fill(-Infinity)
    const placed = quotes
      .map((q) => ({ q, x: ((q.year - first + (q.month + 0.5) / 12) / span) * STRIP_W }))
      .sort((a, b) => a.x - b.x)
      .map(({ q, x }) => {
        let row = rowLastX.findIndex((lastX) => x - lastX >= MIN_GAP_X)
        if (row < 0) {
          // Every row is still crowded here. Take the emptiest, which is the
          // largest gap available, rather than inventing a row with none.
          row = rowLastX.reduce((best, lastX, i) => (lastX < rowLastX[best]! ? i : best), 0)
        }
        rowLastX[row] = x
        return { q, x, y: STRIP_H - 14 - row * ROW_PITCH }
      })
    // Back to the order the cards are in, so the roving index and the list
    // agree.
    const byId = new Map(placed.map((m) => [m.q.id, m]))
    return quotes.map((q) => byId.get(q.id)!).filter(Boolean)
  }, [quotes, first, span])

  const shown = useMemo(() => (year == null ? quotes : quotes.filter((q) => q.year === year)), [quotes, year])
  const reading = useMemo(() => {
    if (!asArchive) return null
    if (focus) {
      const hit = quotes.find((q) => q.id === focus)
      if (hit && (year == null || hit.year === year)) return hit
    }
    return shown[0] ?? null
  }, [asArchive, focus, quotes, year, shown])
  /* The strip's one tab stop rests on a mark the filter shows (pass three, D12). */
  const defaultMarkId = useMemo(
    () => (year == null ? marks[0] : marks.find((m) => m.q.year === year))?.q.id ?? null,
    [marks, year],
  )

  /* The mark whose centre is nearest the pointer, in screen pixels: marks in
     dense months overlap, and the topmost box is not the one under the eye. */
  const nearestMark = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = layerRef.current
      if (!el || marks.length === 0) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      let best: string | null = null
      let bestD = Infinity
      for (const m of marks) {
        const mx = r.left + (m.x / STRIP_W) * r.width
        const my = r.top + (m.y / STRIP_H) * r.height
        const d = (mx - clientX) ** 2 + (my - clientY) ** 2
        if (d < bestD) {
          bestD = d
          best = m.q.id
        }
      }
      return bestD <= 28 * 28 ? best : null
    },
    [marks],
  )

  const open = useCallback(
    (qid: string) => {
      scrollLock.current = true
      window.setTimeout(() => {
        scrollLock.current = false
      }, 1500)
      setFocus(qid)
      const q = quotes.find((x) => x.id === qid)
      if (q && year != null && q.year !== year) setYear(null)
      requestAnimationFrame(() => {
        // A reader who asked for less motion gets a jump, not a 3,244px glide
        // (evaluator round five, REVIEWS-3). Archive mode reads in the pane
        // under the strip, so there is no 7k list to glide through.
        const still =
          typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const target = asArchive ? `${uid}-read` : `${uid}-q-${qid}`
        document.getElementById(target)?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
      })
    },
    [quotes, year, uid, asArchive],
  )

  return (
    <section
      id={id}
      // headingLevel 1 means this headline IS the page's title, so the section
      // opens the page: its upper neighbour is the chrome, not another section,
      // and it pays the chrome's spacing rather than the section rhythm. Same
      // distinction PUBLIC_UI.md section 6 already makes for the section rule
      // ("the section that opens the page carries none").
      className={cn(V3_ROOT_CLASS, 'v3-proof', headingLevel === 1 && 'v3-proof--lead', className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="v3-proof__head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={headingLevel} id={`${uid}-h`} className="v3-proof__headline">
          {headline}
        </V3Heading>
        <p className="v3-proof__claim">{claim}</p>
      </div>

      {figures.length > 0 ? (
        <dl className="v3-proof__figures">
          {figures.map((f) => {
            const n = Number(f.value)
            const isScore = /average/.test(f.label) && Number.isFinite(n) && n >= 1 && n <= 5
            return (
              <div key={`${f.value} ${f.label}`} className="v3-proof__figure">
                <dt className="v3-proof__figure-value">{f.value}</dt>
                {isScore ? <Marks rating={n} /> : null}
                <dd className="v3-proof__figure-label">{f.label}</dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      {/* The record: every review on its month. Hover or tap a mark to read
          it; the year chips filter the cards below. */}
      {record && years.length > 0 ? (
        <div className="v3-proof__record">
          {/* Nothing on the page said the strip could be worked: the only
              per-mark readout was the browser's own tooltip (evaluator round
              five, REVIEWS-4). */}
          <p className="v3-proof__how">Every review on its month. Point at a mark to read it, or pick a year.</p>
          <div className="v3-proof__strip-wrap">
          <svg
            className="v3-proof__strip"
            viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${quotes.length} reviews from ${first} to ${last}, one mark each`}
          >
            <line className="v3-proof__strip-base" x1={0} x2={STRIP_W} y1={STRIP_H - 6} y2={STRIP_H - 6} />
            {years.map((y) => (
              <line
                key={y}
                className="v3-proof__strip-tick"
                x1={((y - first) / span) * STRIP_W}
                x2={((y - first) / span) * STRIP_W}
                y1={STRIP_H - 6}
                y2={STRIP_H}
              />
            ))}
          </svg>
          {/* The marks are buttons placed over the strip, not SVG shapes: a
              true dot at every width, a real tap target, and keyboard reach
              by nature (evaluator B4, B8). */}
          <div
            ref={layerRef}
            className="v3-proof__marks-layer"
            role="group"
            aria-label="Every review on its month. Arrow keys move between them, Enter opens one."
            onKeyDown={(e) => {
              // One tab stop for the strip; arrows walk the marks (C10).
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
              e.preventDefault()
              const order = marks.map((m) => m.q.id)
              const cur = order.indexOf(focus ?? '')
              const next =
                e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : cur < 0 ? 0 : Math.max(0, Math.min(order.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)))
              const id = order[next]
              if (!id) return
              setFocus(id)
              const el = layerRef.current?.querySelector<HTMLButtonElement>(`[data-mark="${id}"]`)
              el?.focus()
            }}
            onPointerMove={(e) => {
              const id = nearestMark(e.clientX, e.clientY)
              if (id) setFocus(id)
            }}
            onPointerLeave={() => {
              // The page scrolls out from under the pointer after a click;
              // that leave must not clear the focus the click just set.
              if (!scrollLock.current) setFocus(null)
            }}
            onClick={(e) => {
              const id = nearestMark(e.clientX, e.clientY)
              if (id) open(id)
            }}
          >
            {marks.map(({ q, x, y }) => (
              <button
                key={q.id}
                type="button"
                className={cn(
                  'v3-proof__dot',
                  (year != null && q.year !== year) && 'is-off',
                  focus === q.id && 'is-focus',
                )}
                style={{ left: `${(x / STRIP_W) * 100}%`, top: `${(y / STRIP_H) * 100}%` }}
                data-mark={q.id}
                tabIndex={focus === q.id || (focus == null && defaultMarkId === q.id) ? 0 : -1}
                aria-label={`${q.author}, ${q.attribution}`}
                title={`${q.author}, ${q.attribution}`}
                onFocus={() => setFocus(q.id)}
                onClick={(e) => {
                  // Keyboard activation reaches the button; pointer clicks are
                  // resolved by the layer to the nearest mark, so dense months
                  // never hand a tap to a neighbour.
                  e.stopPropagation()
                  open(q.id)
                }}
              />
            ))}
          </div>
          <div className="v3-proof__years" aria-hidden="true">
            {years.map((y) => (
              <span key={y} className="v3-proof__year" style={{ left: `${((y - first) / span) * 100}%` }}>
                {y}
              </span>
            ))}
          </div>
          </div>
          <div className="v3-proof__filters" role="group" aria-label="Show reviews from">
            <button
              type="button"
              className="v3-proof__chip"
              aria-pressed={year == null}
              onClick={() => {
                setYear(null)
                setFocus(null)
              }}
            >
              All {quotes.length}
            </button>
            {[...years].reverse().map((y) => {
              const n = quotes.filter((q) => q.year === y).length
              return (
                <button
                  key={y}
                  type="button"
                  className="v3-proof__chip"
                  aria-pressed={year === y}
                  onClick={() => {
                    setYear((cur) => (cur === y ? null : y))
                    setFocus(null)
                  }}
                >
                  {y} <span className="v3-proof__chip-n">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {record ? (
        <p className="v3-proof__status" aria-live="polite">
          {year == null ? `Showing all ${quotes.length} reviews` : `Showing ${shown.length} reviews from ${year}`}
        </p>
      ) : null}
      {asArchive ? (
        <div className="v3-proof__archive-wrap">
          <div id={`${uid}-read`} className="v3-proof__reading">
            {reading ? (
              <QuoteFigure q={reading} displayPull showMarks={showMarks} />
            ) : (
              <p className="v3-proof__reading-empty">Point at a mark, or pick a year, to read a review here.</p>
            )}
          </div>
          <details className="v3-proof__archive">
            <summary className="v3-proof__archive-summary">
              Every review as written
              <span className="v3-proof__archive-n">{quotes.length}</span>
            </summary>
            <ul className="v3-proof__archive-list">
              {quotes.map((q) => (
                <li
                  key={q.id}
                  id={`${uid}-q-${q.id}`}
                  className={cn(
                    'v3-proof__archive-item',
                    year != null && q.year !== year && 'is-off',
                    focus === q.id && 'is-focus',
                  )}
                >
                  <QuoteFigure q={q} displayPull={false} showMarks={showMarks} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : record ? (
        <ul className="v3-proof__list">
          {shown.map((q) => (
            <li
              key={q.id}
              id={`${uid}-q-${q.id}`}
              className={cn('v3-proof__item', focus === q.id && 'is-focus')}
              onPointerEnter={() => hoverCard(q.id)}
              onClick={() => hoverCard(q.id)}
              onPointerLeave={() => {
                if (!scrollLock.current) setFocus((f) => (f === q.id ? null : f))
              }}
            >
              <QuoteFigure q={q} displayPull={record} showMarks={showMarks} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="v3-proof__reader">
          <div id={`${uid}-read`} className="v3-proof__reading">
            {compactReading ? <QuoteFigure q={compactReading} displayPull showMarks={showMarks} /> : null}
          </div>
          <ul className="v3-proof__picks">
            {quotes.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className={cn('v3-proof__pick', compactReading?.id === q.id && 'is-on')}
                  aria-pressed={compactReading?.id === q.id}
                  onClick={() => setFocus(q.id)}
                >
                  <Marks rating={q.rating} />
                  <span className="v3-proof__pick-pull">{q.pull}</span>
                  <span className="v3-proof__pick-who">{q.author}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="v3-proof__source">
        <a href={source.href} target="_blank" rel="noopener noreferrer">
          {source.label}
        </a>
      </p>
    </section>
  )
}
