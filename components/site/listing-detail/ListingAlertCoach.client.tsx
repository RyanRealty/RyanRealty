'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'rr-listing-alert-coach-dismissed'
const DWELL_MS = 5000
const SAFE_PAD = 'max(0.75rem, env(safe-area-inset-bottom, 0px))'

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
 * - Hide while #listing-hero-visual (hero band + MAP chip + photo strip) is
 *   still on screen — a visitor who has not scrolled past the hero yet gets a
 *   fixed bottom bar landing right on top of the MAP chip and photo strip
 *   otherwise (design-audit, mobile 390px, 2026-08-27)
 * - Only render when city is known (same gate as ListingLikeThisAlerts)
 *
 * No shadcn (ci:shadcn-burndown). Dismiss control is a raw button like
 * PriceCtaStrip / RoomRestyle (design-token ignore list).
 */
export function ListingAlertCoach({ city }: { city: string | null | undefined }) {
  const [visible, setVisible] = useState(false)

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
    let dwellElapsed = false

    // The hero band (MAP chip + photo strip live inside/right below it, see
    // ListingHero.tsx `#listing-hero-visual`): read its live position on
    // demand rather than trust a second IntersectionObserver watching a node
    // owned by a different component — that pairing proved unreliable under
    // React 18 Strict Mode's double-effect remount in dev (the observer's
    // first callback never fired before its owning effect instance got
    // cleaned up). A plain rect check on scroll has no such race.
    const heroPastViewport = (): boolean => {
      const heroVisual = document.getElementById('listing-hero-visual')
      if (!heroVisual) return true
      const rect = heroVisual.getBoundingClientRect()
      // Safe once the hero band has scrolled fully above the viewport — its
      // bottom edge at or above the top (0), not merely above the viewport's
      // OWN bottom edge (every on-screen element satisfies that trivially).
      return rect.bottom <= 0
    }

    const showIfAllowed = () => {
      if (cancelled || targetInView || !dwellElapsed) return
      if (!heroPastViewport()) return
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return
      } catch {
        /* ignore */
      }
      if (alreadyWatchingInThisBrowser()) return
      setVisible(true)
    }

    const onScrollOrResize = () => {
      if (!heroPastViewport()) {
        setVisible(false)
        return
      }
      showIfAllowed()
    }

    timer = setTimeout(() => {
      dwellElapsed = true
      showIfAllowed()
    }, DWELL_MS)

    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

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
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
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
        paddingBottom: SAFE_PAD,
      }}
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 sm:gap-3"
        style={{
          border: '2px solid var(--navy)',
          background: 'var(--cream)',
          color: 'var(--navy)',
          padding: '10px 12px',
          boxShadow: '0 -6px 20px color-mix(in srgb, var(--v3-navy) 12%, transparent)',
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
          <span style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>. Free, no account required.</span>
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
            color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)',
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
