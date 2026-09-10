'use client'

/**
 * V3 ALERTS STRIP (site queue SITE-04, Matt 2026-09-07).
 *
 * Two mounts from one component, one capture contract.
 *
 *   (a) THE FIRST CALLOUT, directly after a place opening: the promise as a
 *       sentence whose figure is real ("148 houses came on the market in Bend
 *       in the last 30 days"), a scope line when the alert sends wider than the
 *       figure counts, one email field, one button, the standing disclosure
 *       beside them. The count arrives preformatted and only when it earns a
 *       display numeral; this file formats nothing (components/site/v3/index.ts).
 *
 *       ONE DOOR, AND IT IS THE LABELLED ONE (evaluator, 2026-09-08). The
 *       numeral used to be a link with no affordance at rest — no underline, no
 *       weight, no colour — while a ghost button under the claim went to the
 *       same place, hidden at wide windows. A door a reader cannot see is not a
 *       door, and two doors to one place is a question. So the numeral is now a
 *       FIGURE, never a control, and `href` draws exactly one door: the ghost
 *       button under the claim, at every width, labelled with the place it
 *       opens ("See the newest Bend listings"). A word beats a bare numeral as
 *       a link name, and the Broadside numeral goes back to being the spectacle.
 *   (b) THE STICKY REPEAT, a fixed strip that shows once the visitor has
 *       scrolled past the section named by `stickyAfter` (the Atlas), and
 *       hides again while the callout or the footer is on screen, for the
 *       session after a dismissal, and for good after a successful subscribe.
 *       It carries its own one line (`stickyNote`) — the scope and the cadence,
 *       at reading size — so the repeat promises nothing the callout does not.
 *       The rules are pure functions in V3AlertsStrip.logic.ts.
 *
 *       IT COSTS A PHONE ONE ROW UNTIL IT IS ASKED FOR. Measured at 375x812 the
 *       strip was 142-155px — a fifth of the fold, carrying a form nobody had
 *       asked for yet, sitting on a source trace and a ledger row. Below 48rem
 *       it now rests as ONE row (the sentence, the control, the close) and opens
 *       into the field and the disclosure on the visitor's own tap, which is
 *       what `armed` is. Nothing about the wide layout moved: the field is
 *       there from the start, and the same button submits it.
 *
 *       AND IT NEVER SITS ON CONTENT IT DID NOT PAY FOR. While the strip is
 *       eligible the page root carries bottom padding and scroll padding equal
 *       to the strip's measured height, so the last row of the page and any
 *       in-page jump clear it.
 *
 * The capture is the caller's. `onSubmit` receives the email, the honeypot's
 * own value under the trap's name, and which of the two mounts sent it, and
 * returns the action's own result. The barrel imports no action and no app
 * module; a route binds one in a small client file beside its page.
 *
 * One status for both mounts. A send in flight disables both buttons and
 * ignores a second submit, so nothing double posts. The email typed in either
 * field is the one email state, so the strip and the callout always agree.
 *
 * The honeypot follows V3Sheet's `trap`: rendered inside each form, aria-hidden,
 * out of the tab order, off-screen by CSS rather than display:none (a scripted
 * filler skips display:none), and its value is forwarded verbatim. Hardcoding
 * `company: ''` is the same as having no trap.
 */

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading, V3SourceDisclosure } from './atoms'
import { V3Icon } from './V3Icon'
import { V3Number } from './V3Number.client'
import {
  anchorPassed,
  isPlausibleEmail,
  selectAlertType,
  stickyAskClosed,
  stickyDismissKey,
  stickyEligible,
  stickyVisible,
  V3_ALERTS_STICKY_INITIAL,
  type V3AlertsStatus,
  type V3AlertsStickyState,
} from './V3AlertsStrip.logic'
import './tokens.css'
import './V3AlertsStrip.css'

export type V3AlertsPlacement = 'callout' | 'sticky'

export type V3AlertsTrap = { name: string; label: string }

export type V3AlertsResult = { ok: true } | { ok: false; error: string }

export type V3AlertsSubmit = (input: {
  email: string
  /** The trap's own value, under the caller's trap name. Empty for a person. */
  company: string
  placement: V3AlertsPlacement
}) => Promise<V3AlertsResult>

/** The strip's one line in parts, so the place name never breaks across lines. */
export type V3AlertsStickyClaim = { before: string; place: string; after: string }

