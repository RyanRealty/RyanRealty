/**
 * useEngagementTracking — Experience System engagement telemetry hook
 *
 * Fires GA4 events via the existing lib/tracking.ts pattern. No PII.
 * Respects the existing consent gating (the trackEvent fn already guards
 * on typeof window === 'undefined').
 *
 * Usage (in each section of a Geo/Listing/Content archetype page):
 *   const ref = useRef<HTMLDivElement>(null)
 *   useEngagementTracking('listings-mosaic', { ref, pageType: 'geo', position: 2 })
 *   return <section ref={ref}>...</section>
 *
 * Events fired:
 *   section_view       — once, when 55%+ of the section enters viewport
 *   scroll_depth       — at 25 / 50 / 75 / 100 of page scroll, first-party store only
 *                        (GA4 gets V3SectionTracker's; page-level, once per quartile)
 *   dwell              — at 15s / 45s / 120s since mount (page-level, once per threshold)
 *   exit_intent        — mouseleave toward top (desktop) or visibility-hidden (mobile)
 *   module_interact    — call the returned `trackInteract(action)` fn from click handlers
 */
'use client'

import { useEffect, useRef, useCallback, RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/tracking'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import { pageTypeFromPath } from '@/lib/analytics/page-type'

type Options = {
  /** A ref to the DOM element to observe. If not provided, only page-level events fire. */
  ref?: RefObject<HTMLElement | null>
  /** Used as the page_type dimension on all events. */
  pageType?: string
  /** Visual position of this section on the page (0-indexed). */
  position?: number
}

type ReturnValue = {
  /** Call this from interactive element click/change handlers inside the section. */
  trackInteract: (action: string) => void
}

/**
 * Page-level listeners: scroll depth, dwell and exit intent, installed ONCE per
 * page however many sections use the hook, and removed when the last of them
 * unmounts. Before 2026-10-14 they were module-level and never removed, so
 * after a visitor left /subdivisions client-side they kept firing on every later
 * page, stamped page_type 'subdivision'.
 */
// What already fired on this page, kept across a full unmount and remount of
// the page's sections (a filter that empties and refills the list) so one page
// view never sends the same dwell or scroll milestone twice.
let firedFor: { path: string; scroll: Set<number>; dwell: Set<number> } | null = null

function firedOnThisPage() {
  const path = window.location.pathname
  if (!firedFor || firedFor.path !== path) firedFor = { path, scroll: new Set(), dwell: new Set() }
  return firedFor
}

function installPageLevel(pageType: string): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []
  const fired = firedOnThisPage()

  // Scroll depth: first-party only. GA4's scroll_depth comes from
  // V3SectionTracker, which runs on every public page; a second push here sent
  // two per quartile (2026-10-14 audit).
  const QUARTILES = [25, 50, 75, 100]
  const scrollFired = fired.scroll
  const onScroll = () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    if (docHeight <= 0) return
    const pct = Math.round((window.scrollY / docHeight) * 100)
    for (const q of QUARTILES) {
      if (pct >= q && !scrollFired.has(q)) {
        scrollFired.add(q)
        // W1.3: per-person drop-off on experience-archetype pages in the CRM.
        fireFirstPartyEvent('scroll_depth', { scrollDepthPct: q, metadata: { surface: 'experience', pageType } })
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  // Dwell at 15s / 45s / 120s on this page.
  const start = Date.now()
  for (const t of [15, 45, 120]) {
    if (fired.dwell.has(t)) continue
    timers.push(
      setTimeout(() => {
        fired.dwell.add(t)
        trackEvent('dwell', { seconds: t, page_type: pageType, elapsed: Math.round((Date.now() - start) / 1000) })
      }, t * 1000),
    )
  }

  // Exit intent, once: the mouse leaves near the top edge (desktop) or the page
  // is hidden (mobile tab switch / home button).
  const pageDepth = () =>
    Math.round((window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100)
  const removeExit = () => {
    document.removeEventListener('mouseleave', onMouseLeave)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
  const onMouseLeave = (e: MouseEvent) => {
    if (e.clientY >= 40) return
    trackEvent('exit_intent_shown', { page_type: pageType, scroll_depth: pageDepth() })
    removeExit()
  }
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden') return
    trackEvent('exit_intent_shown', { page_type: pageType, scroll_depth: pageDepth() })
    removeExit()
  }
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('scroll', onScroll)
    for (const id of timers) clearTimeout(id)
    removeExit()
  }
}

let pageLevel: { users: number; remove: () => void } | null = null

function acquirePageLevel(pageType: string): () => void {
  if (!pageLevel) pageLevel = { users: 0, remove: installPageLevel(pageType) }
  pageLevel.users += 1
  return () => {
    if (!pageLevel) return
    pageLevel.users -= 1
    if (pageLevel.users > 0) return
    pageLevel.remove()
    pageLevel = null
  }
}

export function useEngagementTracking(
  sectionId: string,
  { ref, pageType, position = 0 }: Options = {},
): ReturnValue {
  const pathname = usePathname()
  const resolvedPageType = pageType ?? pageTypeFromPath(pathname || '/')
  const firedRef = useRef(false)

  // Section-level: IntersectionObserver at 55% threshold
  useEffect(() => {
    if (!ref?.current || typeof IntersectionObserver === 'undefined') return

    const el = ref.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true
          trackEvent('section_view' as Parameters<typeof trackEvent>[0], {
            section_id: sectionId,
            page_type: resolvedPageType,
            // Same surface this hook stamps on its first-party scroll_depth.
            surface: 'experience',
            position,
          })
        }
      },
      { threshold: 0.55 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [sectionId, resolvedPageType, position, ref])

  // Page-level events: one install per page, removed when the page's last
  // section unmounts (a client-side navigation away).
  useEffect(() => {
    if (typeof window === 'undefined') return
    return acquirePageLevel(resolvedPageType)
  }, [resolvedPageType])

  const trackInteract = useCallback(
    (action: string) => {
      trackEvent('module_interact' as Parameters<typeof trackEvent>[0], {
        module: sectionId,
        action,
        page_type: resolvedPageType,
      })
    },
    [sectionId, resolvedPageType],
  )

  return { trackInteract }
}
