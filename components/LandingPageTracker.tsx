'use client'

import { useEffect } from 'react'
import { trackEvent, trackLandingPageView } from '@/lib/tracking'

type Props = {
  lpVariant: string
}

/**
 * Drop into the top of every landing page (Next.js `app/lp/<variant>/page.tsx`).
 *
 * On mount AND whenever cookie-consent is granted (whichever lands first
 * after gtag.js loads), fires `view_landing_page` with UTM context captured
 * from URL, persists that context to sessionStorage so the LP's form can
 * enrich its submit event via getLpContext(), and wires scroll-depth
 * listeners that fire at 25 / 50 / 75 / 100 %.
 *
 * The fire is gated on `typeof window.gtag === 'function'` so we don't
 * silently drop the event when called before gtag.js loads. The consent
 * listener is registered UNCONDITIONALLY so a late consent grant still
 * triggers the fire — earlier versions gated this on the first call's
 * return value, which always claimed success even when gtag wasn't ready.
 *
 * The single-fire guard uses sessionStorage so it survives React 18
 * strict-mode unmount/remount, but the guard is only SET after a successful
 * gtag fire — if gtag wasn't ready, the next attempt (on consent grant or
 * the periodic check) will try again.
 *
 * Canonical contract:
 * marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md
 */
export default function LandingPageTracker({ lpVariant }: Props) {
  useEffect(() => {
    const guardKey = 'rr_lp_fired_' + lpVariant
    let scrollHandler: (() => void) | null = null
    let pollId: ReturnType<typeof setInterval> | null = null

    function attemptFire() {
      let alreadyFired = false
      try {
        alreadyFired = window.sessionStorage.getItem(guardKey) === '1'
      } catch {
        // sessionStorage unavailable — falls through, will fire each call.
      }
      if (alreadyFired) return true

      // Gate on gtag readiness — otherwise the GA4 ping silently drops.
      if (typeof window.gtag !== 'function') return false

      try {
        const ctx = trackLandingPageView(lpVariant)
        try {
          window.sessionStorage.setItem(guardKey, '1')
        } catch {
          // Best-effort — if sessionStorage is unavailable we may double-fire,
          // which GA4 deduplicates internally via gtm.uniqueEventId.
        }

        // Wire scroll-depth listener (only once per page load).
        const firedDepths = new Set<number>()
        scrollHandler = () => {
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
        window.addEventListener('scroll', scrollHandler, { passive: true })
        scrollHandler()
        return true
      } catch (err) {
        console.error('[LandingPageTracker] failed to fire view_landing_page', err)
        return false
      }
    }

    // Try immediately. If gtag isn't loaded yet OR consent isn't granted,
    // this returns false and we wait for the consent event OR poll briefly.
    const firedNow = attemptFire()

    // Always listen for consent — it's the trigger for gtag.js to load.
    const onConsent = () => {
      attemptFire()
    }
    window.addEventListener('cookie-consent', onConsent)

    // Backstop: poll for up to 30 seconds in case consent was already granted
    // before this component mounted but gtag is still loading. Stops once fired.
    if (!firedNow) {
      pollId = setInterval(() => {
        if (attemptFire()) {
          if (pollId) {
            clearInterval(pollId)
            pollId = null
          }
        }
      }, 1000)
      setTimeout(() => {
        if (pollId) {
          clearInterval(pollId)
          pollId = null
        }
      }, 30000)
    }

    return () => {
      window.removeEventListener('cookie-consent', onConsent)
      if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
      if (pollId) clearInterval(pollId)
    }
  }, [lpVariant])

  // Hidden DOM marker so the component is observable in DevTools/E2E.
  return (
    <span
      data-lp-tracker={lpVariant}
      aria-hidden="true"
      style={{ display: 'none', position: 'absolute', width: 0, height: 0 }}
    />
  )
}
