'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
import { currentConsentLevel, firstPartyEventContext } from '@/components/VisitTracker'

export type V3SectionTrackerProps = Record<string, never>

/** GA4 `surface` on this tracker's section_view: the public page-section observer. */
export const SECTION_SURFACE = 'page_section'

/**
 * V3 section + scroll tracking. An island, not a seventh pattern: chrome
 * surrounds a page, this records it. Observes every `.v3 section[id]` and
 * fires a `section_view` the first time each crosses 55% visibility, plus
 * 25/50/75/100% scroll-depth milestones. Dual-sinks to GA4/Pixel (trackEvent)
 * AND our internal /api/visitors/track with full `location.href`, the second
 * only for a visitor at the analytics or all tier (the store keeps a section id
 * or a depth for no one else). Tracking must never break the page.
 *
 * page_type comes from the shared URL map. Do not pass a per-page type.
 */
export function V3SectionTracker(_props?: V3SectionTrackerProps) {
  const pathname = usePathname()
  const pageType = pageTypeFromPath(pathname || '/')

  useEffect(() => {
    /** Best-effort dual-sink to our internal store. Lives inside the effect so
     *  hydration-safety does not see the session helpers in the render body. */
    function internalTrack(eventType: 'section_view' | 'scroll_depth', extra?: Record<string, unknown>) {
      try {
        // Only the tiers that may keep a section id or a scroll depth. At
        // essential (no banner answer yet) the track route strips the event
        // metadata and the depth, so a section_view or scroll_depth row would be an
        // event with nothing in it: one write per section plus up to four scroll
        // milestones, every page view. A decline records nothing at all. The tier
        // is read BEFORE the session is advanced, so a visitor who posts nothing
        // also leaves no session id or visit behind.
        const level = currentConsentLevel() // hydration-safe: event/effect storage only
        if (level !== 'all' && level !== 'analytics') return
        // The SAME context every first-party event carries (VisitTracker owns it):
        // the session with the session rule applied, the consent tier, the arrival
        // attribution, and the browser's automation and GPC signals (this event can
        // be the one that creates the session, and the track route flags a session
        // as automation only from that one). This body used to carry a session id and nothing
        // else, so the endpoint, which refuses an event with no consent level,
        // dropped every section_view and scroll_depth this tracker ever sent
        // (found 2026-09-29).
        const ctx = firstPartyEventContext() // hydration-safe: event/effect storage only
        if (!ctx) return
        // The /api/visitors/track endpoint REQUIRES a full http(s) URL (it 400s a bare
        // path and uses new URL(pageUrl).hostname for source-domain attribution). Send
        // location.href, matching VisitTracker — a bare pathname silently dropped every
        // section_view + scroll_depth event site-wide (0 recorded; found in audit).
        const body = JSON.stringify({ ...ctx, eventType, pageUrl: location.href, ...extra })
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
            // surface names the emitter, as every other surface-tagged event
            // does. section_view sent none before 2026-10-09, so GA4's surface
            // column was empty on every one (verify report, 2026-10-09).
            trackEvent('section_view', { section: id, page_type: pageType, surface: SECTION_SURFACE })
            // The track route reads `metadata`; a top-level `section` field is ignored.
            internalTrack('section_view', { metadata: { section: id } })
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
          // The depth rides in `metadata`, not `scrollDepthPct`, on purpose: the
          // track route reads scrollDepthPct into visitor_events.scroll_depth_pct,
          // and visitor_score_delta_for_event scores a scroll_depth at 75 or more
          // as +5 engagement (two milestones, 75 and 100, per page). Turning that
          // on for every public page moves the hot-lead count, which is a scoring
          // decision, not a tracking fix.
          internalTrack('scroll_depth', { metadata: { percent: m } })
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
