'use client'

import { useEffect } from 'react'
import { trackEvent, trackLandingPageView } from '@/lib/tracking'

type Props = {
  lpVariant: string
}

/**
 * Drop into the top of every landing page (Next.js `app/lp/<variant>/page.tsx`).
 * On mount it fires `view_landing_page` with UTM context captured from URL,
 * persists that context to sessionStorage so the LP's form can enrich its
 * submit event via getLpContext(), and wires scroll-depth listeners that
 * fire at the 25 / 50 / 75 / 100 % thresholds.
 *
 * The single-fire guard uses sessionStorage instead of a useRef so it
 * survives across React 18 strict-mode double-mounts AND across the
 * cookie-consent grant event (which causes gtag.js to load and may
 * trigger a re-render of consent-gated children).
 *
 * Canonical contract:
 * marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md
 */
export default function LandingPageTracker({ lpVariant }: Props) {
  useEffect(() => {
    function fireOnceConsentReady() {
      const guardKey = 'rr_lp_fired_' + lpVariant
      let alreadyFired = false
      try {
        alreadyFired = window.sessionStorage.getItem(guardKey) === '1'
      } catch {
        // sessionStorage unavailable (private browsing) — fall through; we'll just risk a second fire.
      }
      if (alreadyFired) return false
      try {
        const ctx = trackLandingPageView(lpVariant)
        try {
          window.sessionStorage.setItem(guardKey, '1')
        } catch {
          // sessionStorage may be unavailable — best-effort.
        }
        const firedDepths = new Set<number>()
        function onScroll() {
          const doc = document.documentElement
          const scrollTop = window.scrollY || doc.scrollTop || 0
          const viewport = window.innerHeight || doc.clientHeight || 0
          const scrollable = (doc.scrollHeight || 0) - viewport
          if (scrollable <= 0) return
          const depthPct = Math.min(
            100,
            Math.round(((scrollTop + viewport) / (scrollable + viewport)) * 100)
          )
          for (const threshold of [25, 50, 75, 100]) {
            if (depthPct >= threshold && !firedDepths.has(threshold)) {
              firedDepths.add(threshold)
              trackEvent('scroll_depth', {
                lp_variant: ctx.lp_variant,
                depth_percent: threshold,
                lp_source: ctx.lp_source,
                lp_campaign: ctx.lp_campaign,
              })
            }
          }
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        ;(window as unknown as { __lpTrackerCleanup?: () => void }).__lpTrackerCleanup = () => {
          window.removeEventListener('scroll', onScroll)
        }
        return true
      } catch (err) {
        // Surface errors to the console so a stuck tracker is observable in DevTools.
        console.error('[LandingPageTracker] failed to fire view_landing_page', err)
        return false
      }
    }

    // gtag is loaded after analytics consent is granted (see GoogleAnalytics.tsx).
    // If we mount before consent, our trackEvent call would drop. Listen for the
    // consent event AND attempt an immediate fire — whichever happens first wins.
    const fired = fireOnceConsentReady()
    let consentListener: (() => void) | null = null
    if (!fired) {
      consentListener = () => {
        fireOnceConsentReady()
      }
      window.addEventListener('cookie-consent', consentListener)
    }

    return () => {
      if (consentListener) window.removeEventListener('cookie-consent', consentListener)
      const cleanup = (window as unknown as { __lpTrackerCleanup?: () => void }).__lpTrackerCleanup
      if (cleanup) {
        cleanup()
        ;(window as unknown as { __lpTrackerCleanup?: () => void }).__lpTrackerCleanup = undefined
      }
    }
  }, [lpVariant])

  // Render a hidden marker so the component is observable in DevTools/E2E tests
  // even though it has no visible UI. data-attribute confirms the React mount
  // landed; absence on a live LP page = wiring bug in the parent route.
  return (
    <span
      data-lp-tracker={lpVariant}
      aria-hidden="true"
      style={{ display: 'none', position: 'absolute', width: 0, height: 0 }}
    />
  )
}
