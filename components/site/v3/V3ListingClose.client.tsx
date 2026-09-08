'use client'

/**
 * V3ListingClose — the listing page's ending.
 *
 * SITE-06 (Matt, site queue 2026-09-08): the listing page used to stop. It ran
 * out of sections and left the visitor holding an asking price with nothing to
 * do about it. This is the close: ONE section, claim first, that answers "what
 * do I do about this house" with the market fact drawn beside it.
 *
 * ── WHY IT IS ONE SECTION AND NOT FOUR CONTROLS ────────────────────────────
 * TASTE.md bans the stacked-section page, and four asks in a row is that tell
 * in its purest form. So the three acts are a CHOOSER: three equal doors, one
 * panel, one at a time. The reader picks what they want to do; the page does
 * not ask them four times.
 *
 * ── THE DRAWING ────────────────────────────────────────────────────────────
 * A hundred dots, one per hundred homes that sold in this city in the last
 * twelve months, filled for the ones that cut their price first. Beside it, a
 * ruler for how deep the typical cut went and a mark for how long the typical
 * home waited for a contract. DATA_GRAPHICS.md: one question per drawing,
 * plain label, the number on hover. Hovering or focusing any of the three
 * swaps the readout under them for that figure's own sentence, its sample size
 * and its §0 trace — the trace IS the interaction, and the keyboard gets the
 * same reading as the mouse.
 *
 * ── WHAT IT NEVER DOES ─────────────────────────────────────────────────────
 * It does not apply the city's median cut to THIS house's ask. That number
 * would look like a prediction about a specific seller and CLAUDE.md §0 forbids
 * an estimate with no named basis. The city's record is the city's record; what
 * this house does is between the seller and a broker, which is act two.
 */

import { useCallback, useId, useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceDisclosure } from './atoms'
import type { CloseView } from './V3ListingClose.view'
import { readPayment, readPaymentServer, subscribePayment } from '@/lib/listing/payment-bus'
import { submitListingPriceDropWatch } from '@/app/actions/search-alert-capture'
import { submitListingPaymentEmail } from '@/app/actions/listing-payment-email'
import { formatPriceExact } from '@/lib/format/money'
import './V3ListingClose.css'

type ActId = 'watch' | 'tour' | 'payment'

export type V3ListingCloseProps = {
  /** The key the capture actions write onto the row. */
  listingKey: string
  /** Street line, shown to the reader and stored as the alert row's name. */
  addressLine: string
  /** /book for this broker, carrying this listing. */
  bookHref: string
  /** Anchor of the payment calculator on the same page. */
  paymentHref: string
  /** Null when no figure for this city published honestly at 12 months. */
  view: CloseView | null
  headingLevel?: 1 | 2
  /**
   * The section's anchor. Defaults to 'close' — the id the listing page's
   * parity contract names — but the CALLER passes it, so the anchor a reader
   * of page.tsx is looking for is written where they look. ci:page-purpose
   * reads the call site, and a contract that says #close while the id hides
   * inside the component is a contract nobody can check from the page.
   */
  id?: string
  className?: string
}

const ACTS: ReadonlyArray<{ id: ActId; label: string; hint: string }> = [
  { id: 'watch', label: 'Tell me if this price drops', hint: 'One email, only on a change' },
  { id: 'tour', label: 'Walk through it', hint: 'See a broker\u2019s open times' },
  { id: 'payment', label: 'Email me this payment', hint: 'Your own numbers, sent once' },
]

/* -------------------------------------------------------------------------- */
/* The drawing                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A hundred homes that SOLD. This listing is not one of them and is not marked
 * here: it is still on the market, and seating a live listing inside a closed-
 * sale population would be a category error however neatly it drew. Its own cut
 * and its own days live are like-for-like against the same record and sit on the
 * two drawings below, each labelled as this home.
 */
function DotField({ filled, active }: { filled: number; active: boolean }) {
  const dots = useMemo(() => Array.from({ length: 100 }, (_, i) => i < filled), [filled])
  return (
    <span className={cn('v3-close__dots', active && 'is-active')} aria-hidden="true">
      {dots.map((on, i) => (
        <span key={i} className={cn('v3-close__dot', on && 'is-on')} />
      ))}
    </span>
  )
}

