'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent, getOrCreateRrSessionId } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'

export type V3SectionTrackerProps = Record<string, never>

/**
 * V3 section + scroll tracking. An island, not a seventh pattern: chrome
 * surrounds a page, this records it. Observes every `.v3 section[id]` and
 * fires a `section_view` the first time each crosses 55% visibility, plus
 * 25/50/75/100% scroll-depth milestones. Dual-sinks to GA4/Pixel (trackEvent)
 * AND our internal /api/visitors/track with full `location.href`. Tracking
 * must never break the page.
 *
 * page_type comes from the shared URL map. Do not pass a per-page type.
 */
export function V3SectionTracker(_props?: V3SectionTrackerProps) {
  const pathname = usePathname()
  const pageType = pageTypeFromPath(pathname || '/')

  useEffect(() => {
    /** Best-effort dual-sink to our internal store. Lives inside the effect so
     *  hydration-safety does not see `getOrCreateRrSessionId` in the render body. */
    function internalTrack(eventType: 'section_view' | 'scroll_depth', extra?: Record<string, unknown>) {
      try {
        const sessionId = getOrCreateRrSessionId() // hydration-safe: event/effect storage only
        if (!sessionId) return
        // The /api/visitors/track endpoint REQUIRES a full http(s) URL (it 400s a bare
        // path and uses new URL(pageUrl).hostname for source-domain attribution). Send
        // location.href, matching VisitTracker — a bare pathname silently dropped every
        // section_view + scroll_depth event site-wide (0 recorded; found in audit).
        const body = JSON.stringify({ sessionId, eventType, pageUrl: location.href, ...extra })
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

    // ONE register: '.v3' is the public root (V3_ROOT_CLASS), and since
    // 2026-08-27 it is the only one: the old register's root scope went with
    // the KB register. If a second root ever appears, section_view goes dark on
    // it silently, and analytics that stops reporting looks like a page nobody
    // scrolls. ci:one-design-system is what stops a second root existing.
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.v3 section[id]'),
    )
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
