'use client'
/**
 * V3 PROOF BLOCK. The brokerage's own record, drawn, beside the ask.
 *
 * Site queue SITE-11. `V3Proof` is the REVIEWS instrument — twenty-five
 * quotes given a strip and year chips. This is a different job: what our
 * closings DID, next to what the market did, with the reviews and the reach
 * to a named broker sitting beside it as one composed object rather than
 * three stacked bands.
 *
 * ─── THE FORM, AND WHY ──────────────────────────────────────────────────────
 *
 * Two dot strips on a shared set of homes. Each closing is one mark on each
 * strip; the market's median is a taller context mark on the same track. The
 * two strips are LINKED — pointing at a mark on either one lights the same
 * closing on both and prints its reading. That link is the whole point of the
 * form: it is how a reader sees that the home which took a hundred and sixty
 * days is also the one that closed furthest under its first ask. A table of
 * fourteen numbers cannot show that, and neither can two separate charts.
 *
 * DATA_GRAPHICS.md: one question per drawing, claim first, the drawing IS the
 * number, hover reveals the exact figure and n, keyboard gets the same
 * reading. TASTE.md: navy on cream, context in tints, thin marks, no number
 * on every point, and `--rr-exception` stays unused here — a home selling
 * under its first ask in a slow market is not a data exception, and tagging a
 * former client's home in the exception ink would be editorializing in colour.
 *
 * ─── WHAT THIS COMPONENT WILL NOT DO ────────────────────────────────────────
 *
 * It does not compute, format, or round. Marks arrive placed (percent of the
 * track) and labelled; the medians arrive as sentences. See
 * `V3ProofBlock.view.ts`, which is where the arithmetic lives and where it is
 * tested. It carries no address and no price per closing: the set is small
 * enough that a month plus a price identifies a former client's home.
 *
 * It states the count and never leads with a percentage (Matt 2026-09-07).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceDisclosure } from './atoms'
import { V3ProofStars } from './V3Proof.client'
import './tokens.css'
import './V3ProofBlock.css'

export type V3ProofStripKey = 'days' | 'ratio'

/** One closing, placed on both tracks and labelled for both readings. */
export type V3ProofMark = {
  id: string
  /** "Sep 2025 · Bend" */
  when: string
  daysLabel: string | null
  /** Percent of the days track, 0-100. Null when the figure is absent. */
  daysPct: number | null
  /** Vertical lane, so two close marks do not sit on top of each other. */
  daysLane: number
  ratioLabel: string | null
  /** "93.7%" — the same figure short enough to float at the mark itself. */
  ratioShort: string | null
  /** "10.0% under the first ask" — the same figure said the way a person says it. */
  ratioAside: string | null
  ratioPct: number | null
  ratioLane: number
}

export type V3ProofStrip = {
  key: V3ProofStripKey
  /** The axis question, in plain words. Never a slug, never methodology jargon. */
  label: string
  /** The claim this drawing makes, as one sentence. Figures second. */
  claim: string
  minLabel: string
  maxLabel: string
  /** The market's median on the same track. */
  context: { pct: number; label: string; name: string } | null
  /** A meaningful zero on the track, when the scale has one. */
  anchor: { pct: number; label: string } | null
  /** Why some closings are missing from this strip. */
  note: string | null
}

export type V3ProofQuoteView = {
  id: string
  /** The review exactly as written. Never trimmed. */
  text: string
  author: string
  attribution: string
  rating: number
}

export type V3ProofReach = {
  key: string
  kind: 'call' | 'text' | 'book'
  href: string
  /** "Call Matt" */
  label: string
}

/** What a reach click reports, so the accept test can find it by rr_vid. */
export type V3ProofBlockAttribution = {
  /** "sell" | "place" */
  surface: string
  /** The place slug the section is sitting on. */
  place: string
  /** "proof_block" */
  source: string
}

export type V3ProofBlockProps = {
  id: string
  eyebrow: string
  heading: string
  headingLevel?: 1 | 2
  claim: string
  marks: readonly V3ProofMark[]
  strips: readonly V3ProofStrip[]
  countLine: string
  record: { value: string; label: string; aside: string } | null
  reviews: {
    score: string
    rating: number
    line: string
    quotes: readonly V3ProofQuoteView[]
  } | null
  reach: readonly V3ProofReach[]
  attribution: V3ProofBlockAttribution
  /** The full section 0 trace, collapsed behind one word. */
  trace: string
  /** Printed instead of the drawing when the window is too thin to be honest. */
  quiet?: string | null
  className?: string
}

const REACH_EVENT: Record<V3ProofReach['kind'], 'call_initiated' | 'text_initiated' | 'contact_agent_click'> = {
  call: 'call_initiated',
  text: 'text_initiated',
  book: 'contact_agent_click',
}

function markPct(mark: V3ProofMark, key: V3ProofStripKey): number | null {
  return key === 'days' ? mark.daysPct : mark.ratioPct
}