/**
 * Two bars, not a sliver. The first pass drew the median cut as 5.9% of a
 * full-width rule and the evaluator called it what it looked like: a glitch at
 * the end of a line, not a cut. Drawn as the first ask against what was left
 * after the cut, the same number reads instantly — the second bar is visibly
 * short of the first, and the gap is the cut.
 */
function DepthRule({
  depth,
  active,
  subject,
}: {
  depth: number
  active: boolean
  /** `label` is the CUT, formatted ("7.2%") — not the address. */
  subject: { cutDepth: number; label: string } | null
}) {
  const typicalPct = depth * 100
  const ownPct = subject ? subject.cutDepth * 100 : null
  // The axis ends at the next whole 5% past the longer bar, so the two lengths
  // fill the frame and the difference between them is the thing you see.
  const axisMax = Math.max(5, Math.ceil(Math.max(typicalPct, ownPct ?? 0) / 5) * 5)
  const w = (pct: number) => `${Math.min(100, (pct / axisMax) * 100)}%`
  return (
    <span className={cn('v3-close__bars', active && 'is-active')} aria-hidden="true">
      <span className="v3-close__bar-row">
        <span className="v3-close__bar-label">
          typical cut, {Math.round(typicalPct * 10) / 10}%
        </span>
        <span className="v3-close__bar-track">
          <span className="v3-close__bar v3-close__bar--kept" style={{ width: w(typicalPct) }} />
          <span className="v3-close__bar-gap" style={{ width: `${100 - Math.min(100, (typicalPct / axisMax) * 100)}%` }} />
        </span>
      </span>
      {ownPct != null ? (
        <span className="v3-close__bar-row v3-close__bar-row--subject">
          <span className="v3-close__bar-label">this home, {subject!.label}</span>
          <span className="v3-close__bar-track">
            <span className="v3-close__bar v3-close__bar--subject" style={{ width: w(ownPct) }} />
            <span className="v3-close__bar-gap" style={{ width: `${100 - Math.min(100, (ownPct / axisMax) * 100)}%` }} />
          </span>
        </span>
      ) : null}
      <span className="v3-close__axis v3-close__axis--bars">
        <span>no cut</span>
        <span>{axisMax}% off</span>
      </span>
    </span>
  )
}

/**
 * A median is a half, so draw the half. A lone tick on a hairline is a
 * coordinate, not a reading — the second evaluator pass called it dull beside
 * the dots and the bars and it was right. Filled to the median, open past it:
 * the run of days in which half the market found its buyer.
 */
