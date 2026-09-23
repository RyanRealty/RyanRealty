/**
 * Exact per-day GA4 counts for the tracking-health guard: browser session_start
 * and first_visit, and google/organic sessions. Two small Data API reports over
 * the whole window (dimension `date`), so no top-N list can drop a zero day.
 *
 * Same credentials as app/actions/ga4-report.ts getGA4Summary. Server-only
 * (called from the GA4 snapshot cron).
 */
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { BROWSER_ONLY_EVENTS, type ExactDayCounts } from '@/lib/marketing-brain/ga4-snapshot-rows'

export type Ga4HealthCountsResult =
  | { ok: true; byDate: Map<string, ExactDayCounts> }
  | { ok: false; error: string }

/** GA4 `date` dimension values are YYYYMMDD. */
export function ga4DateToIso(raw: string): string | null {
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : null
}

type ReportRow = { dimensionValues?: Array<{ value?: string | null }> | null; metricValues?: Array<{ value?: string | null }> | null }

/**
 * Fold the two reports into per-day counts. Every date in [startDate, endDate]
 * gets an entry, zero when GA4 returned no row for it — GA4 omits zero rows,
 * which is exactly why a missing row must be read as 0 here and nowhere else.
 */
export function foldHealthCounts(
  startDate: string,
  endDate: string,
  eventRows: ReportRow[],
  organicRows: ReportRow[],
): Map<string, ExactDayCounts> {
  const out = new Map<string, ExactDayCounts>()
  for (let d = new Date(`${startDate}T00:00:00Z`); d <= new Date(`${endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.set(d.toISOString().slice(0, 10), { sessionStart: 0, firstVisit: 0, googleOrganicSessions: 0 })
  }
  for (const r of eventRows) {
    const date = ga4DateToIso(String(r.dimensionValues?.[0]?.value ?? ''))
    const eventName = String(r.dimensionValues?.[1]?.value ?? '')
    const n = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10) || 0
    const cur = date ? out.get(date) : undefined
    if (!cur) continue
    if (eventName === 'session_start') cur.sessionStart += n
    else if (eventName === 'first_visit') cur.firstVisit += n
  }
  for (const r of organicRows) {
    const date = ga4DateToIso(String(r.dimensionValues?.[0]?.value ?? ''))
    const n = parseInt(String(r.metricValues?.[0]?.value ?? 0), 10) || 0
    const cur = date ? out.get(date) : undefined
    if (cur) cur.googleOrganicSessions += n
  }
  return out
}

export async function fetchGa4HealthCounts(startDate: string, endDate: string): Promise<Ga4HealthCountsResult> {
  const propertyId = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!propertyId || !clientEmail || !privateKey) return { ok: false, error: 'GA4_NOT_CONFIGURED' }

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, '\n') },
    })
    const property = `properties/${propertyId}`
    const [[events], [organic]] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', inListFilter: { values: [...BROWSER_ONLY_EVENTS], caseSensitive: true } },
        },
        limit: 1000,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'EXACT', value: 'google / organic' } },
        },
        limit: 1000,
      }),
    ])
    return { ok: true, byDate: foldHealthCounts(startDate, endDate, events.rows ?? [], organic.rows ?? []) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
