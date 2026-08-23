/**
 * Registry leaderboards. Internal (admin) until Step 9 public grains exist.
 * min_n inherited from the registry. No office ranking here.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID, STAT_BY_ID } from '@/lib/data/market-truth/registry'
import {
  collapseLeaderboardRows,
  type LeaderboardRow,
  type RawLeaderboardRow,
} from '@/lib/data/market-truth/leaderboard-collapse'

export type { LeaderboardRow } from '@/lib/data/market-truth/leaderboard-collapse'
export { collapseLeaderboardRows } from '@/lib/data/market-truth/leaderboard-collapse'

export async function getCityLeaderboard(opts: {
  stat: string
  segment?: string
  limit?: number
  /** Default false (value DESC). True for fastest-to-contract and largest YoY drop. */
  ascending?: boolean
}): Promise<LeaderboardRow[]> {
  const spec = STAT_BY_ID.get(opts.stat)
  if (!spec) return []
  const minN = spec.minN
  const limit = opts.limit ?? 16
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('geo_slug, value, sample_n, window_months, period_end, computed_at')
    .eq('definition_id', DEFINITION_ID)
    .eq('stat_id', opts.stat)
    .eq('geo_type', 'city')
    .eq('segment', opts.segment ?? 'detached')
    .eq('is_publishable', true)
    .gte('sample_n', minN)
    .not('value', 'is', null)
    .limit(Math.max(limit * 8, 96))
  if (error) throw new Error(`getCityLeaderboard: ${error.message}`)
  return collapseLeaderboardRows((data ?? []) as RawLeaderboardRow[], {
    ascending: opts.ascending ?? false,
    limit,
  })
}
