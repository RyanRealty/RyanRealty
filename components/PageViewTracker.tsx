'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { trackPageView } from '@/lib/tracking'
import { pageTypeFromPath } from '@/lib/analytics/page-type'

/**
 * Layout-owned page analytics. First paint page_view comes from the GTM
 * Google tag (after consent). This stamps page_type onto dataLayer and
 * sends page_view on SPA navigations so client routing is not invisible.
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const firstLoadRef = useRef(true)
  const lastGaPathRef = useRef<string | null>(null)

  const query = searchParams?.toString()
  const pagePath = query ? `${pathname}?${query}` : pathname
  const pageType = pageTypeFromPath(pathname || '/')

  function stampPageType() {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ page_type: pageType })
    if (typeof window.gtag === 'function') {
      window.gtag('set', { page_type: pageType })
    }
  }

  function trackGa(path: string) {
    stampPageType()
    if (lastGaPathRef.current === path) return
    lastGaPathRef.current = path
    trackPageView(pageType, {
      page_location: typeof window !== 'undefined' ? window.location.href : path,
      page_path: path,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
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
    const first = firstLoadRef.current
    if (first) firstLoadRef.current = false
    // First paint: GTM Google tag sends page_view. We only stamp page_type
    // so that hit is classified. Later SPA navigations send the page_view.
    if (hasAnalyticsConsent()) {
      if (first) stampPageType()
      else trackGa(pagePath)
    }
    if (hasMarketingConsent() && !first) trackMeta()
  }, [pagePath, pageType])

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent()) stampPageType()
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [pagePath, pageType])

  return null
}