function PaceRule({
  days,
  active,
  subjectDays,
}: {
  days: number
  active: boolean
  subjectDays: number | null
}) {
  const axisMax = Math.max(90, Math.ceil(Math.max(days, subjectDays ?? 0) / 30) * 30)
  const pct = Math.min(100, Math.max(0, (days / axisMax) * 100))
  const ownPct = subjectDays == null ? null : Math.min(100, (subjectDays / axisMax) * 100)
  const ticks = Array.from({ length: axisMax / 30 - 1 }, (_, i) => ((i + 1) * 30 * 100) / axisMax)
  return (
    <span className={cn('v3-close__pace', active && 'is-active')} aria-hidden="true">
      <span className="v3-close__pace-line">
        {ticks.map((t) => (
          <span key={t} className="v3-close__pace-tick" style={{ left: `${t}%` }} />
        ))}
        <span className="v3-close__pace-half" style={{ width: `${pct}%` }} />
        {ownPct != null ? (
          <span className="v3-close__pace-own" style={{ left: `${ownPct}%` }} />
        ) : null}
      </span>
      <span className="v3-close__pace-marks">
        <span
          className={cn('v3-close__pace-mark', pct > 55 && 'is-late')}
          style={pct > 55 ? { right: `${100 - pct}%` } : { left: `${pct}%` }}
        >
          half the market by {days.toLocaleString('en-US')}
        </span>
        {ownPct != null ? (
          <span
            className={cn('v3-close__pace-mark', 'v3-close__pace-mark--own', ownPct > 55 && 'is-late')}
            style={ownPct > 55 ? { right: `${100 - ownPct}%` } : { left: `${ownPct}%` }}
          >
            this home, day {subjectDays!.toLocaleString('en-US')}
          </span>
        ) : null}
      </span>
      <span className="v3-close__axis v3-close__axis--pace">
        <span>day it listed</span>
        <span>{axisMax} days later</span>
      </span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* The section                                                                 */
/* -------------------------------------------------------------------------- */

export function V3ListingClose({
  listingKey,
  addressLine,
  bookHref,
  paymentHref,
  view,
  headingLevel = 2,
  id = 'close',
  className,
}: V3ListingCloseProps) {
  const uid = useId().replace(/:/g, '')
  const [act, setAct] = useState<ActId>('watch')
  // HOVER and PIN are two different things and conflating them was a real bug:
  // with one piece of state, a mouse user hovering a mark set it and then the
  // CLICK toggled it straight back off, so clicking a figure cleared the reading
  // it had just shown. A tap has no hover to fall back on, so the pin is what
  // makes the drawing work on a phone at all.
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const readingId = hoveredId ?? pinnedId

  const reading = view?.readings.find((r) => r.id === readingId) ?? null

  return (
    <section
      id={id}
      aria-labelledby={`${uid}-heading`}
      className={cn(V3_ROOT_CLASS, 'v3-close', className)}
    >
      <div className="v3-close__head">
        <V3Eyebrow>{view ? view.eyebrow : 'What to do about this house'}</V3Eyebrow>
        <V3Heading level={headingLevel} id={`${uid}-heading`}>
          {view
            ? view.claim
            : `Three things you can do about ${addressLine || 'this home'} right now.`}
        </V3Heading>
        {view?.lede ? <p className="v3-close__lede">{view.lede}</p> : null}
      </div>

      <div className="v3-close__body">
        {view ? (
          <figure className="v3-close__reading">
            <div className="v3-close__marks">
              {view.filledDots != null ? (
                <button
                  type="button"
                  className={cn('v3-close__mark', 'v3-close__mark--field', readingId === 'share' && 'is-active')}
                  onMouseEnter={() => setHoveredId('share')}
                  onFocus={() => setHoveredId('share')}
                  onMouseLeave={() => setHoveredId(null)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => setPinnedId(pinnedId === 'share' ? null : 'share')}
                  aria-describedby={`${uid}-readout`}
                >
                  <span className="v3-close__mark-label">Cut before they sold</span>
                  <DotField filled={view.filledDots} active={readingId === 'share'} />
                  <span className="v3-close__mark-value">
                    {view.readings.find((r) => r.id === 'share')?.value}
                    <span className="v3-close__mark-of">
                      {view.readings.find((r) => r.id === 'share')?.against}
                    </span>
                  </span>
                </button>
              ) : null}

              <div className="v3-close__rails">
                {view.cutDepth != null ? (
                  <button
                    type="button"
                    className={cn('v3-close__mark', readingId === 'depth' && 'is-active')}
                    onMouseEnter={() => setHoveredId('depth')}
                    onFocus={() => setHoveredId('depth')}
                    onMouseLeave={() => setHoveredId(null)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setPinnedId(pinnedId === 'depth' ? null : 'depth')}
                    aria-describedby={`${uid}-readout`}
                  >
                    <span className="v3-close__mark-label">How deep the cut went</span>
                    <DepthRule
                      depth={view.cutDepth}
                      active={readingId === 'depth'}
                      subject={
                        view.subject?.cutDepth != null && view.subject.cutLabel
                          ? { cutDepth: view.subject.cutDepth, label: view.subject.cutLabel }
                          : null
                      }
                    />
                    <span className="v3-close__mark-value">
                      {view.readings.find((r) => r.id === 'depth')?.value}
                      <span className="v3-close__mark-of">
                        {view.readings.find((r) => r.id === 'depth')?.against}
                      </span>
                    </span>
                  </button>
                ) : null}

                {view.paceDays != null ? (
                  <button
                    type="button"
                    className={cn('v3-close__mark', readingId === 'pace' && 'is-active')}
                    onMouseEnter={() => setHoveredId('pace')}
                    onFocus={() => setHoveredId('pace')}
                    onMouseLeave={() => setHoveredId(null)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setPinnedId(pinnedId === 'pace' ? null : 'pace')}
                    aria-describedby={`${uid}-readout`}
                  >
                    <span className="v3-close__mark-label">Days to an accepted offer</span>
                    <PaceRule
                      days={view.paceDays}
                      active={readingId === 'pace'}
                      subjectDays={view.subject?.daysLive ?? null}
                    />
                    <span className="v3-close__mark-value">
                      {view.readings.find((r) => r.id === 'pace')?.value}
                      <span className="v3-close__mark-of">
                        {view.readings.find((r) => r.id === 'pace')?.against}
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <figcaption className="v3-close__readout" id={`${uid}-readout`} aria-live="polite">
              {reading ? (
                <>
                  <span className="v3-close__readout-line">{reading.sentence}</span>
                  <span className="v3-close__readout-n">
                    {reading.sampleN.toLocaleString('en-US')} closed sales · single family · 12 months
                  </span>
                </>
              ) : (
                <>
                  <span className="v3-close__readout-line">
                    {view.subject
                      ? view.subject.line
                      : 'Three readings from this city\u2019s own closed sales.'}
                  </span>
                  <span className="v3-close__readout-n">
                    Tap a drawing for the sales it counts
                  </span>
                </>
              )}
            </figcaption>

            <p className="v3-close__window">{view.windowLine}</p>
            <V3SourceDisclosure source={view.source} className="v3-close__source" />
          </figure>
        ) : null}

        <div className={cn('v3-close__acts', !view && 'is-wide')}>
          <div className="v3-close__tabs" role="tablist" aria-label="What to do about this home">
            {ACTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${a.id}`}
                aria-selected={act === a.id}
                aria-controls={`${uid}-panel-${a.id}`}
                tabIndex={act === a.id ? 0 : -1}
                className={cn('v3-close__tab', act === a.id && 'is-active')}
                onClick={() => setAct(a.id)}
                data-act={a.id}
              >
                <span className="v3-close__tab-label">{a.label}</span>
                <span className="v3-close__tab-hint">{a.hint}</span>
              </button>
            ))}
          </div>

          <div
            className="v3-close__panel"
            role="tabpanel"
            id={`${uid}-panel-${act}`}
            aria-labelledby={`${uid}-tab-${act}`}
            data-open={act}
          >
            {act === 'watch' ? (
              <WatchPanel listingKey={listingKey} addressLine={addressLine} uid={uid} />
            ) : null}
            {act === 'tour' ? <TourPanel bookHref={bookHref} addressLine={addressLine} /> : null}
            {act === 'payment' ? (
              <PaymentPanel
                listingKey={listingKey}
                addressLine={addressLine}
                paymentHref={paymentHref}
                uid={uid}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Act one — watch the price                                                   */
/* -------------------------------------------------------------------------- */

function WatchPanel({
  listingKey,
  addressLine,
  uid,
}: {
  listingKey: string
  addressLine: string
  uid: string
}) {
  const [email, setEmail] = useState('')
  // The honeypot's OWN answer, forwarded to the action. A trap whose value is
  // never read is not a trap (ci:alert-capture-disclosure, requirement 2).
  const [trap, setTrap] = useState('')
  const [state, setState] = useState<'idle' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = useCallback(() => {
    setError(null)
    start(async () => {
      const res = await submitListingPriceDropWatch({
        email,
        listingKey,
        addressLine,
        company: trap,
        sessionId:
          typeof window === 'undefined' ? undefined : window.sessionStorage?.getItem('rr_sid') ?? undefined,
      })
      if (res.ok) setState('done')
      else setError(res.error)
    })
  }, [email, listingKey, addressLine, trap])

  if (state === 'done') {
    return (
      <div className="v3-close__done">
        <p className="v3-close__done-line">
          We are watching the price on {addressLine || 'this home'}.
        </p>
        <p className="v3-close__note">
          One email per price change on this home, and nothing else. Unsubscribe any time from any
          of them.
        </p>
      </div>
    )
  }

  return (
    <form
      className="v3-close__form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <p className="v3-close__panel-lede">
        Sellers move on price more often than they move on anything else. Leave your email and we
        will tell you the day this one changes.
      </p>
      <div className="v3-close__field">
        <label htmlFor={`${uid}-watch-email`}>Your email</label>
        <input
          id={`${uid}-watch-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="v3-close__submit" disabled={pending}>
          {pending ? 'Setting it up…' : 'Watch this price'}
        </button>
      </div>
      <div className="v3-close__trap" aria-hidden="true">
        <label htmlFor={`${uid}-watch-company`}>Company</label>
        <input
          id={`${uid}-watch-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>
      {error ? (
        <p className="v3-close__error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="v3-close__note">
        One email per price change on this home. Nothing else, and you can unsubscribe any time.
      </p>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Act two — walk through it                                                   */
/* -------------------------------------------------------------------------- */

/**
 * No broker is named here on purpose. The sidebar card on this page lets a
 * visitor pick any of the three brokers, and the listing courtesy line names
 * whoever actually holds the listing, so a sentence promising "Matt will meet
 * you" was a claim the rest of the page contradicted — the evaluator read it
 * straight off the shots. /book names the broker whose calendar it is showing.
 */
function TourPanel({ bookHref, addressLine }: { bookHref: string; addressLine: string }) {
  return (
    <div className="v3-close__tour">
      <p className="v3-close__panel-lede">
        The next screen is a broker&rsquo;s real calendar. Pick a time on it and the meeting is
        booked — not a form that reaches somebody on Monday. {addressLine ? `${addressLine} comes with it, ` : 'The home comes with it, '}
        so nobody has to ask you which house you meant.
      </p>
      <a className="v3-close__submit v3-close__submit--link" href={bookHref}>
        See open times
      </a>
      <p className="v3-close__note">
        The times you see are the times that broker actually has open, in Pacific time.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Act three — email me this payment                                           */
/* -------------------------------------------------------------------------- */

function PaymentPanel({
  listingKey,
  addressLine,
  paymentHref,
  uid,
}: {
  listingKey: string
  addressLine: string
  paymentHref: string
  uid: string
}) {
  const snapshot = useSyncExternalStore(subscribePayment, readPayment, readPaymentServer)
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('')
  const [state, setState] = useState<'idle' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const mine = snapshot && snapshot.listingKey === listingKey ? snapshot : null

  const submit = useCallback(() => {
    if (!mine) return
    setError(null)
    start(async () => {
      const res = await submitListingPaymentEmail({
        email,
        listingKey,
        company: trap,
        inputs: {
          price: mine.price,
          downPct: mine.downPct,
          ratePct: mine.ratePct,
          termYears: mine.termYears,
          insuranceAnnual: mine.insuranceAnnual,
        },
      })
      if (res.ok) setState('done')
      else setError(res.error)
    })
  }, [email, listingKey, trap, mine])

  if (!mine) {
    return (
      <div className="v3-close__tour">
        <p className="v3-close__panel-lede">
          Set the down payment, the rate and the term the way you would actually buy it, and we will
          send you that payment.
        </p>
        <a className="v3-close__submit v3-close__submit--link" href={paymentHref}>
          Open the payment calculator
        </a>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="v3-close__done">
        <p className="v3-close__done-line">
          Sent. Check your inbox for the payment on {addressLine || 'this home'}.
        </p>
        <p className="v3-close__note">
          One email, this once. It is an estimate, not a quote — a lender writes the real one.
        </p>
      </div>
    )
  }

  return (
    <form
      className="v3-close__form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <p className="v3-close__panel-lede">
        <span className="v3-close__payment-figure">{formatPriceExact(Math.round(mine.total))}</span>
        <span className="v3-close__payment-unit"> per month</span>
        <span className="v3-close__payment-terms">
          {' '}
          at {mine.downPct}% down, {mine.ratePct}% over {mine.termYears} years, from the payment
          calculator above.
        </span>
      </p>
      <div className="v3-close__field">
        <label htmlFor={`${uid}-pay-email`}>Your email</label>
        <input
          id={`${uid}-pay-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="v3-close__submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send it to me'}
        </button>
      </div>
      <div className="v3-close__trap" aria-hidden="true">
        <label htmlFor={`${uid}-pay-company`}>Company</label>
        <input
          id={`${uid}-pay-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>
      {error ? (
        <p className="v3-close__error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="v3-close__note">
        One email, this once. We recompute the payment on our side from this home&rsquo;s own tax and
        HOA before we send it.
      </p>
    </form>
  )
}