function markLane(mark: V3ProofMark, key: V3ProofStripKey): number {
  return key === 'days' ? mark.daysLane : mark.ratioLane
}

/**
 * One track. The marks are buttons on a roving tabindex, so the strip is ONE
 * tab stop and the arrow keys walk it — fourteen tab stops for seven homes
 * would be a worse keyboard experience than the pointer one.
 */
function Strip({
  strip,
  marks,
  active,
  onActivate,
  drawn,
  uid,
}: {
  strip: V3ProofStrip
  marks: readonly V3ProofMark[]
  active: string | null
  onActivate: (id: string) => void
  drawn: boolean
  uid: string
}) {
  const placed = useMemo(
    () => marks.filter((m) => markPct(m, strip.key) != null),
    [marks, strip.key],
  )
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const activeIndex = Math.max(
    0,
    placed.findIndex((m) => m.id === active),
  )

  const move = useCallback(
    (delta: number) => {
      if (placed.length === 0) return
      const next = placed[(activeIndex + delta + placed.length) % placed.length]
      if (!next) return
      onActivate(next.id)
      refs.current[next.id]?.focus()
    },
    [placed, activeIndex, onActivate],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      const first = placed[0]
      if (first) {
        onActivate(first.id)
        refs.current[first.id]?.focus()
      }
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = placed[placed.length - 1]
      if (last) {
        onActivate(last.id)
        refs.current[last.id]?.focus()
      }
    }
  }

  const headingId = `${uid}-${strip.key}-label`

  return (
    <div className="v3-proofblock__strip">
      <p className="v3-proofblock__strip-claim">{strip.claim}</p>
      <p className="v3-proofblock__strip-label" id={headingId}>
        {strip.label}
      </p>
      <div
        className={cn('v3-proofblock__track', drawn && 'is-drawn')}
        role="group"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
      >
        <span className="v3-proofblock__rule" aria-hidden="true" />
        {strip.anchor ? (
          <span
            className={cn('v3-proofblock__anchor', strip.anchor.pct > 55 && 'is-late')}
            style={{ left: `${strip.anchor.pct}%` }}
            aria-hidden="true"
          >
            <span className="v3-proofblock__anchor-label">{strip.anchor.label}</span>
          </span>
        ) : null}
        {strip.context ? (
          <span
            className={cn('v3-proofblock__context', strip.context.pct > 55 && 'is-late')}
            style={{ left: `${strip.context.pct}%` }}
            aria-hidden="true"
          >
            <span className="v3-proofblock__context-label">
              {strip.context.name}
              <b>{strip.context.label}</b>
            </span>
          </span>
        ) : null}
        {placed.map((m, i) => {
          const pct = markPct(m, strip.key) as number
          const lane = markLane(m, strip.key)
          const isActive = m.id === active
          const reading = strip.key === 'days' ? m.daysLabel : m.ratioLabel
          const atMark = strip.key === 'days' ? m.daysLabel : m.ratioShort
          return (
            <button
              key={m.id}
              type="button"
              ref={(el) => {
                refs.current[m.id] = el
              }}
              className={cn(
                'v3-proofblock__mark',
                isActive && 'is-active',
                // A centred label on a mark at either end of the track hangs
                // off the edge and is clipped. Anchor it inward instead.
                pct < 12 && 'is-first',
                pct > 88 && 'is-last',
              )}
              style={{ left: `${pct}%`, ['--v3-mark-lane' as string]: String(lane), ['--v3-mark-i' as string]: String(i) }}
              tabIndex={i === activeIndex ? 0 : -1}
              aria-pressed={isActive}
              onPointerEnter={() => onActivate(m.id)}
              onFocus={() => onActivate(m.id)}
              onClick={() => onActivate(m.id)}
            >
              <span className="v3-proofblock__mark-dot" aria-hidden="true" />
              {atMark ? (
                <span className="v3-proofblock__mark-value" aria-hidden="true">
                  {atMark}
                </span>
              ) : null}
              <span className="v3-proofblock__sr">
                {m.when}, {reading ?? 'no figure'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="v3-proofblock__axis" aria-hidden="true">
        <span>{strip.minLabel}</span>
        <span>{strip.maxLabel}</span>
      </p>
      {strip.note ? <p className="v3-proofblock__note">{strip.note}</p> : null}
    </div>
  )
}

/**
 * The words. One review in full; the others are picks that swap it. Same
 * reader `V3Proof`'s compact band uses, so the two surfaces do not grow two
 * ways of showing one thing.
 */
function ReviewReader({
  reviews,
  uid,
}: {
  reviews: NonNullable<V3ProofBlockProps['reviews']>
  uid: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const shown = useMemo(
    () => reviews.quotes.find((q) => q.id === picked) ?? reviews.quotes[0] ?? null,
    [reviews.quotes, picked],
  )
  if (!shown) return null

  return (
    <div className="v3-proofblock__words">
      <p className="v3-proofblock__score">
        <V3ProofStars rating={reviews.rating} />
        <span className="v3-proofblock__score-line">{reviews.line}</span>
      </p>
      <figure className="v3-proofblock__quote" id={`${uid}-quote`}>
        <blockquote>
          <p>{shown.text}</p>
        </blockquote>
        <figcaption>
          <cite>{shown.author}</cite>
          <span>{shown.attribution}</span>
        </figcaption>
      </figure>
      {reviews.quotes.length > 1 ? (
        <div className="v3-proofblock__more">
          <p className="v3-proofblock__more-label" id={`${uid}-more`}>
            More reviews
          </p>
          <div className="v3-proofblock__picks" role="group" aria-labelledby={`${uid}-more`}>
          {reviews.quotes.map((q) => (
            <button
              key={q.id}
              type="button"
              className={cn('v3-proofblock__pick', q.id === shown.id && 'is-active')}
              aria-pressed={q.id === shown.id}
              aria-controls={`${uid}-quote`}
              onPointerEnter={() => setPicked(q.id)}
              onFocus={() => setPicked(q.id)}
              onClick={() => setPicked(q.id)}
            >
                {q.author}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function V3ProofBlock({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  claim,
  marks,
  strips,
  countLine,
  record,
  reviews,
  reach,
  attribution,
  trace,
  quiet,
  className,
}: V3ProofBlockProps) {
  const uid = useId().replace(/:/g, '')
  const [active, setActive] = useState<string | null>(marks[0]?.id ?? null)
  const [drawn, setDrawn] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  // Draw-on when the visitor scrolls the section into view. Reduced motion
  // gets the same graphic, already complete: the class lands immediately and
  // the stylesheet turns the transition off.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setDrawn(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDrawn(true)
            io.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const reading = useMemo(
    () => marks.find((m) => m.id === active) ?? marks[0] ?? null,
    [marks, active],
  )

  const onReach = (r: V3ProofReach) => {
    trackEvent(REACH_EVENT[r.kind], {
      surface: attribution.surface,
      place: attribution.place,
      source: attribution.source,
      reach: r.kind,
    })
  }

  const hasDrawing = strips.length > 0 && marks.length > 0 && !quiet

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-proofblock', className)}
      aria-labelledby={`${uid}-heading`}
    >
      <div className="v3-proofblock__head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={headingLevel} id={`${uid}-heading`}>
          {heading}
        </V3Heading>
        <p className="v3-proofblock__claim">{claim}</p>
      </div>

      <div className="v3-proofblock__body">
        <div className="v3-proofblock__drawing">
          {hasDrawing ? (
            <>
              <div className="v3-proofblock__strips">
                {strips.map((strip) => (
                  <Strip
                    key={strip.key}
                    strip={strip}
                    marks={marks}
                    active={active}
                    onActivate={setActive}
                    drawn={drawn}
                    uid={uid}
                  />
                ))}
              </div>

              <div className="v3-proofblock__reading" aria-live="polite">
                {reading ? (
                  <>
                    <span className="v3-proofblock__reading-when">{reading.when}</span>
                    <span className="v3-proofblock__reading-figures">
                      {reading.daysLabel ? (
                        <span>
                          <b>{reading.daysLabel}</b> to an offer
                        </span>
                      ) : (
                        <span className="v3-proofblock__reading-off">no day count</span>
                      )}
                      {reading.ratioLabel ? (
                        <span>
                          closed at <b>{reading.ratioLabel}</b>
                          {reading.ratioAside ? (
                            <i className="v3-proofblock__reading-aside">{reading.ratioAside}</i>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : null}
              </div>

              {countLine ? <p className="v3-proofblock__count">{countLine}</p> : null}
              <V3SourceDisclosure source={trace} className="v3-proofblock__trace" />
            </>
          ) : (
            <p className="v3-proofblock__quiet">{quiet ?? countLine}</p>
          )}
        </div>

        <aside className="v3-proofblock__rail">
          {record ? (
            <p className="v3-proofblock__figure">
              <span className="v3-proofblock__figure-value">{record.value}</span>
              <span className="v3-proofblock__figure-label">{record.label}</span>
              <span className="v3-proofblock__figure-aside">{record.aside}</span>
            </p>
          ) : null}

          {reviews ? <ReviewReader reviews={reviews} uid={uid} /> : null}

          {reach.length > 0 ? (
            <div className="v3-proofblock__reach">
              {reach.map((r) =>
                r.kind === 'book' ? (
                  <Link
                    key={r.key}
                    href={r.href}
                    className="v3-proofblock__reach-link"
                    onClick={() => onReach(r)}
                  >
                    {r.label}
                  </Link>
                ) : (
                  <a
                    key={r.key}
                    href={r.href}
                    className="v3-proofblock__reach-link"
                    onClick={() => onReach(r)}
                  >
                    {r.label}
                  </a>
                ),
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
