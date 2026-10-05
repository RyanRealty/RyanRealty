'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
import { IS_NON_PRODUCTION_BUILD } from '@/lib/analytics/non-production-build'
import { gtmBootstrapScript } from '@/lib/analytics/gtm-bootstrap'
import { isPrivatePath } from '@/lib/analytics/private-paths'
import { decideGaSuppression } from '@/lib/analytics/ga-suppression'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()
// The GA4 property the GTM Google tag sends to (GTM-WV6R4NZ5 -> G-ST40W4WM6T).
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || 'G-ST40W4WM6T'

/**
 * GTM container with **Consent Mode v2** (ci:tracking-policy).
 *
 * 2026-08-18 → 2026-09-01: this component suppressed gtm.js entirely until the
 * visitor accepted the banner. Because the GA4 configuration tag lives INSIDE
 * this container (GoogleAnalytics.tsx deliberately skips its own GA4 config
 * when GTM is present), that one gate made every non-consenting visitor —
 * most traffic, including tracked-email clickers — invisible to GA4, and took
 * source/referrer attribution with it (found 2026-09-01 after Matt reported
 * the drop). The tracking policy requires a consent CHECK, not suppression:
 * GoogleAnalytics.tsx has always implemented the sanctioned pattern, and this
 * file now matches it —
 *
 *   1. Push Consent Mode v2 defaults of `denied` (with wait_for_update) onto
 *      dataLayer BEFORE gtm.js, so every tag in the container starts denied.
 *   2. Always load gtm.js on a production build. Google models cookieless
 *      traffic from the denied state; nothing stores cookies pre-consent.
 *   3. Apply `consent update` from the stored banner state on mount and on
 *      every cookie-consent event (same listener contract as
 *      GoogleAnalytics.tsx — duplicate updates are idempotent).
 *
 * Pushes page_type onto dataLayer before gtm.js so the Google tag can stamp
 * every hit. Also queues assigned_broker (USER) from ?agent= / cookie so the
 * first-paint page_view is not broker-blind. First-paint page_view stays on
 * the GTM Google tag (All Pages). PageViewTracker stamps page_type + broker
 * and sends SPA page_view.
 */
export default function GTMHead() {
  const pathname = usePathname()
  const pageType = pageTypeFromPath(pathname || '/')

  useEffect(() => {
    function applyConsent() {
      const w = window as Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
      const analytics = hasAnalyticsConsent()
      const marketing = hasMarketingConsent()
      const gtag =
        typeof w.gtag === 'function'
          ? w.gtag
          : function gtagShim(...args: unknown[]) {
              ;(w.dataLayer = w.dataLayer || []).push(args)
            }
      gtag('consent', 'update', {
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        analytics_storage: analytics ? 'granted' : 'denied',
      })
    }
    applyConsent()
    window.addEventListener('cookie-consent', applyConsent)
    return () => window.removeEventListener('cookie-consent', applyConsent)
  }, [])

  // The suppression decision again on every client-side navigation (Matt
  // 2026-10-05). gtm.js is decided once per page load by the inline bootstrap;
  // a visitor whose page loaded it and who then navigates into /admin (or signs
  // in, which sets rr_internal) would otherwise send that history-change
  // page_view. `ga-disable-<id>` is Google's own per-property off switch, honored
  // by every later hit of the Google tag.
  useEffect(() => {
    const decision = decideGaSuppression({
      pathname: window.location.pathname,
      host: window.location.hostname,
      search: window.location.search,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      cookieHeader: document.cookie,
    })
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA4_ID}`] = decision.suppress
  }, [pathname])

  // GTM ships its own GA4 configuration tag, so it leaks page views into the
  // production property from a dev server just as gtag does.
  if (IS_NON_PRODUCTION_BUILD) return null
  if (!GTM_ID) return null
  // A signing link's address is its key: no tag ever sees it (private-paths.ts).
  if (isPrivatePath(pathname)) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: gtmBootstrapScript(pageType, GTM_ID), // hydration-safe: the Date call lives inside the inline script string and runs in the browser, not during render
      }}
    />
  )
}
