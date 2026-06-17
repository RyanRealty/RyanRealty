'use client'

import { useEffect } from 'react'
import { trackEvent, readRrSessionId } from '@/lib/tracking'

/** Best-effort dual-sink to our internal store. Tracking must never break the page. */
function internalTrack(eventType: 'section_view' | 'scroll_depth', extra?: Record<string, unknown>) {
  try {
    const sessionId = readRrSessionId()
    const body = JSON.stringify({ sessionId, eventType, pageUrl: location.pathname + location.search, ...extra })
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/visitors/track', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/visitors/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* swallow */
  }
}

/**
 * KB section + scroll tracking — ONE client component per KB page (THE PAGE
 * CONTRACT: every section view is recorded). Observes every `.kb-root section[id]`
 * and fires a `section_view` the first time each crosses 55% visibility, plus
 * 25/50/75/100% scroll-depth milestones. Dual-sinks to GA4/Pixel (trackEvent) AND
 * our internal /api/visitors/track. No per-section wrapping — drop it in once next
 * to the page-level tracker. Reused on the homepage + every city/community page.
 */
export function KbSectionTracker({ pageType }: { pageType: string }) {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.kb-root section[id]'))
    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id
          if (e.isIntersecting && e.intersectionRatio >= 0.55 && !seen.has(id)) {
            seen.add(id)
            trackEvent('section_view', { section: id, page_type: pageType })
            internalTrack('section_view', { section: id })
          }
        }
      },
      { threshold: [0, 0.55, 1] },
    )
    sections.forEach((s) => io.observe(s))

    const milestones = [25, 50, 75, 100]
    const hit = new Set<number>()
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = (((window.scrollY || h.scrollTop) / max) * 100) | 0
      for (const m of milestones) {
        if (pct >= m && !hit.has(m)) {
          hit.add(m)
          trackEvent('scroll_depth', { percent: m, page_type: pageType })
          internalTrack('scroll_depth', { scrollDepth: m })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [pageType])
  return null
}
