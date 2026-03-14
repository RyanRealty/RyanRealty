/**
 * Pre-compute broker performance stats. Step 15.
 * Daily cron: aggregate closed listings per broker (match by listing_agents.agent_email = brokers.email).
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function periodEnd(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export const computeBrokerStats = inngest.createFunction(
  {
    id: 'reporting/compute-broker-stats',
    name: 'Compute broker stats',
    retries: 1,
    concurrency: { limit: 1 },
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    const supabase = getServiceSupabase()
    const today = periodEnd(new Date())
    const monthStart = today.slice(0, 8) + '01'
    const yearStart = today.slice(0, 4) + '-01-01'

    const brokers: { id: string; email: string | null }[] = (await step.run('list-brokers', async () => {
      const { data } = await supabase.from('brokers').select('id, email').eq('is_active', true)
      return (data ?? []) as { id: string; email: string | null }[]
    })) ?? []

    let upserted = 0
    for (const broker of brokers) {
      const email = broker.email?.trim()
      if (!email) continue
      await step.run(`broker-${broker.id}`, async () => {
        const { data: rows } = await supabase
          .from('listing_agents')
          .select('listing_key')
          .in('agent_role', ['list', 'listing'])
          .ilike('agent_email', email)
        const keys = (rows ?? []).map((r: { listing_key: string }) => r.listing_key)
        if (keys.length === 0) return
        const { data: closed } = await supabase
          .from('listings')
          .select('close_price, close_date')
          .in('listing_key', keys)
          .not('close_price', 'is', null)
          .ilike('standard_status', '%closed%')
        const list = (closed ?? []) as { close_price: number; close_date: string | null }[]
        const last30 = list.filter((r) => r.close_date && r.close_date >= monthStart)
        const last12 = list.filter((r) => r.close_date && r.close_date >= yearStart)
        const vol30 = last30.reduce((s, r) => s + Number(r.close_price ?? 0), 0)
        const vol12 = last12.reduce((s, r) => s + Number(r.close_price ?? 0), 0)
        const avg30 = last30.length ? vol30 / last30.length : 0
        const avg12 = last12.length ? vol12 / last12.length : 0
        await supabase.from('broker_stats').delete().eq('broker_id', broker.id).eq('period_type', 'monthly').eq('period_start', monthStart)
        await supabase.from('broker_stats').delete().eq('broker_id', broker.id).eq('period_type', 'yearly').eq('period_start', yearStart)
        await supabase.from('broker_stats').insert({
          broker_id: broker.id,
          period_type: 'monthly',
          period_start: monthStart,
          period_end: today,
          metrics: { transaction_count: last30.length, total_volume: vol30, avg_sale_price: avg30 },
        })
        await supabase.from('broker_stats').insert({
          broker_id: broker.id,
          period_type: 'yearly',
          period_start: yearStart,
          period_end: today,
          metrics: { transaction_count: last12.length, total_volume: vol12, avg_sale_price: avg12 },
        })
        upserted += 2
      })
    }

    return { brokers: brokers.length, upserted }
  }
)
