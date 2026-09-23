import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { refreshChangedPlaceMembership } from '@/lib/data/market-truth/refreshPlaceMembership'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// One ~10s MV refresh (neighborhood_year_pricing_mv, 2026-08-19 measure) plus a
// place_membership pass capped at 150s (about 0.4s per rebuilt listing run,
// measured 2026-09-23; an hour of MLS changes is a few dozen listings).
export const maxDuration = 300

/**
 * GET /api/cron/refresh-mvs — hourly at :08 (vercel.json). TRANSITIONAL.
 *
 * pg_cron owns every DAL materialized view refresh:
 *   refresh_listing_tile_mv_30min  :02/:32  listing_tile_mv
 *   refresh_dal_mvs_15min          :05/:20/:35/:50  geo_snapshot_mv,
 *                                  listing_boundary_xref_mv, listing_search_mv
 *   (supabase/migrations/20260731140000_split_mv_refresh_jobs.sql)
 *
 * This route used to call all four of those again every hour, plus
 * refresh_neighborhood_year_pricing_mv. The duplicate
 * refresh_listing_boundary_xref_mv had no advisory lock, queued behind the
 * pg_cron job's in-flight refresh of the same MV, came back ok:false and
 * turned the whole route into a 500 (audit DATA-2, 2026-09-22). The
 * duplicates are gone; the route now runs only the two jobs nothing else
 * schedules yet (neighborhood_year_pricing_mv below, place_membership after it).
 *
 * Migration 20260923014600_mv_refresh_pg_cron_owns_neighborhood_year_pricing
 * adds refresh_neighborhood_year_pricing_mv to refresh_dal_mvs_15min and gives
 * it advisory lock 7108 (a concurrent duplicate returns skipped). Delete this
 * route and its vercel.json entry only when BOTH pending migrations are applied:
 * mv_refresh_state holds a 'neighborhood_year_pricing_mv' stamp (20260923014600)
 * AND a 'place_membership' stamp (20260923014500, below). Deleting it BEFORE
 * then would stop the neighborhood chart-room pricing, or place_membership,
 * from refreshing at all.
 *
 * SECOND TRANSITIONAL DUTY: place_membership (audit COMP-3). Every Market Truth
 * cell joins it and nothing refreshed it after the one hand-run build of
 * 2026-08-23, so new listings dropped out of every published count and verdict
 * (Bend read 3.30 months "seller's" on 579 actives where the full set read
 * 4.26 "balanced"). Migration 20260923014500 puts
 * refresh_place_membership_changed() on pg_cron every 15 minutes. Until it is
 * applied this route runs the same candidate rule hourly at :08, after
 * sync-delta's :03 write and ahead of the 6-hourly Market Truth computes at
 * :20/:40/:50 (lib/data/market-truth/refreshPlaceMembership.ts). Once the
 * migration is applied the helper just calls that function (advisory lock 7109
 * makes an overlap with the pg_cron job a skip).
 *
 * Auth: Authorization: Bearer CRON_SECRET
 * Returns: { ok, ran_at, neighborhood_year_pricing_mv: {...},
 *   place_membership: {...}, duration_ms }
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const startMs = Date.now()
  const ranAt = new Date().toISOString()

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[refresh-mvs] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  // neighborhood_year_pricing_mv — the per-Bend-district, per-year closed
  // single-family aggregate behind the neighborhood page's chart-room forms.
  // It derives from listing_tile_mv (polygon assignment against
  // public.boundaries), which pg_cron refreshes at :02/:32, so :08 reads a
  // tile state at most six minutes old.
  const nbhStart = Date.now()
  const { data: nbhData, error: nbhError } = await supabase.rpc(
    'refresh_neighborhood_year_pricing_mv',
  )
  const nbhResult = {
    ok: !nbhError && nbhData?.ok !== false,
    skipped: nbhData?.skipped === true,
    duration_ms: Date.now() - nbhStart,
    rpc_duration_ms: nbhData?.duration_ms ?? null,
    error: nbhError?.message ?? nbhData?.error ?? null,
  }

  // place_membership — rebuild listings that changed since their membership
  // rows were written. Fails closed into the response (ok:false, 500) so a
  // stall shows in the cron log; the scoreboard also flags it past 48 hours.
  let membership: Awaited<ReturnType<typeof refreshChangedPlaceMembership>> | { ok: false; error: string }
  try {
    membership = await refreshChangedPlaceMembership(supabase, { budgetMs: 150_000 })
  } catch (err) {
    membership = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  if (!membership.ok) console.error('[refresh-mvs] place_membership', membership.error)

  const ok = nbhResult.ok && membership.ok
  return NextResponse.json(
    {
      ok,
      ran_at: ranAt,
      neighborhood_year_pricing_mv: nbhResult,
      place_membership: membership,
      duration_ms: Date.now() - startMs,
    },
    { status: ok ? 200 : 500 },
  )
}
