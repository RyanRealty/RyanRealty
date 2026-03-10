'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { hasAnalyticsConsent } from './CookieConsentBanner'

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()

/**
 * Loads Google products from env vars only after cookie consent ("Accept").
 * - GA4: set NEXT_PUBLIC_GA4_MEASUREMENT_ID (e.g. G-XXXXXXXXXX) → Analytics works.
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

  if (!consentGranted || (!hasGA4 && !hasGTM && !hasAdSense)) return null

  return (
    <>
      {/* GA4: load gtag.js and config directly — no GTM setup needed */}
      {hasGA4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA4_ID.replace(/'/g, "\\'")}');
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
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
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