export type V3AlertsListing = {
  href: string
  photoSrc: string
  /** Street address. */
  title: string
  /** Compact list price when publishable. */
  price?: string | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  /** @deprecated Prefer price + beds/baths/sqft. Kept for older callers. */
  detail?: string
}

/** beds · baths · sqft — only the values the listing actually has. */
function listingFacts(item: V3AlertsListing): string | null {
  const parts: string[] = []
  if (item.beds != null) parts.push(`${Math.round(item.beds).toLocaleString('en-US')} bd`)
  if (item.baths != null) parts.push(`${Math.round(item.baths).toLocaleString('en-US')} ba`)
  if (item.sqft != null) parts.push(`${Math.round(item.sqft).toLocaleString('en-US')} sqft`)
  if (parts.length > 0) return parts.join(' · ')
  return item.detail?.trim() || null
}

export type V3AlertsTypeOption = {
  key: string
  label: string
  count: string | null
  claim: string
  stickyClaim: V3AlertsStickyClaim
  source?: string
  listings?: readonly V3AlertsListing[]
}

export type V3AlertsStripProps = {
  /** The section id. Defaults to `alerts`; the sticky's dismissal is scoped to it. */
  id?: string
  /** The context line over the claim ("New listings · Bend"). */
  eyebrow: string
  /** The display numeral, preformatted by the caller, or null to lead with the sentence. */
  count: string | null
  /** The sentence after the figure, or the whole claim when there is no figure. */
  claim: string
  /** One line under the claim that reconciles the figure with the offer, or null. */
  scopeLine?: string | null
  /** The newest-first search for this place. Draws the section's one door, the ghost button. */
  href?: string
  /** The door's label ("See the newest Bend listings"). Required with `href`. */
  browseLabel?: string
  /** The strip's one line, in parts, after the figure. The callout's claim joined. */
  stickyClaim: V3AlertsStickyClaim
  /** The strip's one line: the scope where the alert sends wider than the count, and the cadence. */
  stickyNote?: string
  /** The standing disclosure: how often, what else, how to stop. */
  promise: string
  submitLabel: string
  emailLabel?: string
  placeholder?: string
  /** What the callout says after a successful send. */
  sent: { heading: string; body: string }
  /** The section 0 trace for the figure. Collapsed behind Source. */
  source?: string
  updatedAt?: string | number | Date | null
  /** primary when this is the fold's one ask; ghost when the opening already carries one. */
  emphasis?: 'primary' | 'ghost'
  trap?: V3AlertsTrap
  /**
   * Property-type options this place actually has. Selecting one updates the
   * 30-day count, the claim, and the recent-listings strip. Omit when the
   * place only publishes one type.
   */
  types?: readonly V3AlertsTypeOption[]
  /** Compact recent-listings strip beside the sentence, when types are omitted. */
  listings?: readonly V3AlertsListing[]
  /** The id of the section the strip appears after. Defaults to `atlas`. */
  stickyAfter?: string
  /** Accessible name for the strip region. */
  stickyLabel: string
  dismissLabel?: string
  invalidMessage?: string
  failedMessage?: string
  onSubmit: V3AlertsSubmit
  className?: string
}

const DISMISS_ICON = <V3Icon name="Xmark" size={24} />

