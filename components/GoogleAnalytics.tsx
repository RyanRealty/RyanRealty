'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { hasAnalyticsConsent } from './CookieConsentBanner'

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

/**
 * Loads Google products from env vars only after cookie consent ("Accept").
 * - GA4: set NEXT_PUBLIC_GA4_MEASUREMENT_ID (e.g. G-XXXXXXXXXX) → Analytics works.
 * - Google Ads: set NEXT_PUBLIC_GOOGLE_ADS_ID (e.g. AW-123456789) → Ads tag + optional conversions.
 * - GTM: optional, set NEXT_PUBLIC_GTM_CONTAINER_ID if you use GTM for other tags.
 * - AdSense: optional, set NEXT_PUBLIC_ADSENSE_CLIENT_ID (e.g. ca-pub-XXXXXXXXXX).
 */
export default function GoogleAnalytics() {
  const [consentGranted, setConsentGranted] = useState(false)

  useEffect(() => {
    if (hasAnalyticsConsent()) setConsentGranted(true)
  }, [])

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent()) setConsentGranted(true)
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  const hasGA4 = !!GA4_ID
  const hasGTM = !!GTM_ID
  const hasAdSense = !!ADSENSE_ID
  const hasGoogleAds = !!GOOGLE_ADS_ID

  if (!consentGranted || (!hasGA4 && !hasGTM && !hasAdSense && !hasGoogleAds)) return null

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

      {/* GTM: optional, only if you use it for other tags */}
      {hasGTM && (
        <>
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `}
          </Script>
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
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
