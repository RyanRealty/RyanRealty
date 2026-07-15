import { NextResponse } from 'next/server'
import { getSyncCursor, runOneFullSyncChunk } from '../../../actions/sync-full-cron'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Up to MAX_CHUNKS_PER_REQUEST (default 12) full-sync chunks per invocation —
// multi-minute work. Matches the cron-fleet convention (crm-sequence-engine,
// refresh-mvs): without it the project-default duration kills the run silently.
export const maxDuration = 300

const MAX_CHUNKS_PER_REQUEST = Math.max(1, Math.min(24, Number(process.env.SYNC_MAX_CHUNKS_PER_REQUEST ?? 12)))
const TERMINAL_ONLY_FLAG = (process.env.SYNC_TERMINAL_ONLY_MODE ?? '0').toLowerCase()
const SYNC_TERMINAL_ONLY_MODE =
  TERMINAL_ONLY_FLAG === '1' ||
  TERMINAL_ONLY_FLAG === 'true'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/sync-full
 * Run one chunk of full sync.
 * Uses a single shared execution path from app/actions/sync-full-cron to keep
 * cron and admin-triggered runs in sync.
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (SYNC_TERMINAL_ONLY_MODE) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'Full sync cron is disabled while terminal-history-only mode is enabled.',
    })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'

  const cursor = await getSyncCursor()
  if (cursor?.error) {
    return NextResponse.json(
      {
        error: 'sync_cursor table missing or inaccessible. Run migration: supabase/migrations/20250303230000_sync_cursor.sql',
        detail: cursor.error,
      },
      { status: 503 }
    )
  }
  if (cursor?.cronEnabled === false && !force) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'Sync cron is disabled. Enable it on the admin sync page when ready.',
    })
  }

  let chunkCount = 0
  let lastResult: Awaited<ReturnType<typeof runOneFullSyncChunk>> | null = null
  while (chunkCount < MAX_CHUNKS_PER_REQUEST) {
    const result = await runOneFullSyncChunk()
    lastResult = result
    chunkCount++
    if (!result.ok || result.done) break
  }
  if (!lastResult) {
    return NextResponse.json({ error: 'No sync chunks executed.' }, { status: 500 })
  }
  if (!lastResult.ok) {
    return NextResponse.json(
      { error: lastResult.error ?? lastResult.message, phase: lastResult.phase, chunksExecuted: chunkCount },
      { status: 500 }
    )
  }

  // Reporting phase hook: refresh pulse and current stats after sync work.
  try {
    const supabase = createServiceClient()
    await Promise.all([
      supabase.rpc('refresh_market_pulse'),
      supabase.rpc('refresh_current_period_stats'),
    ])
  } catch (error) {
    console.error('Post-sync reporting refresh failed', error)
  }

  return NextResponse.json({ ...lastResult, chunksExecuted: chunkCount })
}
