'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { hasAnalyticsConsent } from './CookieConsentBanner'

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

/**
 * Loads Google products from env vars only after cookie consent ("Accept").
 * - GA4: set NEXT_PUBLIC_GA4_MEASUREMENT_ID (e.g. G-XXXXXXXXXX) → Analytics works.
 * - Google Ads: set NEXT_PUBLIC_GOOGLE_ADS_ID (e.g. AW-123456789) → Ads tag + optional conversions.
 * - GTM: managed by GTMHead/GTMBody components in root layout.
 * - AdSense: optional, set NEXT_PUBLIC_ADSENSE_CLIENT_ID (e.g. ca-pub-XXXXXXXXXX).
 */
export default function GoogleAnalytics() {
  const [consentGranted, setConsentGranted] = useState(() => hasAnalyticsConsent())

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent()) setConsentGranted(true)
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  const hasGA4 = !!GA4_ID
  const hasAdSense = !!ADSENSE_ID
  const hasGoogleAds = !!GOOGLE_ADS_ID

  if (!consentGranted || (!hasGA4 && !hasAdSense && !hasGoogleAds)) return null

  const gtagScriptId = hasGA4 ? GA4_ID! : (hasGoogleAds ? GOOGLE_ADS_ID! : null)

  return (
    <>
      {/* GA4 + Google Ads: load gtag.js once, then config each ID */}
      {(hasGA4 || hasGoogleAds) && gtagScriptId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagScriptId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-gads-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${hasGA4 ? `gtag('config', '${GA4_ID!.replace(/'/g, "\\'")}');` : ''}
              ${hasGoogleAds ? `gtag('config', '${GOOGLE_ADS_ID!.replace(/'/g, "\\'")}');` : ''}
            `}
          </Script>
        </>
      )}

      {/* AdSense: optional, load when client ID is set */}
      {hasAdSense && (
        <Script
          id="adsense"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
          async
        />
      )}
    </>
  )
}
