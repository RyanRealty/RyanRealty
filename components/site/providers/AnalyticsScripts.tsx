import { Suspense } from 'react'
import GTMBody from '@/components/GTMBody'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import MetaPixel from '@/components/MetaPixel'
import PageViewTracker from '@/components/PageViewTracker'
import { GoogleMapsBootstrap } from '@/components/GoogleMapsBootstrap'

/**
 * Consolidated analytics + maps script stack for the site body.
 *
 * Each child component already encodes its own consent gate against
 * CookieConsentBanner cookie state, so this composition is purely
 * organizational — it groups every "tags + scripts" component that
 * lives near the top of the body into one named import.
 *
 * GTMHead stays in app/layout.tsx <head> by convention. Everything
 * else moves into the body via this composition.
 *
 * Slots:
 *   - GTMBody — Google Tag Manager noscript iframe fallback
 *   - GoogleAnalytics — GA4 + Google Ads + Consent Mode v2 defaults
 *   - MetaPixel — Meta Pixel + CAPI advanced-matching prep (marketing consent gate)
 *   - GoogleMapsBootstrap — official Maps JS API loader (no consent gate, no PII)
 *   - PageViewTracker — useSearchParams island, must live in Suspense
 *
 * Used only by RootProvider; not exported from the primitives barrel.
 */
export function AnalyticsScripts() {
  return (
    <>
      <GTMBody />
      <GoogleAnalytics />
      <MetaPixel />
      <GoogleMapsBootstrap />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  )
}
