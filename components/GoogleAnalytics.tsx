'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { hasAnalyticsConsent, hasMarketingConsent } from './CookieConsentBanner'

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

/**
 * Loads Google's gtag stack with **Consent Mode v2** wired correctly.
 *
 * The previous version of this file only loaded gtag.js after the user
 * accepted the cookie banner. That kept the page cookie-clean for
 * visitors who declined, but it had two real downsides:
 *
 *   1. **Google Signals never worked.** Signals requires gtag to be
 *      loaded so it can communicate consent state. Visitors who never
 *      clicked Accept were invisible to Google entirely.
 *   2. **Cookieless modeling was disabled.** With Consent Mode v2, Google
 *      can still model conversions from visitors who decline cookies, as
 *      long as it knows their consent state. Suppressing gtag entirely
 *      threw away that signal.
 *
 * Consent Mode v2 pattern (now wired here):
 *
 *   1. **Before gtag.js loads** — push consent defaults of `denied` for
 *      every advertising / analytics category. `wait_for_update: 500ms`
 *      gives the CookieConsentBanner a brief moment to read its cookie
 *      and update the consent state before any tracking pings fire.
 *   2. **Always load gtag.js + GA4 config.** Data collection respects
 *      the consent state Google now knows about.
 *   3. **On consent change** — call `gtag('consent', 'update', ...)`
 *      with `granted` for the categories the user enabled. Persists for
 *      subsequent pageviews via the consent cookie.
 *
 * Best-practice reference:
 *   - https://developers.google.com/tag-platform/security/guides/consent
 *   - https://support.google.com/analytics/answer/14998558 (Consent Mode v2)
 *   - https://support.google.com/analytics/answer/9445345 (Google Signals)
 */
export default function GoogleAnalytics() {
  // Apply current consent state to gtag the moment the script is ready,
  // and whenever the user updates their preferences. Returns the cleanup.
  useEffect(() => {
    function applyConsent() {
      if (typeof window === 'undefined') return
      const w = window as Window & { gtag?: (...args: unknown[]) => void }
      if (typeof w.gtag !== 'function') return
      const analytics = hasAnalyticsConsent()
      const marketing = hasMarketingConsent()
      w.gtag('consent', 'update', {
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        analytics_storage: analytics ? 'granted' : 'denied',
      })
    }

    // Run once on mount in case consent was already stored from a prior visit.
    applyConsent()
    window.addEventListener('cookie-consent', applyConsent)
    return () => window.removeEventListener('cookie-consent', applyConsent)
  }, [])

  const hasGA4 = !!GA4_ID
  const hasAdSense = !!ADSENSE_ID
  const hasGoogleAds = !!GOOGLE_ADS_ID
  if (!hasGA4 && !hasAdSense && !hasGoogleAds) return null

  const gtagScriptId = hasGA4 ? GA4_ID! : (hasGoogleAds ? GOOGLE_ADS_ID! : null)

  return (
    <>
      {/* 1. Consent Mode v2 DEFAULTS — must inject before gtag.js so the
              first tracking ping carries the correct consent state. Uses
              `beforeInteractive` so it runs synchronously before any other
              tracking script gets to fire its initial event. */}
      <Script id="gtag-consent-defaults" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          // Default every advertising + analytics category to DENIED. The
          // useEffect above re-applies the stored cookie consent via
          // gtag('consent', 'update', ...) as soon as gtag is ready.
          // wait_for_update tells Google to hold any tracking pings for up
          // to 500ms while we read the consent cookie — avoids a "denied"
          // ping firing before the visitor's prior opt-in is applied.
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted',
            wait_for_update: 500
          });
          // URL-passthrough: when consent is denied, GA4 still propagates
          // gclid/dclid/utm_* across navigation via the URL instead of a
          // cookie. Keeps attribution intact for cookieless visitors.
          gtag('set', 'url_passthrough', true);
          // Ads data redaction: when consent is denied, redact PII from
          // the data sent to Google Ads. Required for Consent Mode v2
          // compliance.
          gtag('set', 'ads_data_redaction', true);
        `}
      </Script>

      {/* 2. gtag.js + GA4 config — loaded always now, since consent state
              is communicated via the defaults block above. Cookieless
              modeling kicks in automatically when consent is denied. */}
      {(hasGA4 || hasGoogleAds) && gtagScriptId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagScriptId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-gads-config" strategy="afterInteractive">
            {`
              (function() {
                var params = new URLSearchParams(window.location.search || '');
                var utmSource = params.get('utm_source');
                var inferredSource = null;
                var inferredMedium = null;

                if (!utmSource) {
                  if (params.get('fbclid')) {
                    inferredSource = 'facebook';
                    inferredMedium = 'paid_social';
                  } else if (params.get('ttclid')) {
                    inferredSource = 'tiktok';
                    inferredMedium = 'paid_social';
                  } else if (params.get('gclid')) {
                    inferredSource = 'google';
                    inferredMedium = 'cpc';
                  } else if (params.get('msclkid')) {
                    inferredSource = 'bing';
                    inferredMedium = 'cpc';
                  }
                }

                var gaConfig = {
                  // Cross-domain linker: keep client_id stable when a
                  // visitor hops between ryan-realty.com (WordPress) and
                  // ryanrealty.vercel.app (Next.js). Prevents the same
                  // person from showing as two sessions.
                  linker: {
                    domains: ['ryan-realty.com', 'www.ryan-realty.com', 'ryanrealty.vercel.app'],
                    accept_incoming: true
                  }
                };
                if (inferredSource && inferredMedium) {
                  gaConfig.campaign_source = inferredSource;
                  gaConfig.campaign_medium = inferredMedium;
                  gaConfig.campaign_name = params.get('utm_campaign') || 'auto-click-id';
                }

                ${hasGA4 ? `gtag('config', '${GA4_ID!.replace(/'/g, "\\'")}', gaConfig);` : ''}
              })();
              ${hasGoogleAds ? `gtag('config', '${GOOGLE_ADS_ID!.replace(/'/g, "\\'")}');` : ''}
            `}
          </Script>
        </>
      )}

      {/* AdSense — loaded immediately. Its own ad-display logic respects
          the consent state Google already knows about. */}
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
