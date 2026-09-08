'use client'

/**
 * V3 ALERTS STRIP (site queue SITE-04, Matt 2026-09-07).
 *
 * Two mounts from one component, one capture contract.
 *
 *   (a) THE FIRST CALLOUT, directly after a place opening: the promise as a
 *       sentence whose figure is real ("148 houses came on the market in Bend
 *       in the last 30 days"), one email field, one button, the standing
 *       disclosure beside them. The count arrives preformatted; this file
 *       formats nothing (components/site/v3/index.ts).
 *   (b) THE STICKY REPEAT, a fixed strip that shows once the visitor has
 *       scrolled past the section named by `stickyAfter` (the Atlas), and
 *       hides again while the callout or the footer is on screen, for the
 *       session after a dismissal, and for good after a successful subscribe.
 *       The rules are pure functions in V3AlertsStrip.logic.ts.
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
import {
  anchorPassed,
  isPlausibleEmail,
  stickyDismissKey,
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

export type V3AlertsStripProps = {
  /** The section id. Defaults to `alerts`; the sticky's dismissal is scoped to it. */
  id?: string
  /** The context line over the claim ("New listings · Bend"). */
  eyebrow: string
  /** The 30-day figure, preformatted by the caller. Null renders the claim alone. */
  count: string | null
  /** The sentence after the figure, or the whole claim when there is no figure. */
  claim: string
  /** The short form for the strip's one line, after the figure. */
  stickyClaim: string
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

const DISMISS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export function V3AlertsStrip({
  id = 'alerts',
  eyebrow,
  count,
  claim,
  stickyClaim,
  promise,
  submitLabel,
  emailLabel = 'Email',
  placeholder = 'you@email.com',
  sent,
  source,
  updatedAt,
  emphasis = 'primary',
  trap,
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
  const sectionRef = useRef<HTMLElement | null>(null)
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

    if (anchor) {
      const io = new IntersectionObserver(([entry]) => {
        if (entry) setSticky((s) => ({ ...s, passed: anchorPassed(entry) }))
      })
      io.observe(anchor)
      observers.push(io)
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
    return () => observers.forEach((io) => io.disconnect())
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

  const onStickySubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void send('sticky')
    },
    [send],
  )

  const sending = status === 'sending'
  const invalid = status === 'failed' && problem !== ''
  const problemId = `${uid}-problem`
  const on = stickyVisible(sticky, status)

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

  return (
    <>
      <section
        id={id}
        ref={sectionRef}
        className={cn(V3_ROOT_CLASS, 'v3-alerts', className)}
        aria-labelledby={headingId}
      >
        <div className="v3-alerts__grid">
          <div className="v3-alerts__lead">
            <V3Eyebrow>{eyebrow}</V3Eyebrow>
            <V3Heading level={2} size="field" id={headingId} className="v3-alerts__claim">
              {count ? <span className="v3-alerts__num">{count}</span> : null}
              {count ? ' ' : null}
              <span className="v3-alerts__claim-text">{claim}</span>
            </V3Heading>
            {source ? <V3SourceDisclosure source={source} updatedAt={updatedAt} /> : null}
          </div>

          <div className="v3-alerts__ask">
            {status === 'sent' ? (
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
        className={cn(V3_ROOT_CLASS, 'v3-alerts-sticky', on && 'v3-alerts-sticky--on')}
        aria-label={stickyLabel}
        aria-hidden={!on}
        inert={!on}
      >
        <form className="v3-alerts-sticky__inner" onSubmit={onStickySubmit} noValidate aria-busy={sending}>
          <p className="v3-alerts-sticky__line">
            {count ? <span className="v3-alerts-sticky__num">{count}</span> : null}
            {count ? ' ' : null}
            {stickyClaim}
          </p>
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
