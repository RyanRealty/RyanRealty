/**
 * getGbpDaily — Google Business Profile figures per day, for the Website view
 * of /admin/analytics.
 *
 * Source: marketing_channel_daily, channel 'gbp', scope 'account' (written by
 * /api/cron/marketing-snapshot-gbp from the Business Profile Performance API).
 *
 * Two things about this data shape every figure built from it:
 *   - Google finishes a day several days late, and a day it has not finished
 *     comes back with no value, which the cron drops (lib/google-business-profile.ts
 *     parseGBPTimeSeries). So the newest days of a window are missing, not zero.
 *   - The API also leaves out a metric on a finished day when its value is 0,
 *     so on a day Google DID report (impressions are there), a missing call or
 *     website click is a real zero.
 * summarizeGbp therefore counts only days Google reported, and says how many.
 *
 * DAL boundary (G1): the raw read lives here. Fails soft to `unreadable`.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type GbpRow = { date: string; metric: string; value: number }

export const GBP_IMPRESSION_METRICS = [
  'business_impressions_desktop_search',
  'business_impressions_mobile_search',
  'business_impressions_desktop_maps',
  'business_impressions_mobile_maps',
] as const

export const GBP_ACTION_METRICS = ['call_clicks', 'website_clicks', 'business_direction_requests'] as const

export async function getGbpDaily(
  sinceDate: string,
  untilDate: string,
): Promise<{ rows: GbpRow[]; unreadable: boolean }> {
  const client = createServiceClient()
  const { rows, error } = await fetchPagedRows<GbpRow>(
    (from, to) =>
      client
        .from('marketing_channel_daily')
        .select('date, metric, value')
        .eq('channel', 'gbp')
        .eq('scope', 'account')
        .in('metric', [...GBP_IMPRESSION_METRICS, ...GBP_ACTION_METRICS])
        .gte('date', sinceDate)
        .lte('date', untilDate)
        .order('date', { ascending: true })
        .order('metric', { ascending: true })
        .range(from, to),
  )
  if (error) {
    console.error('[getGbpDaily]', error.message)
    return { rows: [], unreadable: true }
  }
  return {
    rows: rows.map((r) => ({ date: String(r.date), metric: r.metric, value: Number(r.value) || 0 })),
    unreadable: false,
  }
}

export type GbpSummary = {
  /** Days in the window Google has reported (any metric present). */
  reportedDays: number
  calls: number
  websiteClicks: number
  directionRequests: number
  /** Times the profile was shown in Google Search and Maps (all four surfaces). */
  impressions: number
}

/** Sum one window (inclusive YYYY-MM-DD bounds). Pure. */
export function summarizeGbp(rows: readonly GbpRow[], startDate: string, endDate: string): GbpSummary {
  const days = new Set<string>()
  const s: GbpSummary = { reportedDays: 0, calls: 0, websiteClicks: 0, directionRequests: 0, impressions: 0 }
  const impressionSet = new Set<string>(GBP_IMPRESSION_METRICS)
  for (const r of rows) {
    if (r.date < startDate || r.date > endDate) continue
    days.add(r.date)
    if (r.metric === 'call_clicks') s.calls += r.value
    else if (r.metric === 'website_clicks') s.websiteClicks += r.value
    else if (r.metric === 'business_direction_requests') s.directionRequests += r.value
    else if (impressionSet.has(r.metric)) s.impressions += r.value
  }
  s.reportedDays = days.size
  return s
}

/** The newest date Google has reported anything for, or null. Pure. */
export function latestGbpDate(rows: readonly GbpRow[]): string | null {
  let latest: string | null = null
  for (const r of rows) if (!latest || r.date > latest) latest = r.date
  return latest
}
