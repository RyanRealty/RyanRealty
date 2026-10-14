'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { gpcFromNavigator } from '@/lib/identity/consent'
import { IS_NON_PRODUCTION_BUILD } from '@/lib/analytics/non-production-build'
import { readVisitorIntentMemory } from '@/lib/analytics/visitor-intent'
import {
  CLARITY_PROJECT_ID,
  clarityConsent,
  decideClarity,
  haltClarity,
  isConsentReason,
  startClarity,
  withdrawClarity,
  type ClarityPageContext,
  type ClarityWindow,
} from '@/lib/analytics/clarity'

/**
 * Microsoft Clarity session recordings and heatmaps (Matt 2026-10-14). The rule,
 * the consent handling and the values sent live in lib/analytics/clarity.ts; this
 * component only reads the browser and applies the decision.
 *
 * Mounted once, beside PageViewTracker in AnalyticsScripts (not on /admin). It
 * decides again on every address change, on every banner answer
 * (`cookie-consent`), and when it unmounts (a walk into /admin halts it). Off
 * while CLARITY_PROJECT_ID is null: the decision is "no-project-id" and nothing
 * loads.
 *
 * useSearchParams is read so a change to the query re-decides: a `?_pid=`
 * arrival is not recorded until PersonIdentityBridge strips the person token
 * from the address bar (Clarity sends the full address).
 */
export default function ClarityRecorder() {
  const pathname = usePathname()
  const query = useSearchParams()?.toString() ?? ''

  useEffect(() => {
    syncClarity()
  }, [pathname, query])

  useEffect(() => {
    const onConsent = () => syncClarity()
    window.addEventListener('cookie-consent', onConsent)
    return () => {
      window.removeEventListener('cookie-consent', onConsent)
      haltClarity()
    }
  }, [])

  return null
}

function pageContext(): ClarityPageContext {
  const memory = readVisitorIntentMemory()
  return {
    pathname: window.location.pathname,
    visitorIntent: memory.intent,
    primaryMarket: memory.primaryMarket,
  }
}

/** Read the browser, decide, then load, keep, halt or withdraw. Never throws. */
export function syncClarity(): void {
  // Off until Matt sends the project id: nothing is read, written or loaded.
  if (!CLARITY_PROJECT_ID) return
  try {
    const gpc = gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)
    const analytics = hasAnalyticsConsent()
    const decision = decideClarity({
      projectId: CLARITY_PROJECT_ID,
      nonProductionBuild: IS_NON_PRODUCTION_BUILD,
      pathname: window.location.pathname,
      host: window.location.hostname,
      search: window.location.search,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      cookieHeader: document.cookie,
      gpc,
      analyticsConsent: analytics,
    })
    if (decision.load && CLARITY_PROJECT_ID) {
      startClarity(window as unknown as ClarityWindow, {
        projectId: CLARITY_PROJECT_ID,
        consent: clarityConsent({ analytics: true, marketing: hasMarketingConsent() }),
        pageContext,
      })
      return
    }
    // A missing consent is a withdrawal whatever else blocks the page, so the
    // cookies go even when the visitor answers the banner on /account.
    if (gpc || !analytics || isConsentReason(decision.reason)) {
      withdrawClarity(document, window.location.hostname)
      return
    }
    haltClarity()
  } catch {
    /* recording never breaks a page */
  }
}
