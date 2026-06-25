/**
 * CRM bulk-job worker — drains queued/running bulk jobs in fixed-size chunks so a
 * single mutation can cover the full ~18K contact book without ever timing out a
 * request. Resumable: each run claims the oldest job, resolves its id set, runs
 * the registered handler over the next ~250 ids from the `processed` offset, then
 * persists progress. The job finishes when every selected row is drained.
 *
 * Never throws to the cron caller — every failure returns a JSON status so a
 * Vercel cron retry never sees a 500 it can thunder against.
 */

import { NextResponse } from 'next/server'
import {
  claimNextChunk,
  getBulkHandler,
  markChunkProgress,
  markJob,
  normalizeResult,
  selectionIds,
  chunkIds,
  isDrained,
  type BulkContext,
} from '@/lib/crm/bulk-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// How many chunks to drain per cron invocation. Each chunk is ~250 rows; several
// chunks per run keep the queue moving while staying inside maxDuration.
const CHUNKS_PER_RUN = 4

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const startMs = Date.now()

  let claimedJobId: number | null = null
  let chunksRun = 0
  let rowsProcessed = 0
  let drained = false
  let status: 'idle' | 'progress' | 'done' | 'error' = 'idle'
  let errorMsg: string | null = null

  try {
    for (let i = 0; i < CHUNKS_PER_RUN; i++) {
      const claim = await claimNextChunk()
      if (!claim) {
        status = chunksRun > 0 ? (drained ? 'done' : 'progress') : 'idle'
        break
      }
      const { job } = claim
      claimedJobId = job.id

      const handler = getBulkHandler(job.kind)
      if (!handler) {
        await markJob(job.id, { status: 'failed', error: `no handler registered for kind "${job.kind}"` })
        status = 'error'
        errorMsg = `no handler for kind "${job.kind}"`
        break
      }

      // Resolve the frozen id set for this job.
      let ids = selectionIds(job.selection)
      if (ids === null) {
        // ast-mode: resolve the saved-view / filter AST to a concrete id set, then
        // freeze it onto the job as {ids:[...]} so every subsequent chunk is
        // deterministic and resumable (identical to ids-mode from here on).
        //
        // TODO(wave-3): import buildCrmPeopleQuery from the CRM reads DAL and run
        // it under the FROZEN job.broker_scope to produce the id list, e.g.
        //   const resolved = await resolveAstToIds(job.selection.ast, job.broker_scope)
        //   await markJob(job.id, { selection: { ids: resolved }, total: resolved.length })
        // buildCrmPeopleQuery is NOT available in this sandbox, so ast-mode jobs
        // are parked as failed rather than silently doing nothing.
        await markJob(job.id, {
          status: 'failed',
          error: 'ast-mode selection not yet supported (wave-3: wire buildCrmPeopleQuery)',
        })
        status = 'error'
        errorMsg = 'ast-mode not supported yet'
        break
      }

      // Set total on first touch if it was not stamped at enqueue.
      if (job.total === null || job.total === undefined) {
        await markJob(job.id, { total: ids.length })
        job.total = ids.length
      }

      // Already fully drained (resume after the last chunk) -> finish.
      if (isDrained(job.total ?? ids.length, job.processed)) {
        await markJob(job.id, { status: 'done' })
        drained = true
        status = 'done'
        break
      }

      const chunk = chunkIds(ids, job.processed)
      if (chunk.length === 0) {
        await markJob(job.id, { status: 'done' })
        drained = true
        status = 'done'
        break
      }

      const ctx: BulkContext = {
        jobId: job.id,
        actorEmail: job.actor_email,
        brokerScope: job.broker_scope,
      }

      let result
      try {
        result = normalizeResult(await handler(chunk, job.params ?? {}, ctx))
      } catch (e) {
        // A handler blow-up fails the job (visible, not silent) rather than
        // looping the same chunk forever.
        await markJob(job.id, {
          status: 'failed',
          error: `handler "${job.kind}" threw: ${e instanceof Error ? e.message : String(e)}`,
        })
        status = 'error'
        errorMsg = e instanceof Error ? e.message : String(e)
        break
      }

      await markChunkProgress(
        job.id,
        { processed: job.processed, skipped: job.skipped, breakdown: job.breakdown },
        result,
      )
      chunksRun++
      rowsProcessed += chunk.length
      status = 'progress'

      const newProcessed = job.processed + result.processed + result.skipped
      if (isDrained(job.total ?? ids.length, newProcessed)) {
        await markJob(job.id, { status: 'done' })
        drained = true
        status = 'done'
        break
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      jobId: claimedJobId,
      chunksRun,
      rowsProcessed,
      drained,
      error: errorMsg,
      duration_ms: Date.now() - startMs,
    })
  } catch (e) {
    // Last-resort guard: never let the cron caller see a 500.
    return NextResponse.json({
      ok: false,
      status: 'error',
      jobId: claimedJobId,
      chunksRun,
      rowsProcessed,
      error: e instanceof Error ? e.message : String(e),
      duration_ms: Date.now() - startMs,
    })
  }
}
