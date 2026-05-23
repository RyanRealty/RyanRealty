/**
 * Google Ads daily snapshot ingestor.
 *
 * Mirrors marketing-snapshot-meta-ads. Pulls Google Ads spend, impressions,
 * clicks, conversions per-day per-campaign via the Google Ads REST API v18
 * and writes into marketing_channel_daily with channel='google_ads'.
 *
 * Required env vars (graceful no-op if any are missing):
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID           — "1234567890" (no dashes)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID     — manager account ID (optional)
 *   GOOGLE_ADS_ACCESS_TOKEN          — OAuth access token; refresh handled
 *                                       by the existing token-heartbeat cron
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD ranges supported.
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const CHANNEL = 'google_ads' as const
const SOURCE = 'google_ads_api_v18'
const GADS_BASE = 'https://googleads.googleapis.com/v18'

type GadsCampaignRow = {
  campaign_id: string
  campaign_name: string
  spend_micros: number
  impressions: number
  clicks: number
  conversions: number
}

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }
  return fallback
}

async function fetchGadsForDay(date: string): Promise<GadsCampaignRow[] | null> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.trim()
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim()
  const accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN?.trim()
  if (!devToken || !customerId || !accessToken) return null

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date = '${date}'
  `
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': devToken,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId
  try {
    const res = await fetch(`${GADS_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[google-ads-snapshot] HTTP ${res.status} for ${date}: ${body.slice(0, 200)}`)
      return null
    }
    const j = await res.json() as { results?: Array<{ campaign?: { id?: string; name?: string }; metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number } }> }
    return (j.results ?? []).map((r) => ({
      campaign_id: r.campaign?.id ?? '',
      campaign_name: r.campaign?.name ?? '',
      spend_micros: num(r.metrics?.costMicros),
      impressions: num(r.metrics?.impressions),
      clicks: num(r.metrics?.clicks),
      conversions: num(r.metrics?.conversions),
    }))
  } catch (e) {
    console.warn(`[google-ads-snapshot] fetch failed for ${date}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

function rowsForDay(date: string, campaigns: GadsCampaignRow[]): MetricRow[] {
  const accountTotals = campaigns.reduce((acc, c) => ({
    spend: acc.spend + c.spend_micros / 1_000_000,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    conversions: acc.conversions + c.conversions,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 })

  const base = { date, channel: CHANNEL, source: SOURCE }
  const accountRows: MetricRow[] = [
    { ...base, scope: 'account', scope_id: '', metric: 'spend', value: accountTotals.spend },
    { ...base, scope: 'account', scope_id: '', metric: 'impressions', value: accountTotals.impressions },
    { ...base, scope: 'account', scope_id: '', metric: 'clicks', value: accountTotals.clicks },
    { ...base, scope: 'account', scope_id: '', metric: 'conversions', value: accountTotals.conversions },
    { ...base, scope: 'account', scope_id: '', metric: 'cpc', value: accountTotals.clicks > 0 ? accountTotals.spend / accountTotals.clicks : 0 },
    { ...base, scope: 'account', scope_id: '', metric: 'cpm', value: accountTotals.impressions > 0 ? (accountTotals.spend / accountTotals.impressions) * 1000 : 0 },
    { ...base, scope: 'account', scope_id: '', metric: 'ctr', value: accountTotals.impressions > 0 ? (accountTotals.clicks / accountTotals.impressions) * 100 : 0 },
  ]
  const campaignRows: MetricRow[] = campaigns.flatMap((c) => {
    const spend = c.spend_micros / 1_000_000
    const meta = { campaign_name: c.campaign_name, customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID?.trim() ?? '' }
    return [
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'spend',       value: spend,             metadata: meta },
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'impressions', value: c.impressions,     metadata: meta },
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'clicks',      value: c.clicks,          metadata: meta },
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'conversions', value: c.conversions,     metadata: meta },
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'cpc',         value: c.clicks > 0 ? spend / c.clicks : 0, metadata: meta },
      { ...base, scope: 'campaign' as const, scope_id: c.campaign_id, metric: 'ctr',         value: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0, metadata: meta },
    ]
  })
  return [...accountRows, ...campaignRows]
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let startDate: string
  let endDate: string
  try {
    ;({ startDate, endDate } = parseDateRange(request))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'invalid date range' }, { status: 400 })
  }

  // Graceful no-op if credentials are missing — return ok so the cron
  // doesn't error-storm the Vercel logs every day.
  const hasCreds = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
    && process.env.GOOGLE_ADS_CUSTOMER_ID?.trim()
    && process.env.GOOGLE_ADS_ACCESS_TOKEN?.trim())
  if (!hasCreds) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CUSTOMER_ID / GOOGLE_ADS_ACCESS_TOKEN not configured. Snapshot will run automatically once they are.',
      channel: CHANNEL,
      startDate,
      endDate,
    })
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0
  for (const day of dateIter(startDate, endDate)) {
    try {
      const campaigns = await fetchGadsForDay(day)
      if (campaigns == null) {
        errors.push(`${day}: fetch failed`)
        continue
      }
      const rows = rowsForDay(day, campaigns)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const result: IngestorResult = {
    channel: CHANNEL,
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }
  return NextResponse.json(result)
}