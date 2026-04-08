import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getAdminSyncCounts } from '@/app/actions/listings'
import { createClient } from '@supabase/supabase-js'
import {
  summarizeStrictVerifyHealth,
  type StrictVerifyHealthSummary,
  type StrictVerifyRunRow,
} from '@/lib/strict-verify-run-health'

export const dynamic = 'force-dynamic'

type CursorRow = {
  phase: string | null
  updated_at: string | null
  run_started_at: string | null
  error: string | null
}

type YearCursorRow = {
  current_year: number | null
  phase: string | null
  next_history_offset: number | null
  total_listings: number | null
  updated_at: string | null
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.max(0, (Date.now() - ts) / 60000)
}

type DbStrictVerifyRow = {
  completed_at: string
  ok: boolean | null
  query_succeeded: boolean | null
  processed: number | null
  marked_verified: number | null
  fetch_failures: number | null
  history_rows_inserted: number | null
  limit_param: number | null
  concurrency_param: number | null
  year_filter: number | null
  duration_ms: number | null
  error_message: string | null
}

function mapStrictVerifyRow(r: DbStrictVerifyRow): StrictVerifyRunRow {
  return {
    completed_at: r.completed_at,
    ok: Boolean(r.ok),
    query_succeeded: Boolean(r.query_succeeded),
    processed: Number(r.processed) || 0,
    marked_verified: Number(r.marked_verified) || 0,
    fetch_failures: Number(r.fetch_failures) || 0,
    history_rows_inserted: Number(r.history_rows_inserted) || 0,
    limit_param: r.limit_param ?? null,
    concurrency_param: r.concurrency_param ?? null,
    year_filter: r.year_filter ?? null,
    duration_ms: r.duration_ms ?? null,
    error_message: r.error_message ?? null,
  }
}

async function countTableRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string
): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return null
  return count ?? 0
}

