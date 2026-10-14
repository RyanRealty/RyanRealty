/**
 * Daily GA4 internal-traffic data-QA (Analytics fix 6, 2026-10-08).
 *
 * Pure flagging plus a read-only Data API pull. Flags yesterday (GA4 property
 * timezone America/Los_Angeles) when:
 *   - any hostName other than ryan-realty.com reported session_start
 *   - any browserVersion had more than 20 session_starts
 *   - form_start fired with no generate_lead
 *
 * No database writes, no email/SMS/Slack/webhooks. The cron returns JSON and
 * logs the same object. Same credentials as app/actions/ga4-report.ts.
 */
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { zonedDateKey } from '@/lib/format/date'
import { isoAddDays } from './ga4-tracking-health'

export const ALLOWED_HOSTNAME = 'ryan-realty.com'
export const BROWSER_VERSION_SESSION_START_LIMIT = 20
export const GA4_PROPERTY_TZ = 'America/Los_Angeles'

export type HostCount = { hostName: string; sessions: number }
export type BrowserVersionCount = { browserVersion: string; sessionStarts: number }
export type FormLeadCounts = { formStart: number; generateLead: number }

export type InternalTrafficFlag = {
  code: 'foreign-hostname' | 'hot-browser-version' | 'form-start-without-lead'
  message: string
  detail: Record<string, unknown>
}

export type InternalTrafficQaVerdict = {
  date: string
  ok: boolean
  flags: InternalTrafficFlag[]
}

type ReportRow = {
  dimensionValues?: Array<{ value?: string | null }> | null
  metricValues?: Array<{ value?: string | null }> | null
}

function metricN(row: ReportRow): number {
  return parseInt(String(row.metricValues?.[0]?.value ?? 0), 10) || 0
}

function dim(row: ReportRow, i: number): string {
  return String(row.dimensionValues?.[i]?.value ?? '')
}

export function yesterdayInPropertyTz(now: Date = new Date()): string {
  return isoAddDays(zonedDateKey(now, GA4_PROPERTY_TZ), -1)
}

export function flagForeignHostnames(rows: HostCount[], allowed = ALLOWED_HOSTNAME): InternalTrafficFlag[] {
  return rows
    .filter((r) => r.hostName && r.hostName !== allowed && r.sessions > 0)
    .map((r) => ({
      code: 'foreign-hostname' as const,
      message: `hostName ${r.hostName} had ${r.sessions} session_start(s); only ${allowed} is allowed`,
      detail: { hostName: r.hostName, sessions: r.sessions },
    }))
}

export function flagHotBrowserVersions(
  rows: BrowserVersionCount[],
  limit = BROWSER_VERSION_SESSION_START_LIMIT,
): InternalTrafficFlag[] {
  return rows
    .filter((r) => r.sessionStarts > limit)
    .map((r) => ({
      code: 'hot-browser-version' as const,
      message: `browserVersion ${r.browserVersion} had ${r.sessionStarts} session_starts (limit ${limit})`,
      detail: { browserVersion: r.browserVersion, sessionStarts: r.sessionStarts, limit },
    }))
}

export function flagFormStartWithoutLead(counts: FormLeadCounts): InternalTrafficFlag[] {
  if (counts.formStart > 0 && counts.generateLead <= 0) {
    return [
      {
        code: 'form-start-without-lead',
        message: `form_start was ${counts.formStart} with no generate_lead`,
        detail: { formStart: counts.formStart, generateLead: counts.generateLead },
      },
    ]
  }
  return []
}

export function evaluateInternalTrafficQa(input: {
  date: string
  hosts: HostCount[]
  browserVersions: BrowserVersionCount[]
  formLead: FormLeadCounts
}): InternalTrafficQaVerdict {
  const flags = [
    ...flagForeignHostnames(input.hosts),
    ...flagHotBrowserVersions(input.browserVersions),
    ...flagFormStartWithoutLead(input.formLead),
  ]
  return { date: input.date, ok: flags.length === 0, flags }
}

export function foldHostRows(rows: ReportRow[]): HostCount[] {
  const byHost = new Map<string, number>()
  for (const r of rows) {
    const hostName = dim(r, 0)
    if (!hostName) continue
    byHost.set(hostName, (byHost.get(hostName) ?? 0) + metricN(r))
  }
  return [...byHost.entries()].map(([hostName, sessions]) => ({ hostName, sessions }))
}

export function foldBrowserRows(rows: ReportRow[]): BrowserVersionCount[] {
  const byVersion = new Map<string, number>()
  for (const r of rows) {
    const browserVersion = dim(r, 0)
    if (!browserVersion) continue
    byVersion.set(browserVersion, (byVersion.get(browserVersion) ?? 0) + metricN(r))
  }
  return [...byVersion.entries()].map(([browserVersion, sessionStarts]) => ({ browserVersion, sessionStarts }))
}

export function foldFormLeadRows(rows: ReportRow[]): FormLeadCounts {
  let formStart = 0
  let generateLead = 0
  for (const r of rows) {
    const eventName = dim(r, 0)
    const n = metricN(r)
    if (eventName === 'form_start') formStart += n
    else if (eventName === 'generate_lead') generateLead += n
  }
  return { formStart, generateLead }
}

export type FetchInternalTrafficQa =
  | { ok: true; hosts: HostCount[]; browserVersions: BrowserVersionCount[]; formLead: FormLeadCounts }
  | { ok: false; error: string }

export async function fetchInternalTrafficQa(date: string): Promise<FetchInternalTrafficQa> {
  const propertyId = process.env.GOOGLE_GA4_PROPERTY_ID?.trim()
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!propertyId || !clientEmail || !privateKey) return { ok: false, error: 'GA4_NOT_CONFIGURED' }

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, '\n') },
    })
    const property = `properties/${propertyId}`
    const dateRanges = [{ startDate: date, endDate: date }]
    const sessionStart = {
      filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT' as const, value: 'session_start' } },
    }
    const [[hosts], [browsers], [events]] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'hostName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: sessionStart,
        limit: 1000,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'browserVersion' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: sessionStart,
        limit: 10000,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', inListFilter: { values: ['form_start', 'generate_lead'], caseSensitive: true } },
        },
        limit: 20,
      }),
    ])
    return {
      ok: true,
      hosts: foldHostRows(hosts.rows ?? []),
      browserVersions: foldBrowserRows(browsers.rows ?? []),
      formLead: foldFormLeadRows(events.rows ?? []),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
