import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runOneFullSyncChunk } from '@/app/actions/sync-full-cron'
import { syncListingHistory, syncSparkListingsDelta } from '@/app/actions/sync-spark'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    const auth = request.headers.get('authorization')
    return auth === `Bearer ${secret}`
  }
  return true
}

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

type CursorRow = {
  id: string
  phase: string | null
  paused: boolean | null
  abort_requested: boolean | null
  cron_enabled: boolean | null
  error: string | null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const terminalLimit = parseIntParam(searchParams.get('terminal_limit'), 200, 1, 200)
  const deltaPages = parseIntParam(searchParams.get('delta_pages'), 20, 1, 200)
  const nowIso = new Date().toISOString()

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: beforeCursor } = await supabase
    .from('sync_cursor')
    .select('id, phase, paused, abort_requested, cron_enabled, error')
    .eq('id', 'default')
    .maybeSingle()

  const { error: cursorError } = await supabase.from('sync_cursor').upsert(
    {
      id: 'default',
      paused: false,
      abort_requested: false,
      cron_enabled: true,
      error: null,
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  )
  if (cursorError) {
    return NextResponse.json({ ok: false, error: cursorError.message }, { status: 500 })
  }

  async function runFullChunkWithRecovery() {
    const first = await runOneFullSyncChunk()
    if (first.ok) return { result: first, recovered: false, warning: null as string | null }
    const errorText = String(first.error ?? first.message ?? '').toLowerCase()
    const timedOut = errorText.includes('statement timeout') || errorText.includes('57014')
    if (!timedOut) return { result: first, recovered: false, warning: null as string | null }

    const retry = await runOneFullSyncChunk()
    if (retry.ok) {
      return { result: retry, recovered: true, warning: 'fullChunk recovered after timeout retry' }
    }
    return {
      result: retry,
      recovered: false,
      warning: 'fullChunk timeout persisted; other lanes started and cron will continue retrying',
    }
  }

  const [fullChunkResult, terminalChunk, deltaChunk] = await Promise.all([
    runFullChunkWithRecovery(),
    syncListingHistory({
      activeAndPendingOnly: false,
      limit: terminalLimit,
      offset: 0,
      workerCount: 1,
      workerIndex: 0,
    }),
    syncSparkListingsDelta({
      maxPages: deltaPages,
      pageSize: 100,
    }),
  ])
  const fullChunk = fullChunkResult.result
  const fullChunkRecoverableWarning = fullChunkResult.warning

  const { data: afterCursor } = await supabase
    .from('sync_cursor')
    .select('id, phase, paused, abort_requested, cron_enabled, error, updated_at, run_started_at')
    .eq('id', 'default')
    .maybeSingle()

  const hardFail = !terminalChunk.success || !deltaChunk.success
  const ok = !hardFail
  return NextResponse.json(
    {
      ok,
      message: ok
        ? 'Sync lanes restarted and kick-run completed.'
        : 'Sync start attempted; one or more lanes returned an error.',
      warnings: [fullChunkRecoverableWarning].filter(Boolean),
      confirmations: {
        blockersCleared: {
          before: (beforeCursor as CursorRow | null) ?? null,
          after: afterCursor ?? null,
        },
        lanesStarted: {
          fullChunk,
          fullChunkRecovered: fullChunkResult.recovered,
          terminalChunk,
          deltaChunk,
        },
      },
      generatedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 500 }
  )
}
