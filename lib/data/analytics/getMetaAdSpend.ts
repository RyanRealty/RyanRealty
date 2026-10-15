/**
 * getMetaAdSpend — Meta (Facebook + Instagram) ad spend over a date range, for
 * /admin/analytics ("Paid spend" and "Cost per lead").
 *
 * Source: marketing_channel_daily, channel 'meta_ads', metric 'spend', scope
 * 'account' (written by /api/cron/marketing-snapshot-meta-ads). The cron also
 * writes one 'spend' row per campaign, so the account scope is required: summing
 * both would count every dollar twice.
 *
 * The hub used to read metric 'spend_usd', a name the cron never wrote, so both
 * figures always said "no data" (fixed 2026-10-14).
 *
 * DAL boundary (G1): the raw read lives here. `spendUsd` is null when no spend
 * row exists for the range (not synced), never a made-up 0.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type MetaAdSpend = {
  /** Sum of daily account spend in USD; null when no day in the range has a row. */
  spendUsd: number | null
  /** Days in the range with a spend row. */
  days: number
  unreadable: boolean
}

export async function getMetaAdSpend(startDate: string, endDate: string): Promise<MetaAdSpend> {
  const client = createServiceClient()
  const { rows, error } = await fetchPagedRows<{ date: string; value: number }>(
    (from, to) =>
      client
        .from('marketing_channel_daily')
        .select('date, value')
        .eq('channel', 'meta_ads')
        .eq('scope', 'account')
        .eq('metric', 'spend')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .range(from, to),
  )
  if (error) {
    console.error('[getMetaAdSpend]', error.message)
    return { spendUsd: null, days: 0, unreadable: true }
  }
  if (rows.length === 0) return { spendUsd: null, days: 0, unreadable: false }
  const spendUsd = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0)
  return { spendUsd, days: new Set(rows.map((r) => String(r.date))).size, unreadable: false }
}
