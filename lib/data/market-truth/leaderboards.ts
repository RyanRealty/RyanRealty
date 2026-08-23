/**
 * Registry leaderboards. Internal (admin) until Step 9 public grains exist.
 * min_n inherited from the registry. No office ranking here.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID, STAT_BY_ID } from '@/lib/data/market-truth/registry'

export type LeaderboardRow = {
  geoSlug: string
  value: number
  sampleN: number
  windowMonths: number
}

export async function getCityLeaderboard(opts: {
  stat: string
  segment?: string
  limit?: number
}): Promise<LeaderboardRow[]> {
  const spec = STAT_BY_ID.get(opts.stat)
  if (!spec) return []
  const minN = spec.minN
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('geo_slug, value, sample_n, window_months')
    .eq('definition_id', DEFINITION_ID)
    .eq('stat_id', opts.stat)
    .eq('geo_type', 'city')
    .eq('segment', opts.segment ?? 'detached')
    .eq('is_publishable', true)
    .gte('sample_n', minN)
    .not('value', 'is', null)
    .order('value', { ascending: false })
    .limit(opts.limit ?? 16)
  if (error) throw new Error(`getCityLeaderboard: ${error.message}`)
  return (data ?? []).map((r) => ({
    geoSlug: String(r.geo_slug),
    value: Number(r.value),
    sampleN: Number(r.sample_n),
    windowMonths: Number(r.window_months),
  }))
}
