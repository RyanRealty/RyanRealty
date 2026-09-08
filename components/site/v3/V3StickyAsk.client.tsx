'use client'
/**
 * V3StickyAsk — the ask that comes back after the page has taken the visitor
 * past the one it started with. Desktop: a plate in the bottom-left corner.
 * Phone: the one bottom bar. (SITE-05, node 547c080a.)
 *
 * WHY IT IS ALLOWED TO EXIST AT ALL. The chrome carries a secondary "Value my
 * home" and the page body carries the primary ask; PUBLIC_UI §1 counts VISIBLE
 * filled controls, so a control fixed to the viewport is a THIRD ask and would
 * break that rule outright. It does not, because of the second clause of
 * stickyAskShown(): it appears only after the ask it points at has left the
 * screen, and it RETIRES the moment that ask is back in view. At every scroll
 * position there is exactly one asking control in the viewport, which is the
 * rule the chrome decision (docs/plans/PUBLIC_PRODUCT/decisions.md, 2026-08-12)
 * was actually protecting.
 *
 * WHY IT IS SHAPED LIKE THE LISTING BAR ON A PHONE. components/site/listing-
 * detail/ListingMobileContactBar.client.tsx is the site's only other bottom-
 * fixed ask, and its CSS comment says "Conversion-critical". This reuses its
 * geometry — the --v3-sticky-bar-h height, the safe-area inset, the docking
 * above a cookie bar — so the two never read as two different products, and so
 * a phone visitor's thumb finds the same control in the same place on a listing
 * and on a place page. It does NOT reach into that component: the listing bar
 * is a broker bar (Tour / Call / Text) and this is a valuation ask, and they
 * never mount on the same route.
 *
 * IT IS THE ONE BOTTOM-FIXED ELEMENT ON ITS PAGE. While shown it publishes its
 * own measured height on the document root as --rr-sticky-bottom. ANY OTHER
 * STICKY ELEMENT (SITE-04's alerts strip repeat, for one) MUST dock above it —
 * `bottom: var(--rr-sticky-bottom, 0px)` — or take the top edge instead. Two
 * elements both claiming `bottom: 0` is how a phone loses its primary action
 * under a strip nobody tested against it.
 *
 * DATA. It formats nothing. `verdict` arrives as four finished strings from
 * stickyAskVerdict() (lib/sticky-ask.ts), which is the only place the months-
 * of-supply digits and the market classification are derived — G68 and the
 * barrel's own no-formatting contract both point there. With `verdict` null the
 * tail is omitted entirely; there is no fallback copy, because an invented
 * market verdict on a licensed broker's surface is the §0 failure.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { markAskSource } from '@/lib/ask-source'
import { V3_ROOT_CLASS } from './atoms'
import {
  stickyAskShown,
  stickyAskSourceLine,
  stickyAskTail,
  type StickyAskVerdict,
} from '@/lib/sticky-ask'
import './tokens.css'
import './V3StickyAsk.css'

/** The page classes this control mounts on. Named so GA4 gets a fixed set. */
export type V3StickyAskSurface = 'sell' | 'city' | 'neighborhood' | 'community'

export type V3StickyAskProps = {
  /** Where the control sends the visitor: `#get-value` on /sell, `/sell#get-value` elsewhere. */
  href: string
  /** The ask, in the visitor's words. "Value my home". */
  label: string
  /** The live place verdict, built by stickyAskVerdict(). Null ships no tail. */
  verdict?: StickyAskVerdict | null
  /** The place the verdict is about, as a person says it. "Bend", "Tetherow". */
  place: string
  surface: V3StickyAskSurface
  /** Element id that must scroll fully out of view before the control appears. */
  sentinelId: string
  /** Element id of the ask itself. While it is in view the control hides. */
  targetId?: string
  /** Field to focus after a same-page scroll. The address input, normally. */
  focusId?: string
  className?: string
}

/** Session key for the dismissal. One key: closing it once closes it everywhere. */
const DISMISS_KEY = 'rr_sticky_ask_dismissed'

/**
 * Observe one element and report a boolean. Returns a cleanup or undefined.
 * `decide` receives the entry so the caller can distinguish "above the
 * viewport" from "below it" — the difference between a hero the visitor has
 * scrolled past and one they have not reached yet.
 */
function observe(
  id: string | undefined,
  decide: (entry: IntersectionObserverEntry) => boolean,
  set: (value: boolean) => void,
): (() => void) | undefined {
  if (!id) return undefined
  const el = document.getElementById(id)
  if (!el) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[V3StickyAsk] no element #${id} — the control stays hidden.`)
    }
    return undefined
  }
  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry) set(decide(entry))
    },
    { threshold: 0 },
  )
  io.observe(el)
  return () => io.disconnect()
}

