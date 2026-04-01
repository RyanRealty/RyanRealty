import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export const dynamic = 'force-dynamic'

type YearLaneCursorRow = {
  current_year: number | null
  phase: string | null
  next_listing_page: number | null
  next_history_offset: number | null
  total_listings: number | null
  updated_at: string | null
}

type YearLaneProgressRow = {
  runStatus?: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  runPhase?: string | null
  processedListings?: number
  totalListings?: number
  listingsUpserted?: number
  historyInserted?: number
  listingsFinalized?: number
  finalizedListings?: number
  lastSyncedAt?: string | null
  lastError?: string | null
  runUpdatedAt?: string | null
}

type YearLanePayload = {
  id: 'current_year' | 'historical_backfill'
  label: string
  targetYear: number | null
  phase: string | null
  runStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  processedListings: number
  totalListings: number | null
  listingsUpserted: number
  historyInserted: number
  listingsFinalized: number
  finalizedListings: number | null
  lastSyncedAt: string | null
  lastError: string | null
  updatedAt: string | null
}

function readYearProgress(
  cacheRows: Record<string, YearLaneProgressRow> | null | undefined,
  year: number | null
): YearLaneProgressRow | null {
  if (!cacheRows || year == null) return null
  return cacheRows[String(year)] ?? null
}

function buildLanePayload(input: {
  id: 'current_year' | 'historical_backfill'
  label: string
  cursor: YearLaneCursorRow | null
  progress: YearLaneProgressRow | null
}): YearLanePayload {
  const { id, label, cursor, progress } = input
  const isRunning = cursor?.phase != null && cursor.phase !== 'idle' && cursor.current_year != null
  return {
    id,
    label,
    targetYear: cursor?.current_year ?? null,
    phase: isRunning ? cursor?.phase ?? null : progress?.runPhase ?? null,
    runStatus: isRunning ? 'running' : (progress?.runStatus ?? 'idle'),
    processedListings: isRunning
      ? Number(cursor?.next_history_offset ?? progress?.processedListings ?? 0)
      : Number(progress?.processedListings ?? 0),
    totalListings: isRunning
      ? (cursor?.total_listings ?? progress?.totalListings ?? null)
      : (progress?.totalListings ?? null),
    listingsUpserted: Number(progress?.listingsUpserted ?? 0),
    historyInserted: Number(progress?.historyInserted ?? 0),
    listingsFinalized: Number(progress?.listingsFinalized ?? 0),
    finalizedListings: progress?.finalizedListings ?? null,
    lastSyncedAt: progress?.lastSyncedAt ?? null,
    lastError: progress?.lastError ?? null,
    updatedAt: cursor?.updated_at ?? progress?.runUpdatedAt ?? null,
  }
}

export async function GET() {
  try {
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getAdminRoleForEmail(user.email)
    if (!role) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
      return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const [{ data: cursors }, { data: stateRow }] = await Promise.all([
      supabase
        .from('sync_year_cursor')
        .select('id, current_year, phase, next_listing_page, next_history_offset, total_listings, updated_at')
        .in('id', ['default', 'current-year']),
      supabase
        .from('sync_state')
        .select('year_sync_matrix_cache')
        .eq('id', 'default')
        .maybeSingle(),
    ])

    const cursorById = new Map<string, YearLaneCursorRow>()
    for (const row of (cursors ?? []) as Array<YearLaneCursorRow & { id?: string }>) {
      if (row.id) cursorById.set(row.id, row)
    }

    const cacheRows = ((stateRow as { year_sync_matrix_cache?: { rows?: Record<string, YearLaneProgressRow> } } | null)
      ?.year_sync_matrix_cache?.rows) ?? {}

    const currentYearCursor = cursorById.get('current-year') ?? null
    const historicalCursor = cursorById.get('default') ?? null

    const lanes: YearLanePayload[] = [
      buildLanePayload({
        id: 'current_year',
        label: '2026 now',
        cursor: currentYearCursor,
        progress: readYearProgress(cacheRows, currentYearCursor?.current_year ?? null),
      }),
      buildLanePayload({
        id: 'historical_backfill',
        label: 'Historical backfill',
        cursor: historicalCursor,
        progress: readYearProgress(cacheRows, historicalCursor?.current_year ?? null),
      }),
    ]

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      lanes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
