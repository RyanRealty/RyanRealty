/**
 * Signed chart data for the market-report email (review 2026-09-30).
 *
 * The email's chart used to be a URL the chart route answered by re-reading
 * the market cache when the image was OPENED: its own getMarketTrend read, its
 * own cache key and life (six hours at the CDN, plus a day stale), none of it
 * the read the email printed or the Spark check verified. So a report could
 * print "$445,000" beside a chart reading "$446,000", and the web view and
 * the archive re-drew it later from whatever the cache held by then.
 *
 * Now the email signs the exact months and values it printed and checked into
 * the image URL, and /api/email/market-chart draws a signed series and nothing
 * else: the route never reads data for it, an unsigned or altered series is a
 * 404, and the same URL always draws the same image, in the email, the web
 * view and the archive.
 *
 * Token: `d` = base64url(json), `s` = base64url(hmac) over a domain-separated
 * string (`rr-market-chart:v1:<d>`), so a chart signature can never be
 * replayed as a report link, an unsubscribe or a click token although they
 * share the secret (lib/email/signing-secret.ts). The data is aggregate public
 * market figures already printed in the email; the URL carries no person.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { emailSigningSecret } from '@/lib/email/signing-secret'
import { REPORT_LINK_ORIGIN } from '@/lib/email/report-link-token'

export const MARKET_CHART_PATH = '/api/email/market-chart'

export type MarketChartMetric = 'median_price' | 'inventory' | 'dom'

const METRICS: ReadonlySet<string> = new Set<MarketChartMetric>(['median_price', 'inventory', 'dom'])

export type MarketChartData = {
  metric: MarketChartMetric
  /** The area's name as the chart prints it. */
  label: string
  /** Each drawn month (YYYY-MM), oldest first, with the exact value the report printed and checked. */
  points: Array<{ month: string; value: number }>
}

/** The fewest months a chart draws (the route drew none below this before, either). */
export const MARKET_CHART_MIN_POINTS = 3
/** The most months a signed chart carries (the email draws up to 12). */
export const MARKET_CHART_MAX_POINTS = 36

const DOMAIN = 'rr-market-chart:v1:'
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

function mac(payload: string): string {
  return createHmac('sha256', emailSigningSecret('market-chart-token')).update(DOMAIN + payload).digest('base64url')
}

/** The series is one the route can draw honestly, or the reason it is not. Pure. */
function problem(data: MarketChartData): string | null {
  if (!METRICS.has(data.metric)) return `unknown metric ${String(data.metric)}`
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  if (!label || label.length > 80) return 'a label of 1 to 80 characters is required'
  const pts = Array.isArray(data.points) ? data.points : []
  if (pts.length < MARKET_CHART_MIN_POINTS || pts.length > MARKET_CHART_MAX_POINTS) {
    return `a chart draws ${MARKET_CHART_MIN_POINTS} to ${MARKET_CHART_MAX_POINTS} months, not ${pts.length}`
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (!p || typeof p.month !== 'string' || !MONTH.test(p.month)) return `month ${i} is not YYYY-MM`
    if (typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value < 0) return `month ${p.month} has no drawable value`
    if (i > 0 && p.month <= pts[i - 1]!.month) return 'months must run oldest first, each once'
  }
  return null
}

/** Sign a series. Throws on one the route could not draw (never signs a chart that would 404). */
export function signMarketChart(data: MarketChartData): { d: string; s: string } {
  const why = problem(data)
  if (why) throw new Error(`signMarketChart: ${why}`)
  const body = { v: 1, m: data.metric, l: data.label.trim(), p: data.points.map((p) => [p.month, p.value]) }
  const d = Buffer.from(JSON.stringify(body)).toString('base64url')
  return { d, s: mac(d) }
}

/** The absolute image URL for a signed series (the canonical apex, like every report link). */
export function marketChartUrl(data: MarketChartData): string {
  const { d, s } = signMarketChart(data)
  return `${REPORT_LINK_ORIGIN}${MARKET_CHART_PATH}?d=${d}&s=${s}`
}

/**
 * Verify a signed series. Null when missing, malformed, altered or not
 * drawable. Throws MissingSigningSecretError in production without a real
 * secret (a public secret would let anyone mint a chart on our domain).
 */
export function verifyMarketChart(d: string | null | undefined, s: string | null | undefined): MarketChartData | null {
  const payload = (d ?? '').trim()
  const sig = (s ?? '').trim()
  if (!payload || !sig || payload.length > 8000) return null
  const expected = mac(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let body: unknown
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!body || typeof body !== 'object') return null
  const o = body as { v?: unknown; m?: unknown; l?: unknown; p?: unknown }
  if (o.v !== 1 || !Array.isArray(o.p)) return null
  const data: MarketChartData = {
    metric: o.m as MarketChartMetric,
    label: typeof o.l === 'string' ? o.l : '',
    points: o.p.map((pair) => {
      const [month, value] = Array.isArray(pair) ? pair : []
      return { month: typeof month === 'string' ? month : '', value: typeof value === 'number' ? value : Number.NaN }
    }),
  }
  return problem(data) ? null : data
}
