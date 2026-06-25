import 'server-only'

/**
 * getCrmBulkJob — the read side of the CRM bulk-job framework (Wave 3). The bulk
 * bar enqueues a job (app/actions/crm-bulk.ts), gets a jobId back, then polls this
 * reader to render a progress bar ("412 of 412 done, 38 skipped") and a recent-jobs
 * list. The worker (app/api/cron/crm-bulk-worker) owns advancing the row; this
 * module only reads it.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/. NOT cached
 * — a bulk job is a live, fast-moving row the UI polls every second or two, so a
 * stale unstable_cache window would make the progress bar lie. The query is a
 * single primary-key lookup (or a small ordered window for the list), cheap to run
 * uncached.
 *
 * Fails SOFT: an unreadable row / table yields null (or an empty list) so the UI
 * shows a quiet "could not load" state instead of crashing the bulk bar.
 */

import { createServiceClient } from '@/lib/supabase/service'

/** The lifecycle of a bulk job, mirroring the crm_bulk_jobs status check. */
export type CrmBulkJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

/** A bulk job as the UI progress bar + jobs list render it. */
export type CrmBulkJobView = {
  id: number
  kind: string
  status: CrmBulkJobStatus
  /** Total rows the job targets. null until the worker resolves an ast selection. */
  total: number | null
  /** Rows the worker has handled so far (mutated + skipped). */
  processed: number
  /** Rows skipped (suppressed / protected / not-in-scope) — a subset of processed. */
  skipped: number
  /** Per-kind counters merged by the worker, e.g. { mutated: 374, suppressed: 38 }. */
  breakdown: Record<string, number>
  /** Failure message when status === 'failed'. */
  error: string | null
  actorEmail: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  /** 0..1 completion ratio, clamped. null when total is unknown (queued ast job). */
  progress: number | null
  /** Terminal = nothing more will change (done / failed / canceled). */
  isTerminal: boolean
}

const TERMINAL: ReadonlySet<CrmBulkJobStatus> = new Set(['done', 'failed', 'canceled'])

/** Coerce a raw status string to a valid status (default 'queued'). PURE. */
export function normalizeBulkJobStatus(raw: unknown): CrmBulkJobStatus {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'running' || s === 'done' || s === 'failed' || s === 'canceled') return s
  return 'queued'
}

/**
 * Completion ratio in [0, 1], or null when total is unknown. PURE.
 * A done job with a 0 total reads as 1 (it finished, there was nothing to do).
 */
export function computeProgress(
  total: number | null | undefined,
  processed: number | null | undefined,
  status: CrmBulkJobStatus,
): number | null {
  if (total === null || total === undefined) {
    return TERMINAL.has(status) ? 1 : null
  }
  const t = Math.max(0, Math.floor(total))
  if (t === 0) return 1
  const p = Math.max(0, Math.floor(processed ?? 0))
  return Math.min(1, p / t)
}

type RawBulkJobRow = {
  id: number
  kind: string
  status: string
  total: number | null
  processed: number | null
  skipped: number | null
  breakdown: Record<string, number> | null
  error: string | null
  actor_email: string
  created_at: string
  started_at: string | null
  finished_at: string | null
}

const SELECT =
  'id,kind,status,total,processed,skipped,breakdown,error,actor_email,created_at,started_at,finished_at'

/** Shape a raw crm_bulk_jobs row into the UI view. PURE — exported for the test. */
export function buildBulkJobView(row: RawBulkJobRow): CrmBulkJobView {
  const status = normalizeBulkJobStatus(row.status)
  const total = row.total === null || row.total === undefined ? null : Math.max(0, Math.floor(row.total))
  const processed = Math.max(0, Math.floor(row.processed ?? 0))
  const skipped = Math.max(0, Math.floor(row.skipped ?? 0))
  return {
    id: Number(row.id),
    kind: String(row.kind),
    status,
    total,
    processed,
    skipped,
    breakdown: (row.breakdown && typeof row.breakdown === 'object') ? row.breakdown : {},
    error: row.error ?? null,
    actorEmail: String(row.actor_email),
    createdAt: String(row.created_at),
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    progress: computeProgress(total, processed, status),
    isTerminal: TERMINAL.has(status),
  }
}

/**
 * Read one bulk job for the progress poller. Returns null when the job does not
 * exist or the table is unreadable (the UI shows a quiet "could not load" state).
 */
export async function getCrmBulkJob(jobId: number): Promise<CrmBulkJobView | null> {
  const id = Number(jobId)
  if (!Number.isFinite(id) || id <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_bulk_jobs')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getCrmBulkJob]', error.message)
    return null
  }
  if (!data) return null
  return buildBulkJobView(data as RawBulkJobRow)
}

const RECENT_LIMIT = 25

/**
 * Recent bulk jobs for a jobs list. When actorEmail is given, scopes to that
 * actor's own jobs (a restricted broker only sees the bulk runs they kicked off);
 * omit it for an owner/superuser who sees every broker's runs. Fails SOFT to [].
 */
export async function getRecentCrmBulkJobs(actorEmail?: string): Promise<CrmBulkJobView[]> {
  const sb = createServiceClient()
  let query = sb
    .from('crm_bulk_jobs')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)
  const actor = actorEmail?.trim().toLowerCase()
  if (actor) query = query.eq('actor_email', actor)
  const { data, error } = await query
  if (error || !data) {
    if (error) console.error('[getRecentCrmBulkJobs]', error.message)
    return []
  }
  return (data as RawBulkJobRow[]).map(buildBulkJobView)
}
