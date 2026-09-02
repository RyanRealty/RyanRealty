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
import { useCallback, useId, useMemo, useState } from 'react'
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

  const open = useCallback(
    (qid: string) => {
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
            {marks.map(({ q, x, y }) => (
              <circle
                key={q.id}
                className={cn(
                  'v3-proof__dot',
                  (year != null && q.year !== year) && 'is-off',
                  focus === q.id && 'is-focus',
                )}
                cx={x}
                cy={y}
                r={MARK_R}
                onPointerEnter={() => setFocus(q.id)}
                onPointerLeave={() => setFocus((f) => (f === q.id ? null : f))}
                onClick={() => open(q.id)}
              >
                <title>{`${q.author}, ${q.attribution}`}</title>
              </circle>
            ))}
          </svg>
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

      <ul className="v3-proof__list" aria-live="polite">
        {shown.map((q) => (
          <li
            key={q.id}
            id={`${uid}-q-${q.id}`}
            className={cn('v3-proof__item', focus === q.id && 'is-focus')}
            onPointerEnter={() => setFocus(q.id)}
            onPointerLeave={() => setFocus((f) => (f === q.id ? null : f))}
          >
            <figure className="v3-proof__quote">
              <blockquote className="v3-proof__words">
                <p className={cn('v3-proof__pull', q.pull.length > 90 && 'is-long')}>{q.pull}</p>
                {q.rest.map((para) => (
                  <p key={para.slice(0, 48)} className="v3-proof__para">
                    {para}
                  </p>
                ))}
              </blockquote>
              <figcaption className="v3-proof__who">
                <cite className="v3-proof__author">{q.author}</cite>
                <span className="v3-proof__meta">{q.attribution}</span>
                <Marks rating={q.rating} />
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
