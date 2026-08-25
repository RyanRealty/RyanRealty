/**
 * CRM bulk-job worker — drains queued/running bulk jobs in fixed-size chunks so a
 * single mutation can cover the full ~18K contact book without ever timing out a
 * request. Resumable: each run claims the oldest job, resolves its id set, runs
 * the registered handler over the next ~250 ids from the `processed` offset, then
 * persists progress. The job finishes when every selected row is drained.
 *
 * The drain itself lives in lib/crm/bulk-drain.ts, because the enqueue path also
 * kicks one chunk the moment a job is stored (small jobs no longer wait on a cron
 * tick). This route is the long-haul caller: several chunks per invocation, on
 * the vercel.json schedule.
 *
 * Never throws to the cron caller — every failure returns a JSON status so a
 * Vercel cron retry never sees a 500 it can thunder against. `ok` now tracks the
 * drain status: a run that failed a job reports ok:false instead of the ok:true
 * it used to report alongside status:'error'. Nothing asserts on the field; a
 * monitor reading it should see a failed drain as a failure.
 */

import { NextResponse } from 'next/server'
import { drainBulkJobs, CHUNKS_PER_CRON_RUN } from '@/lib/crm/bulk-drain'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const startMs = Date.now()

  const outcome = await drainBulkJobs({ maxChunks: CHUNKS_PER_CRON_RUN })

  return NextResponse.json({
    ok: outcome.status !== 'error',
    status: outcome.status,
    jobId: outcome.jobId,
    chunksRun: outcome.chunksRun,
    rowsProcessed: outcome.rowsProcessed,
    drained: outcome.drained,
    error: outcome.error,
    duration_ms: Date.now() - startMs,
  })
}
