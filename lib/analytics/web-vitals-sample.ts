/**
 * Validation for one real-user web-vitals sample before it is stored in
 * public.web_vitals (app/api/web-vitals/route.ts). Pure, so the rules are
 * testable without a request.
 *
 * The rules, each from the 2026-09-22 visibility audit (TRACK-3):
 *   - Only LCP, INP, CLS, FCP and TTFB. Google replaced FID with INP as the
 *     responsiveness Core Web Vital in March 2024, but Next 16's
 *     useReportWebVitals still calls onFID (node_modules/next/dist/client/
 *     web-vitals.js), so 3,149 FID rows were written 2026-09-08..09-21 (UTC
 *     created_at, public.web_vitals metric='FID'). They are dropped here.
 *   - Framework and API paths are not pages. A stale /_next/image URL rendered
 *     the 404 page with the root layout mounted and carried 17,092 of 41,934
 *     LCP rows (41%) in that window (path='/_next/image').
 *   - A timing past MAX_TIMING_MS is not a page-load experience (a stalled or
 *     backgrounded tab, a clock jump); 43 non-CLS samples in that window read
 *     above it. It is dropped, not stored and not capped: a capped value would
 *     still enter every p75 as a real slow load.
 *
 * Page type: public.web_vitals has no page_type column (schema snapshot:
 * id, metric, value, rating, path, navigation_type, device, created_at), and
 * this package does not add one. Readers derive it from `path` with
 * pageTypeFromPath (lib/analytics/page-type.ts).
 */

export const RUM_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const
export type RumMetric = (typeof RUM_METRICS)[number]
const RUM_METRIC_SET: ReadonlySet<string> = new Set(RUM_METRICS)

/** Two minutes. Any LCP/INP/FCP/TTFB above this is a stall, not a load. */
export const MAX_TIMING_MS = 120_000

/** Paths that are never a page a person navigated to: framework and API routes. */
export function isNonPagePath(pathname: string): boolean {
  return pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname === '/api'
}

export type WebVitalRow = {
  metric: RumMetric
  value: number
  rating: string | null
  path: string | null
  navigation_type: string | null
  device: string | null
}

export type WebVitalVerdict =
  | { ok: true; row: WebVitalRow }
  | { ok: false; reason: 'metric' | 'value' | 'range' | 'path' }

export function parseWebVitalSample(data: Record<string, unknown>): WebVitalVerdict {
  const metric = typeof data.name === 'string' ? data.name.toUpperCase() : ''
  if (!RUM_METRIC_SET.has(metric)) return { ok: false, reason: 'metric' }

  const value = typeof data.value === 'number' ? data.value : Number(data.value)
  if (!Number.isFinite(value)) return { ok: false, reason: 'value' }
  // CLS is unitless; every other metric is milliseconds. None can be negative.
  if (value < 0 || (metric !== 'CLS' && value > MAX_TIMING_MS)) return { ok: false, reason: 'range' }

  const path = typeof data.path === 'string' ? data.path : ''
  if (isNonPagePath(path)) return { ok: false, reason: 'path' }

  return {
    ok: true,
    row: {
      metric: metric as RumMetric,
      value,
      rating: typeof data.rating === 'string' ? data.rating : null,
      path: path ? path.slice(0, 512) : null,
      navigation_type: typeof data.navigationType === 'string' ? data.navigationType : null,
      device: typeof data.device === 'string' ? data.device : null,
    },
  }
}
