'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'rr-listing-alert-coach-dismissed'
const DWELL_MS = 5000

/**
 * F4 soft next-step coach on listing detail.
 *
 * After 5s dwell, show one cream bar:
 * "Next step: get alerts for homes like this" → `#listing-like-alerts`.
 *
 * Rules (no dark patterns):
 * - Never auto-open a form or trap focus
 * - Dismiss once per session (sessionStorage)
 * - Hide when the real capture strip is already in view
 * - Only render when city is known (same gate as ListingLikeThisAlerts)
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-sm border-2 px-3 py-2.5 shadow-md sm:px-4"
        style={{ borderColor: 'var(--navy)', background: 'var(--cream)', color: 'var(--navy)' }}
      >
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-semibold">Next step:</span>{' '}
          <a
            href="#listing-like-alerts"
            className="font-semibold underline underline-offset-2"
          >
            get alerts for homes like this
          </a>
          <span className="text-muted-foreground">. Free, no account required.</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          aria-label="Dismiss next step suggestion"
        >
          Not now
        </Button>
      </div>
    </div>
  )
}