export function V3StickyAsk({
  href,
  label,
  verdict = null,
  place,
  surface,
  sentinelId,
  targetId,
  focusId,
  className,
}: V3StickyAskProps) {
  // SSR and the first client render agree on false, so nothing flashes and
  // nothing mismatches. Every source of truth below arrives in an effect.
  const [passedSentinel, setPassedSentinel] = useState(false)
  const [targetVisible, setTargetVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const frame = useRef<HTMLDivElement | null>(null)

  const shown = stickyAskShown({ passedSentinel, targetVisible, dismissed })
  const tail = useMemo(() => stickyAskTail(place, verdict), [place, verdict])
  const trace = useMemo(() => stickyAskSourceLine(verdict), [verdict])

  // The visitor's own decision wins over every scroll rule.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
    } catch {
      /* storage blocked — the control simply cannot be remembered as dismissed */
    }
  }, [])

  // Past the sentinel = its bottom edge is above the viewport. Not merely
  // "not intersecting": at first paint every element below the fold is also
  // not intersecting, and treating that as "passed" would show the control
  // on a page the visitor has not scrolled.
  useEffect(
    () =>
      observe(
        sentinelId,
        (entry) => !entry.isIntersecting && entry.boundingClientRect.bottom <= 0,
        setPassedSentinel,
      ),
    [sentinelId],
  )

  useEffect(
    () => observe(targetId, (entry) => entry.isIntersecting, setTargetVisible),
    [targetId],
  )

  // Publish the occupied height for anything else that wants the bottom edge.
  // Measured, not assumed: the bar is two lines on a phone and one on a wide
  // window, and a hardcoded height would be wrong on one of them.
  useEffect(() => {
    const root = document.documentElement
    if (!shown) {
      root.style.removeProperty('--rr-sticky-bottom')
      return
    }
    const publish = () => {
      const height = frame.current?.getBoundingClientRect().height ?? 0
      root.style.setProperty('--rr-sticky-bottom', `${Math.round(height)}px`)
    }
    publish()
    window.addEventListener('resize', publish)
    return () => {
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--rr-sticky-bottom')
    }
  }, [shown])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1') // hydration-safe: click handler, never render
    } catch {
      /* not remembered across pages — it still closes here */
    }
  }, [])

  const go = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      trackEvent('click_cta', { cta: 'sticky_ask', surface, place, href }) // hydration-safe: click handler
      markAskSource('sticky') // hydration-safe: click handler, never render

      // A cross-page href is an ordinary navigation; only the same-page anchor
      // needs handling, and it needs it because the browser's instant jump
      // loses the visitor's place and never focuses the field they came for.
      if (!href.startsWith('#')) return
      const section = document.getElementById(href.slice(1))
      if (!section) return
      event.preventDefault()
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      // preventScroll: the smooth scroll above owns the movement; a focus that
      // scrolls too lands the page in two places at once.
      if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true })
    },
    [href, focusId, place, surface],
  )

  return (
    <div
      ref={frame}
      className={cn(V3_ROOT_CLASS, 'v3-sticky-ask', className)}
      data-shown={shown ? 'true' : 'false'}
      data-surface={surface}
    >
      <Link
        href={href}
        className="v3-sticky-ask__go"
        onClick={go}
        // The control's whole reading, in one string, so a screen reader gets
        // the ask, the verdict AND its §0 trace instead of four separated
        // fragments and a middot. aria-label supersedes the spans below.
        aria-label={[label, tail, trace].filter(Boolean).join(' — ')}
        // Fixed elements sit in the viewport for the whole scroll, so an
        // auto-prefetch would pull /sell for every visitor who scrolls past a
        // hero. The click still navigates client-side.
        prefetch={false}
      >
        <span className="v3-sticky-ask__label">{label}</span>
        {verdict ? (
          // The parts are spans, not one string, so the narrowest phone can
          // drop the place name — which the place's own page already said —
          // rather than ellipsing the verdict the control exists to carry.
          <span className="v3-sticky-ask__tail" title={trace ?? undefined}>
            <span className="v3-sticky-ask__place">{place}</span>
            <span>{verdict.label}</span>
            <span className="v3-sticky-ask__mos">{verdict.monthsOfSupply} months</span>
            <span className="v3-sticky-ask__read">as of {verdict.readAt}</span>
          </span>
        ) : null}
        <span className="v3-sticky-ask__arrow" aria-hidden="true">
          &#8594;
        </span>
      </Link>
      <button
        type="button"
        className="v3-sticky-ask__dismiss"
        onClick={dismiss}
        aria-label={`Hide the ${label.toLowerCase()} bar`}
      >
        <span aria-hidden="true">&#215;</span>
      </button>
    </div>
  )
}
