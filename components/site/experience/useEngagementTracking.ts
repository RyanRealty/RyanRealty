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
 *   scroll_depth       — at 25 / 50 / 75 / 100 of page scroll (page-level, once per quartile)
 *   dwell              — at 15s / 45s / 120s since mount (page-level, once per threshold)
 *   exit_intent        — mouseleave toward top (desktop) or visibility-hidden (mobile)
 *   module_interact    — call the returned `trackInteract(action)` fn from click handlers
 */
'use client'

import { useEffect, useRef, useCallback, RefObject } from 'react'
import { trackEvent } from '@/lib/tracking'

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

// Page-level scroll depth tracking — installed once, shared across all hook instances
const scrollDepthFired = new Set<number>()
let scrollHandlerInstalled = false

function installScrollDepth(pageType: string) {
  if (scrollHandlerInstalled || typeof window === 'undefined') return
  scrollHandlerInstalled = true

  const QUARTILES = [25, 50, 75, 100]
  const onScroll = () => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    if (docHeight <= 0) return
    const pct = Math.round((scrollTop / docHeight) * 100)
    for (const q of QUARTILES) {
      if (pct >= q && !scrollDepthFired.has(q)) {
        scrollDepthFired.add(q)
        trackEvent('scroll_depth', { depth: q, page_type: pageType })
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true })
}

// Page-level dwell tracking — installed once
const dwellFired = new Set<number>()
let dwellHandlerInstalled = false

function installDwell(pageType: string) {
  if (dwellHandlerInstalled || typeof window === 'undefined') return
  dwellHandlerInstalled = true

  const THRESHOLDS = [15, 45, 120]
  const start = Date.now()

  for (const t of THRESHOLDS) {
    setTimeout(() => {
      if (!dwellFired.has(t)) {
        dwellFired.add(t)
        trackEvent('dwell' as Parameters<typeof trackEvent>[0], {
          seconds: t,
          page_type: pageType,
          elapsed: Math.round((Date.now() - start) / 1000),
        })
      }
    }, t * 1000)
  }
}

// Page-level exit intent — installed once
let exitHandlerInstalled = false

function installExitIntent(pageType: string) {
  if (exitHandlerInstalled || typeof window === 'undefined') return
  exitHandlerInstalled = true

  // Desktop: mouse leaves near the top edge
  const onMouseLeave = (e: MouseEvent) => {
    if (e.clientY < 40) {
      const depth = Math.round(
        (window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100,
      )
      trackEvent('exit_intent_shown', { page_type: pageType, scroll_depth: depth })
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }

  // Mobile: page hidden (tab switch / home button)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      const depth = Math.round(
        (window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100,
      )
      trackEvent('exit_intent_shown', { page_type: pageType, scroll_depth: depth })
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

export function useEngagementTracking(
  sectionId: string,
  { ref, pageType = 'page', position = 0 }: Options = {},
): ReturnValue {
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
            page_type: pageType,
            position,
          })
        }
      },
      { threshold: 0.55 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [sectionId, pageType, position, ref])

  // Page-level events — install once regardless of which section mounts first
  useEffect(() => {
    if (typeof window === 'undefined') return
    installScrollDepth(pageType)
    installDwell(pageType)
    installExitIntent(pageType)
  }, [pageType])

  const trackInteract = useCallback(
    (action: string) => {
      trackEvent('module_interact' as Parameters<typeof trackEvent>[0], {
        module: sectionId,
        action,
        page_type: pageType,
      })
    },
    [sectionId, pageType],
  )

  return { trackInteract }
}
