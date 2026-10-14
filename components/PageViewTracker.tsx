'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { hasMarketingConsent } from './CookieConsentBanner'
import { applyVisitBrokerToGtag, trackPageView } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
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
 * No consent check: like every trackEvent push, this only writes the dataLayer.
 * GTM's Consent Mode decides what reaches Google (cookieless when denied), the
 * same rule the Google tag's own page_view followed.
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
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      page_type: pageType,
      ...(broker ? { broker_slug: broker.broker_slug, assigned_broker: broker.assigned_broker } : {}),
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
