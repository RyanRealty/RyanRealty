'use client'

import { useReportWebVitals } from 'next/web-vitals'

/**
 * Real-user Core Web Vitals reporter.
 *
 * Next's useReportWebVitals fires once per metric (LCP, INP, CLS, FCP, TTFB) as
 * the browser measures it. We send each sample two places:
 *   1. /api/web-vitals -> public.web_vitals (powers the scoreboard's field p75)
 *   2. GA4 as an event (so Google's own reports carry real CWV too)
 *
 * Telemetry is best-effort and must never affect the page — every send is
 * wrapped in try/catch and uses sendBeacon (survives page unload).
 *
 * Mounted once in the root layout. Client component (the API is browser-only).
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return
    const device = window.innerWidth > 0 && window.innerWidth < 768 ? 'mobile' : 'desktop'
    const payload = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      path: window.location.pathname,
      device,
    }

    // 1. Our pipeline (scoreboard).
    try {
      const body = JSON.stringify(payload)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/web-vitals', body)
      } else {
        void fetch('/api/web-vitals', { method: 'POST', body, keepalive: true })
      }
    } catch {
      // ignore
    }

    // 2. GA4 (real-user CWV in Google's reports).
    try {
      const w = window as unknown as { gtag?: (...args: unknown[]) => void }
      w.gtag?.('event', metric.name, {
        // GA4 event values are integers; CLS is unitless so scale x1000.
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        metric_id: metric.id,
        metric_rating: metric.rating,
        non_interaction: true,
      })
    } catch {
      // ignore
    }
  })

  return null
}
