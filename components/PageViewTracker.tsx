'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { applyVisitBrokerToGtag, trackPageView } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
import { clearVisitorIntent, recordPageVisit, visitorIntentDataLayerFields } from '@/lib/analytics/visitor-intent'
import { isPrivatePath } from '@/lib/analytics/private-paths'
import { stripGa4UrlParams } from '@/app/api/visitors/track/strip-identity'

/**
 * Layout-owned page analytics, and the sender of every client-side page_view.
 *
 * Since GTM version 9 (2026-10-14) page_view has ONE owner: the dataLayer. The
 * inline GTM bootstrap pushes the first-paint page_view (lib/analytics/gtm-bootstrap.ts)
 * and this component pushes one per PATHNAME change after that; GTM's
 * "GA4 - page_view" tag sends both. The Google tag sends none of its own, and
 * enhanced measurement's "page changes based on browser history events" is off.
 *
 * WHY. Enhanced measurement counted every history change. The search map
 * rewrites `?bbox=` on every pan and zoom, the gallery writes `?photo=N` per
 * slide, and identity bridges strip query params, so one page read as several
 * page_views (live test 2026-10-14: a map zoom sent a second page_view). And its
 * page_view carried no page_type. A query-only change is not a new page here.
 *
 * No consent check on the push: like every trackEvent push, this only writes the
 * dataLayer. GTM's Consent Mode decides what reaches Google (cookieless when
 * denied), the same rule the Google tag's own page_view followed.
 *
 * VISITOR INTENT (Matt 2026-10-14). Each counted page is also recorded in the
 * browser's visitor-intent memory (lib/analytics/visitor-intent.ts), and the
 * label and market ride in the SAME push as page_type, before the page_view, so
 * GTM's Data Layer Variables hold them when "GA4 - page_view" fires and send
 * them as the user properties visitor_intent / primary_market (GTM version 10).
 * That memory is storage, so it is written only with analytics consent
 * (hasAnalyticsConsent) and forgotten without it.
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const firstLoadRef = useRef(true)
  const lastPathRef = useRef<string | null>(null)
  const lastLocationRef = useRef<string | undefined>(undefined)

  const pageType = pageTypeFromPath(pathname || '/')
  // A page whose address carries a secret is never tracked (private-paths.ts).
  const privatePage = isPrivatePath(pathname)

  function stampPageType() {
    if (typeof window === 'undefined') return
    const broker = applyVisitBrokerToGtag()
    const intent = visitorIntentForPage(pathname)
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      page_type: pageType,
      ...(broker ? { broker_slug: broker.broker_slug, assigned_broker: broker.assigned_broker } : {}),
      ...intent,
    })
  }

  function trackMeta() {
    if (typeof window === 'undefined' || !window.fbq) return
    try {
      window.fbq('track', 'PageView')
    } catch (err) {
      console.warn('[PageViewTracker] fbq failed:', err)
    }
  }

  useEffect(() => {
    if (privatePage) {
      // Remember it, so coming back to the page before it counts as a new view.
      lastPathRef.current = pathname
      return
    }
    if (lastPathRef.current === pathname) return
    const first = firstLoadRef.current
    firstLoadRef.current = false
    lastPathRef.current = pathname
    stampPageType()
    const location = stripGa4UrlParams(window.location.href)
    // First paint: the bootstrap already pushed this page's page_view.
    if (!first) {
      trackPageView(pageType, {
        page_location: location,
        page_path: pathname,
        page_title: document.title,
        page_referrer: lastLocationRef.current,
      })
      if (hasMarketingConsent()) trackMeta()
    }
    lastLocationRef.current = location
  }, [pathname, pageType, privatePage])

  return null
}

/**
 * Record this page in the visitor-intent memory and return the flat keys to push
 * with the page context. Without analytics consent nothing is recorded, the
 * stored memory is forgotten, and no key is pushed. Never throws: tracking must
 * not break a page.
 */
function visitorIntentForPage(pathname: string | null): ReturnType<typeof visitorIntentDataLayerFields> {
  try {
    if (!hasAnalyticsConsent()) {
      clearVisitorIntent()
      return {}
    }
    return visitorIntentDataLayerFields(recordPageVisit(pathname || '/', { consent: true }))
  } catch {
    return {}
  }
}
