import { NextResponse } from 'next/server'
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

/**
 * GET /api/cron/sync-parity
 *
 * One "parity chunk" call:
 * 1) Run smart sync cursor chunk (listings/history via runOneFullSyncChunk)
 * 2) Run terminal-history chunk (closed/expired/withdrawn/canceled)
 * 3) Run delta sync chunk (fresh changes)
 *
 * This gives one endpoint to call repeatedly from cron until parity reaches zero.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workerCount = parseIntParam(searchParams.get('worker_count'), 1, 1, 16)
  const workerIndex = parseIntParam(searchParams.get('worker_index'), 0, 0, workerCount - 1)
  const terminalLimit = parseIntParam(searchParams.get('terminal_limit'), 200, 1, 200)
  const deltaPages = parseIntParam(searchParams.get('delta_pages'), 20, 1, 200)
  const fromYearRaw = Number.parseInt(searchParams.get('from_year') ?? '', 10)
  const toYearRaw = Number.parseInt(searchParams.get('to_year') ?? '', 10)
  const fromYear = Number.isFinite(fromYearRaw) && fromYearRaw > 0 ? fromYearRaw : undefined
  const toYear = Number.isFinite(toYearRaw) && toYearRaw > 0 ? toYearRaw : undefined

  const fullChunk = await runOneFullSyncChunk()
  const terminalChunk = await syncListingHistory({
    activeAndPendingOnly: false,
    limit: terminalLimit,
    offset: 0,
    workerCount,
    workerIndex,
    terminalFromYear: fromYear,
    terminalToYear: toYear,
  })
  const deltaChunk = await syncSparkListingsDelta({
    maxPages: deltaPages,
    pageSize: 100,
  })

  const ok = fullChunk.ok && terminalChunk.success && deltaChunk.success
  const status = ok ? 200 : 500

  return NextResponse.json(
    {
      ok,
      message: ok
        ? 'Parity chunk completed.'
        : 'Parity chunk completed with one or more lane failures.',
      fullChunk,
      terminalChunk,
      deltaChunk,
      params: {
        workerCount,
        workerIndex,
        terminalLimit,
        deltaPages,
        fromYear: fromYear ?? null,
        toYear: toYear ?? null,
      },
      generatedAt: new Date().toISOString(),
    },
    { status }
  )
}