export function V3AlertsStrip({
  id = 'alerts',
  eyebrow,
  count,
  claim,
  scopeLine,
  href,
  browseLabel,
  stickyClaim,
  stickyNote,
  promise,
  submitLabel,
  emailLabel = 'Email',
  placeholder = 'you@email.com',
  sent,
  source,
  updatedAt,
  emphasis = 'primary',
  trap,
  types,
  listings,
  stickyAfter = 'atlas',
  stickyLabel,
  dismissLabel = 'Close',
  invalidMessage = 'That address does not look complete.',
  failedMessage = 'That did not send. Check the connection and try again.',
  onSubmit,
  className,
}: V3AlertsStripProps) {
  const uid = useId()
  const headingId = `${uid}-claim`
  const [status, setStatus] = useState<V3AlertsStatus>('idle')
  const [problem, setProblem] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [bait, setBait] = useState<string>('')
  const [sticky, setSticky] = useState<V3AlertsStickyState>(V3_ALERTS_STICKY_INITIAL)
  /** The visitor opened the strip's ask. Only the narrow layout rests closed. */
  const [armed, setArmed] = useState(false)
  const [typeKey, setTypeKey] = useState<string | null>(types?.[0]?.key ?? null)
  const selected = selectAlertType(types, typeKey)
  const shownCount = selected ? selected.count : count
  const shownClaim = selected ? selected.claim : claim
  const shownSticky = selected ? selected.stickyClaim : stickyClaim
  const shownSource = selected?.source ?? source
  const shownListings = selected?.listings ?? listings
  const sectionRef = useRef<HTMLElement | null>(null)
  const stickyRef = useRef<HTMLElement | null>(null)
  const calloutInputRef = useRef<HTMLInputElement | null>(null)
  const stickyInputRef = useRef<HTMLInputElement | null>(null)
  const inFlight = useRef(false)

  // The sticky rules: three observers and one session flag, all client-only.
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem(stickyDismissKey(id)) === '1'
    } catch {
      // Storage refused (private mode, blocked site data): the strip simply
      // shows again, which is the safe failure.
    }
    if (dismissed) setSticky((s) => ({ ...s, dismissed: true }))
    if (typeof IntersectionObserver === 'undefined') return

    const section = sectionRef.current
    const anchor = document.getElementById(stickyAfter) ?? section
    // The barrel's own footer first; any other <footer> on the page is a
    // section's, not the closing row the strip must never cover.
    const footer = document.querySelector('.v3-footer') ?? document.querySelector('footer')
    const observers: IntersectionObserver[] = []

    // "Passed" from the anchor's rect. An IntersectionObserver alone is not
    // enough: it fires only when intersection CHANGES, so a jump from below the
    // Atlas to above it (both non-intersecting, an anchor link or the Home key)
    // would leave `passed` true with the callout back on screen. The observer
    // gives the initial state and every crossing; a passive, frame-throttled
    // scroll read keeps it honest across jumps.
    const readPassed = () => {
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const intersecting = rect.bottom > 0 && rect.top < window.innerHeight
      setSticky((s) => ({ ...s, passed: anchorPassed({ isIntersecting: intersecting, boundingClientRect: rect }) }))
    }
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        readPassed()
      })
    }
    if (anchor) {
      const io = new IntersectionObserver(([entry]) => {
        if (entry) setSticky((s) => ({ ...s, passed: anchorPassed(entry) }))
      })
      io.observe(anchor)
      observers.push(io)
      window.addEventListener('scroll', onScroll, { passive: true })
    }
    if (section) {
      const io = new IntersectionObserver(([entry]) => {
        if (entry) setSticky((s) => ({ ...s, calloutVisible: entry.isIntersecting }))
      })
      io.observe(section)
      observers.push(io)
    }
    if (footer) {
      const io = new IntersectionObserver(([entry]) => {
        if (entry) setSticky((s) => ({ ...s, footerVisible: entry.isIntersecting }))
      })
      io.observe(footer)
      observers.push(io)
    }
    return () => {
      observers.forEach((io) => io.disconnect())
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [id, stickyAfter])

  const dismiss = useCallback(() => {
    setSticky((s) => ({ ...s, dismissed: true }))
    try {
      sessionStorage.setItem(stickyDismissKey(id), '1') // hydration-safe: click handler, never render
    } catch {
      // Not remembered past this render; the strip returns next load.
    }
  }, [id])

  const send = useCallback(
    async (placement: V3AlertsPlacement) => {
      if (inFlight.current) return
      const focusTarget = placement === 'sticky' ? stickyInputRef.current : calloutInputRef.current
      if (!isPlausibleEmail(email)) {
        setProblem(invalidMessage)
        setStatus('failed')
        focusTarget?.focus()
        return
      }
      inFlight.current = true
      setStatus('sending')
      setProblem('')
      try {
        const result = await onSubmit({ email: email.trim(), company: bait, placement })
        if (result.ok) {
          setStatus('sent')
          return
        }
        setProblem(result.error)
        setStatus('failed')
        focusTarget?.focus()
      } catch {
        // A thrown send is the same visitor-facing fact as a rejected one:
        // nothing was captured. Saying so beats a control that never resolves.
        setProblem(failedMessage)
        setStatus('failed')
        focusTarget?.focus()
      } finally {
        inFlight.current = false
      }
    },
    [bait, email, failedMessage, invalidMessage, onSubmit],
  )

  const onCalloutSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void send('callout')
    },
    [send],
  )

  /**
   * THE STRIP'S ONE CONTROL DOES WHAT THE STRIP IS SHOWING. Where the layout
   * rests closed (the phone) the field is not rendered to the eye or to the
   * accessibility tree, so the button's job is to open the ask and put the
   * caret in it; where the field is on screen (every wider window, and the
   * phone once opened) the same button submits it.
   *
   * The test is the field's own rendered box, not a breakpoint copied into JS:
   * a media query in two places drifts, and matchMedia at render is a hydration
   * mismatch. This runs in an event handler, after layout, and cannot disagree
   * with what the visitor is looking at.
   */
  const onStickySubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (stickyAskClosed(stickyInputRef.current)) {
        setArmed(true)
        return
      }
      void send('sticky')
    },
    [send],
  )

  // The caret follows the ask it just opened; without this the visitor taps and
  // then has to find the field that appeared under their thumb.
  useEffect(() => {
    if (!armed) return
    stickyInputRef.current?.focus()
  }, [armed])

  const reserving = stickyEligible(sticky, status)

  /**
   * THE ROOM THE STRIP OCCUPIES IS PAID FOR BY THE PAGE, not taken from it. A
   * fixed strip covers whatever the bottom of the viewport is showing; the two
   * things a reader can be robbed of are the last row before the footer and the
   * landing of an in-page jump, so the root carries bottom padding and scroll
   * padding equal to the strip's own measured height for as long as the strip
   * can return. Measured, never assumed: the strip is one row on a phone and
   * two once the visitor opens it, and a hard-coded number would be wrong in
   * both states. The page background runs under the footer, so the reserved
   * band is invisible until the strip stands in it.
   */
  useEffect(() => {
    const root = document.documentElement
    const clear = () => {
      document.body.style.removeProperty('padding-bottom')
      root.style.removeProperty('scroll-padding-bottom')
    }
    const strip = stickyRef.current
    if (!reserving || !strip) {
      clear()
      return clear
    }
    const apply = () => {
      const height = Math.round(strip.getBoundingClientRect().height)
      if (height <= 0) return
      document.body.style.paddingBottom = `${height}px`
      root.style.scrollPaddingBottom = `${height}px`
    }
    apply()
    if (typeof ResizeObserver === 'undefined') return clear
    const ro = new ResizeObserver(apply)
    ro.observe(strip)
    return () => {
      ro.disconnect()
      clear()
    }
  }, [reserving])

  const sending = status === 'sending'
  const isSent = status === 'sent'
  const invalid = status === 'failed' && problem !== ''
  const problemId = `${uid}-problem`
  const on = stickyVisible(sticky, status)
  const door = href && href.trim() ? href.trim() : null
  const noteId = `${uid}-sticky-note`

  const trapField = (formId: string) =>
    trap ? (
      <div className="v3-alerts__trap" aria-hidden="true">
        <label htmlFor={`${formId}-trap`}>{trap.label}</label>
        <input
          id={`${formId}-trap`}
          name={trap.name}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={bait}
          onChange={(e) => setBait(e.target.value)}
        />
      </div>
    ) : null

  // A figure, not a control: the one door is the labelled button under the claim.
  // SITE-84: count-up via V3Number (beui-number / rareui:animatedcounter /
  // transitions:number-pop-in). key remounts on type toggle so the wheel runs
  // again when Houses ↔ Land swaps the figure. No hyphen mark — the numeral
  // is the spectacle; the labelled browse button is the door.
  const countValue = shownCount ? Number(String(shownCount).replace(/,/g, '')) : Number.NaN
  const numeral = shownCount ? (
    <span className="v3-alerts__num">
      {Number.isFinite(countValue) ? (
        <V3Number key={shownCount} value={countValue} formatted={shownCount} className="v3-alerts__num-pop" />
      ) : (
        shownCount
      )}
    </span>
  ) : null

  return (
    <>
      <section
        id={id}
        ref={sectionRef}
        className={cn(V3_ROOT_CLASS, 'v3-alerts', shownCount && 'v3-alerts--figure', className)}
        aria-labelledby={headingId}
      >
        <div className="v3-alerts__grid">
          <div className="v3-alerts__lead">
            <V3Eyebrow>{eyebrow}</V3Eyebrow>
            <V3Heading level={2} size="field" id={headingId} className="v3-alerts__claim">
              {numeral}
              {shownCount ? ' ' : null}
              <span className="v3-alerts__claim-text">{shownClaim}</span>
            </V3Heading>
            {types && types.length > 1 ? (
              <div className="v3-alerts__types" role="group" aria-label="Property type">
                {types.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    data-type={option.key}
                    className="v3-alerts__type"
                    aria-pressed={option.key === selected?.key}
                    onClick={() => setTypeKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="v3-alerts__figure">
            {shownListings && shownListings.length > 0 ? (
              <ul className="v3-alerts__strip" aria-label="Recent listings in this place">
                {shownListings.map((item) => {
                  const facts = listingFacts(item)
                  const price = item.price?.trim() || null
                  return (
                    <li key={item.href}>
                      <a className="v3-alerts__thumb" href={item.href}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.photoSrc} alt="" width={800} height={600} />
                        <span className="v3-alerts__thumb-body">
                          {price ? <span className="v3-alerts__thumb-price">{price}</span> : null}
                          <span className="v3-alerts__thumb-name">{item.title}</span>
                          {facts ? <span className="v3-alerts__thumb-facts">{facts}</span> : null}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {scopeLine ? <p className="v3-alerts__scope">{scopeLine}</p> : null}
            {door && browseLabel ? (
              <p className="v3-alerts__browse">
                <V3Button href={door} variant="ghost">
                  {browseLabel}
                </V3Button>
              </p>
            ) : null}
            {shownSource ? <V3SourceDisclosure source={shownSource} updatedAt={updatedAt} /> : null}
          </div>

          <div className={cn('v3-alerts__ask', isSent && 'v3-alerts__ask--sent')}>
            {isSent ? (
              <div className="v3-alerts__sent" role="status">
                <p className="v3-alerts__sent-heading">{sent.heading}</p>
                <p className="v3-alerts__sent-body">{sent.body}</p>
              </div>
            ) : (
              <form className="v3-alerts__form" onSubmit={onCalloutSubmit} noValidate aria-busy={sending}>
                <p className="v3-alerts__promise">{promise}</p>
                <div className="v3-alerts__row">
                  <div className="v3-alerts__field">
                    <label htmlFor={`${uid}-email`} className="v3-alerts__label">
                      {emailLabel}
                    </label>
                    <input
                      ref={calloutInputRef}
                      id={`${uid}-email`}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      className="v3-alerts__control"
                      placeholder={placeholder}
                      value={email}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? problemId : undefined}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <V3Button type="submit" variant={emphasis} disabled={sending}>
                    {sending ? 'Setting up your alert' : submitLabel}
                  </V3Button>
                </div>
                {invalid ? (
                  <p className="v3-alerts__problem" id={problemId} role="alert">
                    {problem}
                  </p>
                ) : null}
                {trapField(`${uid}-callout`)}
              </form>
            )}
          </div>
        </div>
      </section>

      <aside
        ref={stickyRef}
        className={cn(
          V3_ROOT_CLASS,
          'v3-alerts-sticky',
          on && 'v3-alerts-sticky--on',
          armed && 'v3-alerts-sticky--armed',
        )}
        aria-label={stickyLabel}
        aria-hidden={!on}
        inert={!on}
      >
        <form className="v3-alerts-sticky__inner" onSubmit={onStickySubmit} noValidate aria-busy={sending}>
          <div className="v3-alerts-sticky__text">
            <p className="v3-alerts-sticky__line">
              {shownCount ? (
                <span className="v3-alerts-sticky__num">
                  {Number.isFinite(countValue) ? (
                    <V3Number key={`sticky-${shownCount}`} value={countValue} formatted={shownCount} />
                  ) : (
                    shownCount
                  )}
                </span>
              ) : null}
              {shownCount ? ' ' : null}
              {shownSticky.before} <span className="v3-alerts-sticky__place">{shownSticky.place}</span>{' '}
              {shownSticky.after}
            </p>
            {stickyNote ? (
              <p className="v3-alerts-sticky__note" id={noteId}>
                {stickyNote}
              </p>
            ) : null}
          </div>
          <div className="v3-alerts-sticky__controls">
            <label htmlFor={`${uid}-sticky-email`} className="v3-alerts-sticky__sr">
              {emailLabel}
            </label>
            <input
              ref={stickyInputRef}
              id={`${uid}-sticky-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              required
              className="v3-alerts-sticky__control"
              placeholder={placeholder}
              value={email}
              aria-invalid={invalid || undefined}
              aria-describedby={stickyNote ? noteId : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
            <V3Button type="submit" variant="ghost" onMedia disabled={sending}>
              {sending ? 'Setting up' : submitLabel}
            </V3Button>
          </div>
          <button type="button" className="v3-alerts-sticky__dismiss" onClick={dismiss} aria-label={dismissLabel}>
            {DISMISS_ICON}
          </button>
          {trapField(`${uid}-sticky`)}
        </form>
      </aside>
    </>
  )
}
