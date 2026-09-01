'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'
import { pageTypeFromPath } from '@/lib/analytics/page-type'
import { IS_NON_PRODUCTION_BUILD } from '@/lib/analytics/non-production-build'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()

/**
 * GTM container with **Consent Mode v2** (ci:tracking-policy).
 *
 * 2026-08-18 → 2026-09-01: this component suppressed gtm.js entirely until the
 * visitor accepted the banner. Because the GA4 configuration tag lives INSIDE
 * this container (GoogleAnalytics.tsx deliberately skips its own GA4 config
 * when GTM is present), that one gate made every non-consenting visitor —
 * most traffic, including tracked-email clickers — invisible to GA4, and took
 * source/referrer attribution with it (found 2026-09-01 after Matt reported
 * the drop). The tracking policy requires a consent CHECK, not suppression:
 * GoogleAnalytics.tsx has always implemented the sanctioned pattern, and this
 * file now matches it —
 *
 *   1. Push Consent Mode v2 defaults of `denied` (with wait_for_update) onto
 *      dataLayer BEFORE gtm.js, so every tag in the container starts denied.
 *   2. Always load gtm.js on a production build. Google models cookieless
 *      traffic from the denied state; nothing stores cookies pre-consent.
 *   3. Apply `consent update` from the stored banner state on mount and on
 *      every cookie-consent event (same listener contract as
 *      GoogleAnalytics.tsx — duplicate updates are idempotent).
 *
 * Pushes page_type onto dataLayer before gtm.js so the Google tag can stamp
 * every hit. First-paint page_view stays on the GTM Google tag (All Pages).
 * PageViewTracker stamps page_type and sends SPA page_view.
 */
export default function GTMHead() {
  const pathname = usePathname()
  const pageType = pageTypeFromPath(pathname || '/')

  useEffect(() => {
    function applyConsent() {
      const w = window as Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
      const analytics = hasAnalyticsConsent()
      const marketing = hasMarketingConsent()
      const gtag =
        typeof w.gtag === 'function'
          ? w.gtag
          : function gtagShim(...args: unknown[]) {
              ;(w.dataLayer = w.dataLayer || []).push(args)
            }
      gtag('consent', 'update', {
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        analytics_storage: analytics ? 'granted' : 'denied',
      })
    }
    applyConsent()
    window.addEventListener('cookie-consent', applyConsent)
    return () => window.removeEventListener('cookie-consent', applyConsent)
  }, [])

  // GTM ships its own GA4 configuration tag, so it leaks page views into the
  // production property from a dev server just as gtag does.
  if (IS_NON_PRODUCTION_BUILD) return null
  if (!GTM_ID) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
window.dataLayer.push({page_type:'${pageType.replace(/'/g, "\\'")}'});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], // hydration-safe — GTM bootstrap stamp
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  )
}
