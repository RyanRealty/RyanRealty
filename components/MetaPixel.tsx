'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { hasMarketingConsent } from './CookieConsentBanner'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

/**
 * Loads Meta Pixel when NEXT_PUBLIC_META_PIXEL_ID is set and user has accepted cookies.
 * Sends PageView on load. Other events (ViewContent, Lead, etc.) are sent from lib/tracking.ts.
 */
export default function MetaPixel() {
  const [consentGranted, setConsentGranted] = useState(false)

  useEffect(() => {
    if (hasMarketingConsent()) setConsentGranted(true)
  }, [])

  useEffect(() => {
    const onConsent = () => {
      if (hasMarketingConsent()) setConsentGranted(true)
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  if (!PIXEL_ID || !consentGranted) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          if(s&&s.parentNode)s.parentNode.insertBefore(t,s);else b.head.appendChild(t);}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID.replace(/'/g, "\\'")}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
