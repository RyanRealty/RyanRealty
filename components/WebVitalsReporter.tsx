'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { scrubPrivateUrls } from '@/lib/analytics/private-paths'
import { isNonPagePath } from '@/lib/analytics/web-vitals-sample'
import { pushDataLayerEvent } from '@/lib/analytics/ga4-browser-events'

/**
 * Real-user Core Web Vitals reporter.
 *
 * Next's useReportWebVitals fires once per metric (LCP, INP, CLS, FCP, TTFB) as
 * the browser measures it. We send each sample two places:
 *   1. /api/web-vitals -> public.web_vitals (powers the scoreboard's field p75)
 *   2. GA4 as an event via GTM (so Google's own reports carry real CWV too)
 *
 * Telemetry is best-effort and must never affect the page — every send is
 * wrapped in try/catch and uses sendBeacon (survives page unload).
 *
 * Mounted once in the root layout. Client component (the API is browser-only).
 */
// isNonPagePath is shared with the server twin in app/api/web-vitals/route.ts
// (lib/analytics/web-vitals-sample.ts), so the two filters cannot drift.

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

/**
 * One report per metric per page load (bfcache restores report again, with
 * navigationType 'back-forward-cache'). Next's useReportWebVitals re-registers
 * the web-vitals observers whenever its callback changes, and FCP and TTFB
 * replay from buffered entries with a fresh id. An inline callback is a new
 * function every render, so a re-render (a server action that sets a cookie
 * re-renders the tree: the identity bridge on a tab's first page) sent FCP and
 * TTFB twice (live test 2026-10-14). The callback is module-level, so it never
 * changes, and this set drops any repeat that still gets through.
 */
const reported = new Set<string>()

function reportWebVital(metric: WebVitalMetric) {
  if (typeof window === 'undefined') return
  const once = `${metric.name}:${metric.navigationType}`
  if (reported.has(once)) return
  reported.add(once)
  // Not a page. A missing /_next/image URL renders the app's 404 page with
  // the root layout mounted, so this reporter fired for image-optimizer
  // misses and /api paths: 20,306 of 45,354 LCP rows in the 14 days to
  // 2026-09-22 carried path /_next/image (visibility audit, TRACK-3), which
  // made the "other" class p75 LCP 9.1 s and hid the real routes.
  if (isNonPagePath(window.location.pathname)) return
  const device = window.innerWidth > 0 && window.innerWidth < 768 ? 'mobile' : 'desktop'
  const payload = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    // A signing link's token never rides along (private-paths.ts): /sign/[token].
    path: scrubPrivateUrls(window.location.pathname),
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

  // 2. GA4 (real-user CWV in Google's reports), through GTM's GA4 Event tag
  //    (lib/analytics/ga4-browser-events.ts). A bare gtag('event') has reached
  //    nothing since 1224b1f made GTM's Google tag the only GA4 config.
  try {
    pushDataLayerEvent(metric.name, {
      // GA4 event values are integers; CLS is unitless so scale x1000.
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_rating: metric.rating,
    })
  } catch {
    // ignore
  }
}

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital)
  return null
}
