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
 * (`cookie-consent`), and when it unmounts. Once Clarity runs, the runtime also
 * judges every history navigation BEFORE the address changes (mayRecord), so a
 * client-side walk into /account or /admin stops Clarity before clarity-js can
 * restart itself on that page. Off while CLARITY_PROJECT_ID is null: nothing is
 * read and nothing loads.
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

/**
 * The decision for an address, from what the browser holds now. Consent is
 * hasAnalyticsConsent(), which is already false under Global Privacy Control;
 * GPC is also passed on its own so the rule reads it explicitly.
 */
function decide(url: Pick<URL, 'pathname' | 'hostname' | 'search'>) {
  const gpc = gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)
  const consented = !gpc && hasAnalyticsConsent()
  const decision = decideClarity({
    projectId: CLARITY_PROJECT_ID,
    nonProductionBuild: IS_NON_PRODUCTION_BUILD,
    pathname: url.pathname,
    host: url.hostname,
    search: url.search,
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver,
    cookieHeader: document.cookie,
    gpc,
    analyticsConsent: consented,
  })
  return { decision, consented }
}

/** May Clarity follow a navigation to this address? Read before the address changes. */
function mayRecord(url: URL): boolean {
  return decide(url).decision.load
}

/** Read the browser, decide, then load, keep, halt or withdraw. Never throws. */
export function syncClarity(): void {
  // Off until Matt sends the project id: nothing is read, written or loaded.
  if (!CLARITY_PROJECT_ID) return
  try {
    const { decision, consented } = decide(window.location)
    if (decision.load) {
      startClarity(window as unknown as ClarityWindow, {
        projectId: CLARITY_PROJECT_ID,
        consent: clarityConsent({ analytics: true, marketing: hasMarketingConsent() }),
        pageContext,
        mayRecord,
      })
      return
    }
    // No consent is a withdrawal whatever else blocks the page, so the cookies
    // go even when the visitor answers the banner on /account.
    if (!consented) {
      withdrawClarity(document, window.location.hostname)
      return
    }
    haltClarity()
  } catch {
    /* recording never breaks a page */
  }
}
