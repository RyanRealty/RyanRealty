/**
 * getGscMetrics — Google Search Console figures for /admin/analytics/google-search.
 *
 * Source: marketing_channel_daily snapshots (channel='gsc'), written by the
 * GSC snapshot cron. 2-3 day processing lag is inherent to the GSC Search
 * Analytics API, not a bug here.
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft — callers get an
 * `unreadable` flag instead of a thrown error, per §0 (an honest empty state,
 * never a silent zero presented as a real figure).
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type GscScope = 'campaign' | 'page'

export type GscScopeRow = {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type Agg = { clicks: number; impressions: number; ctrSum: number; ctrN: number; posSum: number; posN: number }

export type GscScopeResult = {
  rows: GscScopeRow[]
  unreadable: boolean
}

/** Per-query or per-page aggregate over a date range (scope='campaign' for queries, 'page' for URLs). */
export async function getGscScopeAggregate(
  scope: GscScope,
  sinceDate: string,
  untilDate?: string,
): Promise<GscScopeResult> {
  const client = createServiceClient()
  // Paged read — PostgREST caps single responses at 1,000 rows, so a bare
  // .limit(50000) would silently truncate the GSC aggregate. Ordered on the
  // composite PK (date, scope_id, metric) for stable range pagination.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) => {
      const q = client
        .from('marketing_channel_daily')
        .select('scope_id, metric, value')
        .eq('channel', 'gsc')
        .eq('scope', scope)
        .in('metric', ['clicks', 'impressions', 'ctr', 'position'])
        .gte('date', sinceDate)
      return (untilDate ? q.lte('date', untilDate) : q)
        .order('date', { ascending: true })
        .order('scope_id', { ascending: true })
        .order('metric', { ascending: true })
        .range(from, to)
    },
    50000,
  )
  if (error) {
    console.error('[getGscScopeAggregate]', error.message)
    return { rows: [], unreadable: true }
  }
  const m = new Map<string, Agg>()
  for (const raw of data) {
    const r = raw as { scope_id: string; metric: string; value: number }
    const a = m.get(r.scope_id) ?? { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
    const v = Number(r.value) || 0
    if (r.metric === 'clicks') a.clicks += v
    else if (r.metric === 'impressions') a.impressions += v
    else if (r.metric === 'ctr') {
      a.ctrSum += v
      a.ctrN += 1
    } else if (r.metric === 'position') {
      a.posSum += v
      a.posN += 1
    }
    m.set(r.scope_id, a)
  }
  const rows = Array.from(m.entries()).map(([key, a]) => ({
    key,
    clicks: a.clicks,
    impressions: a.impressions,
    ctr: a.impressions > 0 ? a.clicks / a.impressions : a.ctrN > 0 ? a.ctrSum / a.ctrN : 0,
    position: a.posN > 0 ? a.posSum / a.posN : 0,
  }))
  return { rows, unreadable: false }
}

export type GscAccountTotals = {
  clicks: number
  impressions: number
  ctr: number
  pos: number
  unreadable: boolean
}

/** Account-level (scope='account') totals for the headline KPI strip. */
export async function getGscAccountTotals(sinceDate: string, endDate: string): Promise<GscAccountTotals> {
  const client = createServiceClient()
  const { data, error } = await client
    .from('marketing_channel_daily')
    .select('metric, value')
    .eq('channel', 'gsc')
    .eq('scope', 'account')
    .gte('date', sinceDate)
    .lte('date', endDate)
  if (error) {
    console.error('[getGscAccountTotals]', error.message)
    return { clicks: 0, impressions: 0, ctr: 0, pos: 0, unreadable: true }
  }
  const acc = { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
  for (const r of (data ?? []) as Array<{ metric: string; value: number }>) {
    const v = Number(r.value) || 0
    if (r.metric === 'clicks') acc.clicks += v
    else if (r.metric === 'impressions') acc.impressions += v
    else if (r.metric === 'avg_ctr') {
      acc.ctrSum += v
      acc.ctrN += 1
    } else if (r.metric === 'avg_position') {
      acc.posSum += v
      acc.posN += 1
    }
  }
  return {
    clicks: acc.clicks,
    impressions: acc.impressions,
    ctr: acc.ctrN > 0 ? acc.ctrSum / acc.ctrN : 0,
    pos: acc.posN > 0 ? acc.posSum / acc.posN : 0,
    unreadable: false,
  }
}
