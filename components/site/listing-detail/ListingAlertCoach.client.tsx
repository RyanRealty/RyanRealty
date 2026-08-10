'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'rr-listing-alert-coach-dismissed'
const DWELL_MS = 5000
/** Matches .listing-mobile-cta height band so coach never sits under the broker bar. */
const MOBILE_BAR_LIFT = 'max(4.75rem, calc(3.75rem + env(safe-area-inset-bottom, 0px)))'
const DESKTOP_PAD = 'max(0.75rem, env(safe-area-inset-bottom, 0px))'

function alreadyWatchingInThisBrowser(): boolean {
  try {
    // F2 residual: guest already set an alert — do not coach them to set another.
    // Lazy key check avoids importing residual helpers into this small coach chunk.
    const raw = localStorage.getItem('rr_guest_alert_watch')
    return typeof raw === 'string' && raw.length > 2
  } catch {
    return false
  }
}

/**
 * F4 soft next-step coach on listing detail (E4 craft).
 *
 * After 5s dwell, show one cream bar:
 * "Next step: get alerts for homes like this" → `#listing-like-alerts`.
 *
 * Rules (no dark patterns):
 * - Never auto-open a form or trap focus
 * - Dismiss once per session (sessionStorage)
 * - Hide when the real capture strip is already in view
 * - Only render when city is known (same gate as ListingLikeThisAlerts)
 * - On small screens, sit above the listing mobile contact bar (z-stack + lift)
 *   so coach and "Schedule a tour" never become one unreadable blob
 *
 * No shadcn (ci:shadcn-burndown). Dismiss control is a raw button like
 * PriceCtaStrip / RoomRestyle (design-token ignore list).
 */
export function ListingAlertCoach({ city }: { city: string | null | undefined }) {
  const [visible, setVisible] = useState(false)
  /** true when viewport is below lg (mobile broker bar can show). */
  const [liftForMobileBar, setLiftForMobileBar] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setLiftForMobileBar(!mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!city) return
    if (typeof window === 'undefined') return

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      // private mode — still allow one-shot coach this visit
    }
    // Guest who already set an alert (F2 residual) — skip coach; return banner owns the loop.
    if (alreadyWatchingInThisBrowser()) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let observer: IntersectionObserver | null = null
    let targetInView = false

    const showIfAllowed = () => {
      if (cancelled || targetInView) return
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return
      } catch {
        /* ignore */
      }
      if (alreadyWatchingInThisBrowser()) return
      setVisible(true)
    }

    timer = setTimeout(showIfAllowed, DWELL_MS)

    const target = document.getElementById('listing-like-alerts')
    if (target && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting)
          targetInView = hit
          if (hit) setVisible(false)
        },
        { root: null, threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
      )
      observer.observe(target)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      observer?.disconnect()
    }
  }, [city])

  if (!city || !visible) return null

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Suggested next step"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 sm:px-4"
      style={{
        // Sit above .listing-mobile-cta (z-80) visually via bottom lift, not z-war.
        paddingBottom: liftForMobileBar ? MOBILE_BAR_LIFT : DESKTOP_PAD,
      }}
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 sm:gap-3"
        style={{
          border: '2px solid var(--navy)',
          background: 'var(--cream)',
          color: 'var(--navy)',
          padding: '10px 12px',
          boxShadow: '0 -6px 20px rgba(16,39,66,0.12)',
        }}
      >
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-semibold">Next step:</span>{' '}
          <a
            href="#listing-like-alerts"
            className="font-semibold underline underline-offset-2"
            style={{ color: 'var(--navy)' }}
          >
            get alerts for homes like this
          </a>
          <span style={{ color: 'rgba(16,39,66,0.72)' }}>. Free, no account required.</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 10px',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(16,39,66,0.72)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Dismiss next step suggestion"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
