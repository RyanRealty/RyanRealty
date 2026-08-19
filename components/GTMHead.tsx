'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { hasAnalyticsConsent } from './CookieConsentBanner'
import { pageTypeFromPath } from '@/lib/analytics/page-type'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()

/**
 * GTM container. Loads only after analytics consent (ci:tracking-policy).
 * Pushes page_type onto dataLayer before gtm.js so the Google tag can
 * stamp every hit. First-paint page_view stays on the GTM Google tag
 * (All Pages). PageViewTracker stamps page_type and sends SPA page_view.
 */
export default function GTMHead() {
  const pathname = usePathname()
  const pageType = pageTypeFromPath(pathname || '/')
  const [consent, setConsent] = useState(false)

  useEffect(() => {
    if (hasAnalyticsConsent()) setConsent(true)
  }, [])

  useEffect(() => {
    const onConsent = () => {
      if (hasAnalyticsConsent()) setConsent(true)
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [])

  if (!GTM_ID || !consent) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];window.dataLayer.push({page_type:'${pageType.replace(/'/g, "\\'")}'});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], // hydration-safe — GTM bootstrap stamp
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  )
}
