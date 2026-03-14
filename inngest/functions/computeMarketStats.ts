/**
 * Pre-compute market stats into reporting_cache. Step 15.
 * Triggered after delta sync (when closings) and daily at 2 AM.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function startOfMonth(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

function endOfToday(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export const computeMarketStats = inngest.createFunction(
  {
    id: 'reporting/compute-market-stats',
    name: 'Compute market stats',
    retries: 1,
    concurrency: { limit: 1 },
  },
  [
    { event: 'reporting/compute-market-stats' },
    { cron: '0 2 * * *' },
  ],
  async ({ step }) => {
    const supabase = getServiceSupabase()
    const periodStart = startOfMonth(new Date())
    const periodEnd = endOfToday()

    const cities = await step.run('list-cities', async () => {
      const { data } = await supabase.from('listings').select('City').not('City', 'is', null)
      const set = new Set<string>()
      for (const row of data ?? []) {
        const c = (row as { City?: string | null }).City
        if (typeof c === 'string' && c.trim()) set.add(c.trim())
      }
      return Array.from(set)
    })

    const communities = await step.run('list-communities', async () => {
      const { data } = await supabase
        .from('listings')
        .select('SubdivisionName, City')
        .not('SubdivisionName', 'is', null)
        .not('City', 'is', null)
      const byKey = new Map<string, number>()
      for (const row of data ?? []) {
        const r = row as { SubdivisionName: string; City: string }
        const key = `${r.SubdivisionName}\t${r.City}`
        byKey.set(key, (byKey.get(key) ?? 0) + 1)
      }
      return Array.from(byKey.entries())
        .filter(([, count]) => count >= 5)
        .map(([key]) => {
          const [sub, city] = key.split('\t')
          return { subdivision: sub!, city: city! }
        })
    })

    let upserted = 0
    for (const city of cities) {
      await step.run(`city-${city}`, async () => {
        const { data } = await supabase.rpc('get_city_period_metrics', {
          p_city: city,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_as_of: periodEnd,
          p_subdivision: null,
        })
        const metrics = (data as Record<string, unknown>) ?? {}
        const { error } = await supabase.from('reporting_cache').upsert(
          {
            geo_type: 'city',
            geo_name: city,
            period_type: 'monthly',
            period_start: periodStart,
            period_end: periodEnd,
            metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'geo_type,geo_name,period_type,period_start' }
        )
        if (!error) upserted += 1
      })
    }
    for (const { subdivision, city } of communities) {
      await step.run(`comm-${subdivision}`, async () => {
        const { data } = await supabase.rpc('get_city_period_metrics', {
          p_city: city,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_as_of: periodEnd,
          p_subdivision: subdivision,
        })
        const metrics = (data as Record<string, unknown>) ?? {}
        const { error } = await supabase.from('reporting_cache').upsert(
          {
            geo_type: 'community',
            geo_name: subdivision,
            period_type: 'monthly',
            period_start: periodStart,
            period_end: periodEnd,
            metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'geo_type,geo_name,period_type,period_start' }
        )
        if (!error) upserted += 1
      })
    }

    return { cities: cities.length, communities: communities.length, upserted }
  }
)
