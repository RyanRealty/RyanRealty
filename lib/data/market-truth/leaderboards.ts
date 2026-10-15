/**
 * Registry leaderboards. Internal (admin) until Step 9 public grains exist.
 * min_n inherited from the registry. No office ranking here.
 */
import { createServiceClient } from '@/lib/data/client'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { DEFINITION_ID, STAT_BY_ID } from '@/lib/data/market-truth/registry'
import {
  collapseLeaderboardRows,
  type LeaderboardRow,
  type RawLeaderboardRow,
} from '@/lib/data/market-truth/leaderboard-collapse'

export type { LeaderboardRow } from '@/lib/data/market-truth/leaderboard-collapse'
export { collapseLeaderboardRows } from '@/lib/data/market-truth/leaderboard-collapse'

async function fetchCityLeaderboard(encoded: string): Promise<LeaderboardRow[]> {
  const opts = JSON.parse(encoded) as {
    stat: string
    segment: string
    limit: number
    ascending: boolean
  }
  const spec = STAT_BY_ID.get(opts.stat)
  if (!spec) return []
  const minN = spec.minN
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('geo_slug, value, sample_n, window_months, period_end, computed_at')
    .eq('definition_id', DEFINITION_ID)
    .eq('stat_id', opts.stat)
    .eq('geo_type', 'city')
    .eq('segment', opts.segment)
    .eq('is_publishable', true)
    .gte('sample_n', minN)
    .not('value', 'is', null)
    .limit(Math.max(opts.limit * 8, 96))
  if (error) throw new Error(`getCityLeaderboard: ${error.message}`)
  return collapseLeaderboardRows((data ?? []) as RawLeaderboardRow[], {
    ascending: opts.ascending,
    limit: opts.limit,
  })
}

const loadCityLeaderboardCached = unstable_cache(
  fetchCityLeaderboard,
  ['market-metric-leaderboard-v1'],
  { revalidate: CACHE_WINDOWS.marketMetric, tags: [cacheTag.market] },
)

export async function getCityLeaderboard(opts: {
  stat: string
  segment?: string
  limit?: number
  /** Default false (value DESC). True for fastest-to-contract and largest YoY drop. */
  ascending?: boolean
}): Promise<LeaderboardRow[]> {
  const spec = STAT_BY_ID.get(opts.stat)
  if (!spec) return []
  return loadCityLeaderboardCached(
    JSON.stringify({
      stat: opts.stat,
      segment: opts.segment ?? 'detached',
      limit: opts.limit ?? 16,
      ascending: opts.ascending ?? false,
    }),
  )
}
