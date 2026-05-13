'use server'

import { google } from 'googleapis'

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

export async function getSearchConsoleSummary(startDate: string, endDate: string): Promise<SearchConsoleReportResult> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  // GSC site URL: prefer the env override, otherwise default to the
  // URL-prefix property for ryan-realty.com. Verified via the GSC
  // sites.list diagnostic on 2026-05-13 that the service account has
  // siteFullUser on https://ryan-realty.com/ specifically (not the
  // sc-domain: variant).
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'

  if (!clientEmail || !privateKeyRaw) {
    return { ok: false, error: 'SEARCH_CONSOLE_NOT_CONFIGURED' }
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKeyRaw.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const webmasters = google.webmasters({ version: 'v3', auth })

    const [summaryRes, queryRes, pageRes] = await Promise.all([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          rowLimit: 1,
          aggregationType: 'auto',
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