export async function GET() {
  try {
    const supabaseAuth = await createServerClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
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
      return NextResponse.json({ ok: false, error: 'Supabase service role is not configured' }, { status: 503 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const [
      cursorRes,
      yearCursorRes,
      adminCounts,
      photosRows,
      videosRows,
      agentsRows,
      openHousesRows,
      statusHistoryRows,
      priceHistoryRows,
      strictVerifyRunsRes,
    ] = await Promise.all([
      supabase
        .from('sync_cursor')
        .select('phase, updated_at, run_started_at, error')
        .eq('id', 'default')
        .maybeSingle(),
      supabase
        .from('sync_year_cursor')
        .select('current_year, phase, next_history_offset, total_listings, updated_at')
        .eq('id', 'default')
        .maybeSingle(),
      getAdminSyncCounts(),
      countTableRows(supabase, 'listing_photos'),
      countTableRows(supabase, 'listing_videos'),
      countTableRows(supabase, 'listing_agents'),
      countTableRows(supabase, 'open_houses'),
      countTableRows(supabase, 'status_history'),
      countTableRows(supabase, 'price_history'),
      supabase
        .from('strict_verify_runs')
        .select(
          'completed_at, ok, query_succeeded, processed, marked_verified, fetch_failures, history_rows_inserted, limit_param, concurrency_param, year_filter, duration_ms, error_message'
        )
        .order('completed_at', { ascending: false })
        .limit(20),
    ])

    const cursor = (cursorRes.data ?? null) as CursorRow | null
    const yearCursor = (yearCursorRes.data ?? null) as YearCursorRow | null

    const terminalRemaining =
      adminCounts.closedNotFinalizedCount +
      adminCounts.expiredNotFinalizedCount +
      adminCounts.withdrawnNotFinalizedCount +
      adminCounts.canceledNotFinalizedCount

    const cursorMinutes = minutesSince(cursor?.updated_at ?? null)
    const yearCursorMinutes = minutesSince(yearCursor?.updated_at ?? null)
    const hasRecentListingHeartbeat = cursorMinutes != null && cursorMinutes <= 20
    const hasRecentYearHeartbeat = yearCursorMinutes != null && yearCursorMinutes <= 20

    const isLikelyRunning =
      (cursor?.phase === 'history' || cursor?.phase === 'listings') && hasRecentListingHeartbeat ||
      (yearCursor?.phase != null && yearCursor.phase !== 'idle' && hasRecentYearHeartbeat)

    const isStalled =
      terminalRemaining > 0 &&
      !isLikelyRunning &&
      (cursorMinutes == null || cursorMinutes > 45) &&
      (yearCursorMinutes == null || yearCursorMinutes > 45)

    const mediaCoverage = {
      listingPhotosRows: photosRows,
      listingVideosRows: videosRows,
      listingAgentsRows: agentsRows,
      openHousesRows,
      statusHistoryRows,
      priceHistoryRows,
      allAuxiliaryTablesPopulated:
        (photosRows ?? 0) > 0 &&
        (videosRows ?? 0) > 0 &&
        (agentsRows ?? 0) > 0 &&
        (openHousesRows ?? 0) > 0 &&
        (statusHistoryRows ?? 0) > 0 &&
        (priceHistoryRows ?? 0) > 0,
    }

    const terminalStrictBacklog = adminCounts.terminalStrictVerifyBacklogCount
    let strictVerifyTelemetry: {
      tableReady: boolean
      tableError: string | null
      health: StrictVerifyHealthSummary | null
      recentRuns: StrictVerifyRunRow[]
      etaMinutesRough: number | null
      etaNote: string
    }
    if (strictVerifyRunsRes.error) {
      strictVerifyTelemetry = {
        tableReady: false,
        tableError: strictVerifyRunsRes.error.message,
        health: null,
        recentRuns: [],
        etaMinutesRough: null,
        etaNote:
          'Apply migration 20260408190000_strict_verify_run_log.sql so cron runs are logged, or fix database permissions.',
      }
    } else {
      const recentRuns = (strictVerifyRunsRes.data ?? []).map((row) =>
        mapStrictVerifyRow(row as DbStrictVerifyRow)
      )
      const health = summarizeStrictVerifyHealth(recentRuns, terminalStrictBacklog)
      const avg = health.avgMarkedVerifiedLast5
      const etaMinutesRough =
        terminalStrictBacklog > 0 && avg != null && avg > 0.05
          ? Math.round(terminalStrictBacklog / avg)
          : null
      strictVerifyTelemetry = {
        tableReady: true,
        tableError: null,
        health,
        recentRuns: recentRuns.slice(0, 5),
        etaMinutesRough,
        etaNote:
          'Rough ETA assumes about one successful cron per minute and recent average marked_verified. Actual time varies with Spark latency and failures.',
      }
    }

    return NextResponse.json(
      {
        ok: true,
        checkedAt: new Date().toISOString(),
        status: {
          state: terminalRemaining === 0 ? 'complete' : isStalled ? 'stalled' : isLikelyRunning ? 'running' : 'idle',
          isLikelyRunning,
          isStalled,
        },
        cursor: {
          phase: cursor?.phase ?? 'unknown',
          updatedAt: cursor?.updated_at ?? null,
          runStartedAt: cursor?.run_started_at ?? null,
          error: cursor?.error ?? null,
          minutesSinceUpdate: cursorMinutes,
        },
        yearCursor: {
          currentYear: yearCursor?.current_year ?? null,
          phase: yearCursor?.phase ?? null,
          nextHistoryOffset: yearCursor?.next_history_offset ?? null,
          totalListings: yearCursor?.total_listings ?? null,
          updatedAt: yearCursor?.updated_at ?? null,
          minutesSinceUpdate: yearCursorMinutes,
        },
        totals: {
          totalListings: adminCounts.totalListings,
          totalHistoryRows: adminCounts.historyCount,
          finalizedTerminalListings: adminCounts.historyFinalizedCount,
          verifiedFullHistoryListings: adminCounts.historyVerifiedFullCount,
          finalizedUnverifiedListings: adminCounts.historyFinalizedUnverifiedCount,
          terminalStrictVerifyBacklogListings: adminCounts.terminalStrictVerifyBacklogCount,
          terminalRemainingListings: terminalRemaining,
          terminalFinalizedBreakdown: {
            closed: adminCounts.closedFinalizedCount,
            expired: adminCounts.expiredFinalizedCount,
            withdrawn: adminCounts.withdrawnFinalizedCount,
            canceled: adminCounts.canceledFinalizedCount,
          },
        },
        integrity: {
          historyFinalizedDefinition: 'history_finalized=true',
          hasListingsCountError: Boolean(adminCounts.listingsCountError),
          hasHistoryCountError: Boolean(adminCounts.historyError),
          listingsCountError: adminCounts.listingsCountError ?? null,
          historyCountError: adminCounts.historyError ?? null,
        },
        mediaCoverage,
        strictVerifyTelemetry,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
