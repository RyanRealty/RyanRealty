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
  type BulkSelection,
} from '@/lib/crm/bulk-jobs'
// Side-effect import: registers every real bulk mutation handler
// (crm:assign-broker / add-tag / remove-tag / set-stage / enroll-workflow /
// set-report-subscription) so getBulkHandler resolves them at runtime.
import '@/lib/crm/bulk-handlers'
import { createServiceClient } from '@/lib/supabase/service'
import { validateSegment } from '@/lib/crm/segment-ast'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'

/**
 * Resolve an ast-mode selection to a concrete, ordered id list under the FROZEN
 * job broker_scope. Pages the resolver in fixed windows so a full-book audience
 * (~18K) never exceeds PostgREST's single-response row cap. Same compiler the
 * list view + count + audience use, so the bulk id set can never drift from what
 * the operator saw on screen. Returns ids in a stable order (the resolver's
 * last_activity / created ordering) so chunking by offset is deterministic.
 */
/** Fetch one page of ids for a segment under scope. Injectable so the paging
 *  loop is unit-testable without a live database. */
export type AstPageFetcher = (
  ast: unknown,
  brokerScope: string | null,
  page: { limit: number; offset: number },
) => Promise<number[]>

/** Default page size for ast resolution — well under PostgREST's response cap. */
export const AST_RESOLVE_PAGE = 1000

const defaultPageFetcher: AstPageFetcher = async (ast, brokerScope, page) => {
  const segment = validateSegment(ast)
  const sb = createServiceClient()
  // The resolver returns the people-list select; we only read id off each row.
  // (The compiled query is a filter/transform builder with no .select() to
  // override, so we take the full select and project id here.)
  const { query } = buildCrmPeopleQuery(sb, segment, brokerScope, { limit: page.limit, offset: page.offset })
  const { data, error } = await query
  if (error) throw new Error(`ast resolution failed: ${error.message}`)
  return ((data ?? []) as Array<{ id: number }>).map((r) => r.id)
}

/**
 * Resolve an ast-mode selection to a concrete, ordered id list by paging the
 * fetcher in fixed windows until a short (under-full) page signals the end. Pure
 * given the fetcher — the page math (accumulate across pages, stop on short page)
 * is what the unit test exercises. Validates the AST up front so a malformed AST
 * never starts a paging loop.
 */
export async function resolveAstToIds(
  ast: unknown,
  brokerScope: string | null,
  opts?: { pageSize?: number; fetcher?: AstPageFetcher },
): Promise<number[]> {
  validateSegment(ast)
  const limit = Math.max(1, opts?.pageSize ?? AST_RESOLVE_PAGE)
  const fetcher = opts?.fetcher ?? defaultPageFetcher
  const ids: number[] = []
  for (let offset = 0; ; offset += limit) {
    const rows = await fetcher(ast, brokerScope, { limit, offset })
    for (const id of rows) ids.push(id)
    if (rows.length < limit) break
  }
  return ids
}

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
        // ast-mode: resolve the saved-view / filter AST to a concrete id set under
        // the FROZEN job.broker_scope, then freeze it onto the job as {ids:[...]}
        // so every subsequent chunk is deterministic and resumable (identical to
        // ids-mode from here on). The same compiler the list/count/audience use,
        // so the bulk id set can never drift from what the operator saw.
        const ast = (job.selection as { ast: unknown }).ast
        let resolved: number[]
        try {
          resolved = await resolveAstToIds(ast, job.broker_scope)
        } catch (e) {
          await markJob(job.id, {
            status: 'failed',
            error: `ast resolution failed: ${e instanceof Error ? e.message : String(e)}`,
          })
          status = 'error'
          errorMsg = e instanceof Error ? e.message : String(e)
          break
        }
        // Freeze the resolved ids + total onto the job. From here every chunk is
        // sliced from this stable list — resumable across cron runs / redeploys.
        const frozen: BulkSelection = { ids: resolved }
        await markJob(job.id, { selection: frozen, total: resolved.length })
        job.selection = frozen
        job.total = resolved.length
        ids = resolved
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
