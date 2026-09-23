/**
 * place_membership freshness for the company scoreboard.
 *
 * Every Market Truth cell (market_metric) joins public.place_membership, so a
 * stale membership table silently drops new listings from every active count,
 * median list price and months-of-supply verdict at every grain. It went stale
 * once already: the keyset refresh ran by hand on 2026-08-23 and never again,
 * and by 2026-09-23 242 of 1,228 Bend Active listings had no membership row
 * and the published Bend verdict read "seller's" at 3.30 months where the full
 * membership reads "balanced" at 4.26 (audit COMP-3, package P9).
 *
 * Source order: the mv_refresh_state row 'place_membership' that
 * refresh_place_membership_changed() stamps on every successful run
 * (migration 20260923014500, pg_cron every 15 minutes); when that row does not
 * exist yet, the newest place_membership.computed_at.
 * reachability: collectCompanyScoreboardSignals (lib/data/loop/signals.ts)
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Older than this and the scoreboard is degraded. The job runs every 15 minutes. */
export const PLACE_MEMBERSHIP_STALE_HOURS = 48

export type PlaceMembershipFreshness = {
  status: 'ok' | 'unreadable'
  freshness: 'fresh' | 'stale' | 'unknown'
  newestAt: string | null
  ageHours: number | null
  source: string
}

/** Pure: classify a newest-refresh timestamp against the 48-hour line. */
export function classifyPlaceMembershipFreshness(
  newestAt: string | null | undefined,
  now: Date,
): { freshness: 'fresh' | 'stale' | 'unknown'; ageHours: number | null } {
  if (!newestAt) return { freshness: 'unknown', ageHours: null }
  const at = Date.parse(newestAt)
  if (!Number.isFinite(at)) return { freshness: 'unknown', ageHours: null }
  const ageHours = Math.max(0, (now.getTime() - at) / 3_600_000)
  return {
    freshness: ageHours > PLACE_MEMBERSHIP_STALE_HOURS ? 'stale' : 'fresh',
    ageHours: Math.round(ageHours * 10) / 10,
  }
}

export async function readPlaceMembershipFreshness(
  sb: SupabaseClient,
  now: Date,
): Promise<PlaceMembershipFreshness> {
  const stamp = await sb
    .from('mv_refresh_state')
    .select('refreshed_at')
    .eq('mv_name', 'place_membership')
    .maybeSingle()
  if (!stamp.error && typeof stamp.data?.refreshed_at === 'string') {
    const c = classifyPlaceMembershipFreshness(stamp.data.refreshed_at, now)
    return {
      status: 'ok',
      ...c,
      newestAt: stamp.data.refreshed_at,
      source: "mv_refresh_state mv_name='place_membership' (refresh_place_membership_changed)",
    }
  }

  // No stamp yet (migration not applied): the newest row the table holds.
  const newest = await sb
    .from('place_membership')
    .select('computed_at')
    .order('computed_at', { ascending: false })
    .limit(1)
  if (newest.error) {
    return {
      status: 'unreadable',
      freshness: 'unknown',
      newestAt: null,
      ageHours: null,
      source: `place_membership.computed_at unreadable: ${newest.error.message}`,
    }
  }
  const newestAt = (newest.data?.[0]?.computed_at as string | undefined) ?? null
  return {
    status: 'ok',
    ...classifyPlaceMembershipFreshness(newestAt, now),
    newestAt,
    source: 'place_membership max(computed_at) by row read (no mv_refresh_state stamp yet)',
  }
}
