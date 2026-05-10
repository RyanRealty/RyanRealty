'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'

/**
 * Fires Meta Pixel PageView on pathname change (not on initial load, since MetaPixel.tsx already fires once).
 * Guards against firing twice on mount.
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialLoadRef = useRef(true)
  const consentPageviewSentRef = useRef(false)

  const query = searchParams?.toString()
  const pagePath = query ? `${pathname}?${query}` : pathname

  function trackGaPageView(path: string) {
    if (typeof window === 'undefined' || !window.gtag) return
    try {
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: path,
        page_title: document.title,
      })
    } catch (err) {
      console.warn('[PageViewTracker] gtag page_view failed:', err)
    }
  }

  function trackMetaPageView() {
    if (typeof window === 'undefined' || !window.fbq) return
    try {
      window.fbq('track', 'PageView')
    } catch (err) {
      console.warn('[PageViewTracker] fbq failed:', err)
    }
  }

  useEffect(() => {
    // Skip initial load (MetaPixel already fired PageView once)
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      return
    }

    if (hasAnalyticsConsent()) trackGaPageView(pagePath)
    if (hasMarketingConsent()) trackMetaPageView()
  }, [pagePath])

  useEffect(() => {
    const onConsent = () => {
      if (consentPageviewSentRef.current) return
      let sent = false
      if (hasAnalyticsConsent()) {
        trackGaPageView(pagePath)
        sent = true
      }
      if (hasMarketingConsent()) {
        trackMetaPageView()
        sent = true
      }
      if (sent) consentPageviewSentRef.current = true
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [pagePath])

  return null
}
