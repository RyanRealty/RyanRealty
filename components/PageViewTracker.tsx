'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { applyVisitBrokerToGtag, trackPageView } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
import {
  VISITOR_INTENT_CLEAR_FIELDS,
  clearVisitorIntent,
  recordPageVisit,
  visitorIntentDataLayerFields,
} from '@/lib/analytics/visitor-intent'
import { isPrivatePath } from '@/lib/analytics/private-paths'
import { ga4SafePagePath, stripGa4UrlParams } from '@/app/api/visitors/track/strip-identity'
import { noteGa4PageLocationSet, refreshGa4PageLocation, setGa4PageLocation } from '@/lib/analytics/ga4-browser-events'

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
 * (hasAnalyticsConsent) and forgotten without it: the stored key is removed and
 * both dataLayer keys are set to undefined, so GTM stops sending the values this
 * page pushed earlier. The same happens the moment the banner turns analytics off.
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  // Only to keep GA4's page_location current on a query-only change (below).
  const search = useSearchParams()?.toString() ?? ''
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

  // Analytics turned off in the banner mid-page: forget now, not at the next navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onConsent = () => {
      try {
        if (hasAnalyticsConsent()) return
        clearVisitorIntent()
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({ ...VISITOR_INTENT_CLEAR_FIELDS })
      } catch {
        /* tracking never breaks a page */
      }
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

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
    // GA4-safe (strip-identity.ts): no contact id, no `?address=` or
    // `?inquiry=` a person typed, `/cma/[document]` for a CMA. Matt 2026-10-14.
    const location = stripGa4UrlParams(window.location.href)
    // First paint: the bootstrap already pushed this page's page_view and set
    // the safe page_location for every hit.
    if (first) noteGa4PageLocationSet(window.location.href)
    else {
      // Every later hit on this page (other tags, the Google tag's own events)
      // carries the safe address and referrer, not the browser's.
      setGa4PageLocation(window.location.href, lastLocationRef.current)
      trackPageView(pageType, {
        page_location: location,
        page_path: ga4SafePagePath(pathname),
        page_title: document.title,
        page_referrer: lastLocationRef.current,
      })
      if (hasMarketingConsent()) trackMeta()
    }
    lastLocationRef.current = location
  }, [pathname, pageType, privatePage])

  // A query-only change is not a page view, but the hits after it (the Google
  // tag's own scroll, form_start, user_engagement) should name the address the
  // visitor is on, GA4-safe. Runs after the effect above, so a pathname change
  // is set there first and this finds nothing new.
  useEffect(() => {
    if (privatePage) return
    refreshGa4PageLocation()
  }, [search, privatePage])

  return null
}

/**
 * Record this page in the visitor-intent memory and return the flat keys to push
 * with the page context. Without analytics consent nothing is recorded, the
 * stored memory is forgotten, and both keys go out as undefined (clearing any
 * value GTM holds from earlier on this page). Never throws: tracking must not
 * break a page.
 */
function visitorIntentForPage(pathname: string | null): Partial<Record<'visitor_intent' | 'primary_market', string | undefined>> {
  try {
    if (!hasAnalyticsConsent()) {
      clearVisitorIntent()
      return { ...VISITOR_INTENT_CLEAR_FIELDS }
    }
    return visitorIntentDataLayerFields(recordPageVisit(pathname || '/', { consent: true }))
  } catch {
    return {}
  }
}
