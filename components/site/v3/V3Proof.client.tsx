'use client'
/**
 * V3 PROOF. Verified third-party words with their record.
 *
 * Pattern: the reviews page was twenty-five quotes in one column (TASTE.md:
 * a wall). Proof gives the words a record to sit in: the figures the source
 * supports (count, average, first, newest), a strip of every review placed
 * on its month so the years read at a glance, year chips that filter, and
 * the quotes as cards whose opening sentence is set in the display face so
 * a reader can scan twenty-five voices in one pass and open any of them.
 *
 * Honesty: every figure and every string arrives formatted from the caller
 * (the barrel never formats, ci:public-v3 rule 3). Nothing in a quote is
 * cut: `pull` is the first sentence whole and `rest` is every sentence after
 * it, so the page prints the review exactly as it was written. The strip's
 * marks are the reviews themselves, one each; there is no aggregate rating
 * markup on the page (self-serving reviews carry none).
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
        <span key={i} className={cn('v3-proof__mark', i < n && 'is-on')} aria-hidden="true" />
      ))}
    </span>
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
  const showMarks = useMemo(() => quotes.some((q) => q.rating < 5), [quotes])
  const layerRef = useRef<HTMLDivElement>(null)

  const years = useMemo(() => {
    const set = new Set(quotes.map((q) => q.year))
    return [...set].sort((a, b) => a - b)
  }, [quotes])
  const first = years[0] ?? 0
  const last = years[years.length - 1] ?? first
  const span = Math.max(1, last + 1 - first)

  /* Marks: one per review at its month, stacked when a month holds more. */
  const marks = useMemo(() => {
    const byMonth = new Map<string, number>()
    return quotes.map((q) => {
      const key = `${q.year}-${q.month}`
      const stack = byMonth.get(key) ?? 0
      byMonth.set(key, stack + 1)
      const x = ((q.year - first + (q.month + 0.5) / 12) / span) * STRIP_W
      const y = STRIP_H - 14 - stack * (MARK_R * 2 + 3)
      return { q, x, y: Math.max(MARK_R + 1, y) }
    })
  }, [quotes, first, span])

  const shown = useMemo(() => (year == null ? quotes : quotes.filter((q) => q.year === year)), [quotes, year])

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
        document.getElementById(`${uid}-q-${qid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    },
    [quotes, year, uid],
  )

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-proof', className)}
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
          {figures.map((f) => (
            <div key={`${f.value} ${f.label}`} className="v3-proof__figure">
              <dt className="v3-proof__figure-value">{f.value}</dt>
              <dd className="v3-proof__figure-label">{f.label}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* The record: every review on its month. Hover or tap a mark to read
          it; the year chips filter the cards below. */}
      {record && years.length > 0 ? (
        <div className="v3-proof__record">
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
                tabIndex={focus === q.id || (focus == null && marks[0]?.q.id === q.id) ? 0 : -1}
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
          <div className="v3-proof__filters" role="group" aria-label="Show reviews from">
            <button
              type="button"
              className="v3-proof__chip"
              aria-pressed={year == null}
              onClick={() => setYear(null)}
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
                  onClick={() => setYear((cur) => (cur === y ? null : y))}
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
      <ul className={cn('v3-proof__list', !record && 'v3-proof__list--compact')}>
        {shown.map((q) => (
          <li
            key={q.id}
            id={`${uid}-q-${q.id}`}
            className={cn('v3-proof__item', focus === q.id && 'is-focus')}
            onPointerEnter={() => hoverCard(q.id)}
            onPointerLeave={() => {
              if (!scrollLock.current) setFocus((f) => (f === q.id ? null : f))
            }}
          >
            <figure className="v3-proof__quote">
              <blockquote className="v3-proof__words">
                <p className={cn('v3-proof__pull', (!record || q.pull.length > 90) && 'is-long')}>{q.pull}</p>
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
          </li>
        ))}
      </ul>

      <p className="v3-proof__source">
        <a href={source.href} target="_blank" rel="noopener noreferrer">
          {source.label}
        </a>
      </p>
    </section>
  )
}
