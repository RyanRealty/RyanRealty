'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { hasAnalyticsConsent } from './CookieConsentBanner'

const FUB_PIXEL_ID = process.env.NEXT_PUBLIC_FUB_PIXEL_ID?.trim()

export default function FollowUpBossPixel() {
  const [consentGranted, setConsentGranted] = useState(() => hasAnalyticsConsent())

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent()) setConsentGranted(true)
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  if (!consentGranted || !FUB_PIXEL_ID) return null

  const safeId = FUB_PIXEL_ID.replace(/'/g, "\\'")

  return (
    <Script id="fub-pixel" strategy="afterInteractive">
      {`
        (function(w,i,d,g,e,t){
          w["WidgetTrackerObject"]=g;
          (w[g]=w[g]||function(){(w[g].q=w[g].q||[]).push(arguments);});
          (w[g].ds=1*new Date());
          e="script";
          t=d.createElement(e);
          e=d.getElementsByTagName(e)[0];
          t.async=1;
          t.src=i;
          e.parentNode.insertBefore(t,e);
        })(window,"https://widgetbe.com/agent",document,"widgetTracker");
        window.widgetTracker("create", "${safeId}");
        window.widgetTracker("send", "pageview");
      `}
    </Script>
  )
}
