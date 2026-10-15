'use server'

import { google } from 'googleapis'
import { withAuthDeadline } from '@/lib/google-deadline'
import { latestReportedDate } from '@/lib/marketing-brain/gsc-reported-days'

/**
 * Per-request deadline for the 3 parallel Search Analytics queries below. The
 * tightest live caller (DashboardSitePerformancePanel, an admin page render
 * with no maxDuration override of its own) carries no generous budget, so this
 * stays a fraction of even a short platform default; the other caller,
 * api/cron/marketing-snapshot-gsc (maxDuration 300), has room to spare.
 */
const SEARCH_CONSOLE_REQUEST_TIMEOUT_MS = 10_000

export type SearchConsoleSummary = {
  clicks: number
  impressions: number
  ctr: number
  position: number
  topQueries: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>
}

export type SearchConsoleReportResult =
  | { ok: true; data: SearchConsoleSummary }
  | { ok: false; error: string }

/**
 * The latest date Search Console has final data for. `reportedThrough` is null
 * when Google returned no dated rows in the probe window: nothing is reported.
 */
export type SearchConsoleReportedThroughResult =
  | { ok: true; reportedThrough: string | null; probedFrom: string; probedTo: string }
  | { ok: false; error: string }

/**
 * Every query here reads FINAL data, the API default, written out so the
 * reported-through probe and the per-day summary can never disagree on it.
 * Fresh (`all`) data is partial and still moving; a daily snapshot that stored
 * it would show a partial day as a drop.
 */
const DATA_STATE = 'final'

/** How far back the reported-through probe looks for the latest final day. */
const REPORTED_PROBE_DAYS = 30

type SearchConsoleRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeRows(rows: SearchConsoleRow[] | undefined) {
  return (rows ?? []).map((row) => ({
    key: row.keys?.[0] ?? 'Unknown',
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: toNumber(row.ctr),
    position: toNumber(row.position),
  }))
}

type SearchConsoleClient =
  | { ok: true; siteUrl: string; webmasters: ReturnType<typeof google.webmasters> }
  | { ok: false; error: string }

function searchConsoleClient(siteOverride?: string): SearchConsoleClient {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  // GSC site URL priority (highest to lowest):
  //   1. siteOverride argument (passed by the ingestor's ?site= query param)
  //   2. GOOGLE_SEARCH_CONSOLE_SITE_URL env var
  //   3. https://ryan-realty.com/ default (the URL-prefix property the
  //      service account actually has access to per the 2026-05-13
  //      sites.list diagnostic). The sc-domain: variant is NOT
  //      accessible to viewer@ryanrealty.iam.gserviceaccount.com.
  const siteUrl = siteOverride?.trim() || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'

  if (!clientEmail || !privateKeyRaw) {
    return { ok: false, error: 'SEARCH_CONSOLE_NOT_CONFIGURED' }
  }

  const auth = new google.auth.JWT(
    withAuthDeadline({
      email: clientEmail,
      key: privateKeyRaw.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    }),
  )
  const webmasters = google.webmasters({ version: 'v3', auth, timeout: SEARCH_CONSOLE_REQUEST_TIMEOUT_MS })
  return { ok: true, siteUrl, webmasters }
}

/**
 * The latest date Google Search Console has final data for, read from Google:
 * one `dimensions: ['date']` query over the last REPORTED_PROBE_DAYS days.
 * The snapshot cron stores a day only on or before this date
 * (lib/marketing-brain/gsc-reported-days.ts has the rule and its tests).
 */
export async function getSearchConsoleReportedThrough(siteOverride?: string): Promise<SearchConsoleReportedThroughResult> {
  const today = new Date()
  const from = new Date(today)
  from.setUTCDate(from.getUTCDate() - REPORTED_PROBE_DAYS)
  // UTC "today" can be Google's (Pacific) tomorrow. The API accepts a future
  // end date and simply has no rows for it (checked live 2026-10-14).
  const probedFrom = from.toISOString().slice(0, 10)
  const probedTo = today.toISOString().slice(0, 10)

  try {
    const sc = searchConsoleClient(siteOverride)
    if (!sc.ok) return sc
    const res = await sc.webmasters.searchanalytics.query({
      siteUrl: sc.siteUrl,
      requestBody: {
        startDate: probedFrom,
        endDate: probedTo,
        dimensions: ['date'],
        dataState: DATA_STATE,
        rowLimit: REPORTED_PROBE_DAYS + 2,
      },
    })
    return { ok: true, reportedThrough: latestReportedDate(res.data.rows), probedFrom, probedTo }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search Console API error'
    return { ok: false, error: message }
  }
}

export async function getSearchConsoleSummary(startDate: string, endDate: string, siteOverride?: string): Promise<SearchConsoleReportResult> {
  try {
    const sc = searchConsoleClient(siteOverride)
    if (!sc.ok) return sc
    const { siteUrl, webmasters } = sc
    const [summaryRes, queryRes, pageRes] = await Promise.all([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          rowLimit: 1,
          aggregationType: 'auto',
          dataState: DATA_STATE,
        },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: 25,
          aggregationType: 'auto',
          dataState: DATA_STATE,
        },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 25,
          aggregationType: 'auto',
          dataState: DATA_STATE,
        },
      }),
    ])

    const summaryRow = summaryRes.data.rows?.[0]
    return {
      ok: true,
      data: {
        clicks: toNumber(summaryRow?.clicks),
        impressions: toNumber(summaryRow?.impressions),
        ctr: toNumber(summaryRow?.ctr),
        position: toNumber(summaryRow?.position),
        topQueries: normalizeRows(queryRes.data.rows as SearchConsoleRow[] | undefined),
        topPages: normalizeRows(pageRes.data.rows as SearchConsoleRow[] | undefined),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search Console API error'
    return { ok: false, error: message }
  }
}
