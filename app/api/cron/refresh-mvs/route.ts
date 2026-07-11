import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Max 60s for the refresh window — both MVs CONCURRENTLY refresh in
// ~35s each as of 2026-05-22 (589,724-row listings → listing_tile_mv;
// 362+6486+15-row geo_snapshot_mv). Allow 5 min of headroom so we don't
// hit the serverless ceiling as the listings table grows.
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/refresh-mvs
 *
 * Refreshes the DAL materialized views applied in migrations 20260522144509
 * (listing_tile_mv), 20260522144510 (geo_snapshot_mv), 20260529020000
 * (listing_boundary_xref_mv — the precomputed listing→boundary spatial join
 * behind every map's pins + homes-for-sale cards), and 20260711160000
 * (listing_search_mv — the on-market search MV carrying every filterable
 * field for voice + screen search). All refreshed CONCURRENTLY so user
 * reads keep working during the refresh.
 *
 * Schedule: every 15 minutes via vercel.json.
 *
 * Why a separate cron and not inline in sync-delta?
 *   - listing_tile_mv refresh ~ 30-40s CONCURRENTLY (589K rows).
 *   - geo_snapshot_mv refresh ~ 35s CONCURRENTLY (aggregate over same).
 *   - sync-delta's own work + the 75s of refresh would push past the
 *     Vercel cron serverless timeout.
 *   - Decoupling means a stuck refresh doesn't block sync-delta, and
 *     vice versa. They each get their own observability surface.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * Returns: { ok, ran_at, listing_tile_mv: {...}, geo_snapshot_mv: {...},
 *   listing_boundary_xref_mv: {...}, listing_search_mv: {...}, duration_ms }
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // listing_tile_mv first — drives every LP route's tile rendering.
  const tileStart = Date.now()
  const { data: tileData, error: tileError } = await supabase.rpc(
    'refresh_listing_tile_mv',
  )
  const tileMs = Date.now() - tileStart
  const tileResult = {
    ok: !tileError && tileData?.ok !== false,
    duration_ms: tileMs,
    rpc_duration_ms: tileData?.duration_ms ?? null,
    error: tileError?.message ?? tileData?.error ?? null,
  }

  // geo_snapshot_mv second — drives city/community/neighborhood
  // hero stat panels + the homepage city grid.
  const geoStart = Date.now()
  const { data: geoData, error: geoError } = await supabase.rpc(
    'refresh_geo_snapshot_mv',
  )
  const geoMs = Date.now() - geoStart
  const geoResult = {
    ok: !geoError && geoData?.ok !== false,
    duration_ms: geoMs,
    rpc_duration_ms: geoData?.duration_ms ?? null,
    error: geoError?.message ?? geoData?.error ?? null,
  }

  // listing_boundary_xref_mv third — the precomputed listing→boundary spatial
  // join that drives the boundary-map pins + homes-for-sale cards on every
  // city/neighborhood/community page (getGeoBoundaryMapData → listings_in_boundary).
  // Keeps the in-polygon set current as listings change status / come on market.
  const xrefStart = Date.now()
  const { data: xrefData, error: xrefError } = await supabase.rpc(
    'refresh_listing_boundary_xref_mv',
  )
  const xrefMs = Date.now() - xrefStart
  const xrefResult = {
    ok: !xrefError && xrefData?.ok !== false,
    duration_ms: xrefMs,
    rpc_duration_ms: xrefData?.duration_ms ?? null,
    error: xrefError?.message ?? xrefData?.error ?? null,
  }

  // listing_search_mv fourth — the on-market search MV behind
  // searchListingsAll (every filterable field: feature arrays, schools,
  // HOA, taxes, terms). ~9.8K rows, refreshes in seconds.
  const searchStart = Date.now()
  const { data: searchData, error: searchError } = await supabase.rpc(
    'refresh_listing_search_mv',
  )
  const searchMs = Date.now() - searchStart
  const searchResult = {
    ok: !searchError && searchData?.ok !== false,
    duration_ms: searchMs,
    rpc_duration_ms: searchData?.duration_ms ?? null,
    error: searchError?.message ?? searchData?.error ?? null,
  }

  const ok = tileResult.ok && geoResult.ok && xrefResult.ok && searchResult.ok

  return NextResponse.json(
    {
      ok,
      ran_at: ranAt,
      listing_tile_mv: tileResult,
      geo_snapshot_mv: geoResult,
      listing_boundary_xref_mv: xrefResult,
      listing_search_mv: searchResult,
      duration_ms: Date.now() - startMs,
    },
    { status: ok ? 200 : 500 },
  )
}
