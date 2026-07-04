/**
 * CRM bulk-job framework — the engine that runs ANY bulk mutation over the full
 * ~18K contact book without timing out a single request. A job is enqueued once
 * (rows frozen via broker_scope at enqueue), then drained in fixed-size chunks
 * by the crm-bulk-worker cron, resumable from `processed` so a cron timeout or
 * redeploy never re-runs already-processed rows.
 *
 * Real per-kind handlers (assign / tag / stage / ...) are registered in a LATER
 * wave. This file ships the framework plus ONE reference handler ('noop') so the
 * enqueue -> worker -> drain -> done path is provable end to end today.
 *
 * DAL boundary note: the read/write helpers here use createServiceClient and are
 * the bulk-job's own data layer (lib/** is the allowed home for raw .from()).
 * They are imported by the worker cron and by the handler implementations.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** Rows a single handler invocation reports it touched. */
export type BulkResult = {
  processed: number
  skipped: number
  /** Free-form per-kind counters merged into the job row (e.g. { suppressed: 3 }). */
  breakdown: Record<string, number>
}

export type BulkSelection = { ids: number[] } | { ast: unknown }

export type BulkJobRow = {
  id: number
  kind: string
  params: Record<string, unknown>
  selection: BulkSelection
  actor_email: string
  broker_scope: string | null
  status: 'queued' | 'running' | 'done' | 'failed' | 'canceled'
  total: number | null
  processed: number
  skipped: number
  breakdown: Record<string, number>
  error: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

/** What every handler receives. broker_scope is the FROZEN scope from enqueue. */
export type BulkContext = {
  jobId: number
  actorEmail: string
  brokerScope: string | null
}

export type BulkHandler = (
  ids: number[],
  params: Record<string, unknown>,
  ctx: BulkContext,
) => Promise<Partial<BulkResult>>

// ── Handler registry ─────────────────────────────────────────────────────────

const HANDLERS = new Map<string, BulkHandler>()

/** Register a bulk handler for a job kind. Last registration wins (idempotent on
 *  re-import). Real handlers register at module load in a later wave. */
export function registerBulkHandler(kind: string, fn: BulkHandler): void {
  HANDLERS.set(kind, fn)
}

export function getBulkHandler(kind: string): BulkHandler | undefined {
  return HANDLERS.get(kind)
}

export function listBulkHandlerKinds(): string[] {
  return [...HANDLERS.keys()].sort()
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Default rows processed per cron chunk. Sized so one handler pass over the
 *  chunk stays well inside the cron's request budget even on the heaviest kind. */
export const BULK_CHUNK_SIZE = 250

/**
 * Slice the next chunk of ids from a frozen id list given how many have already
 * been processed. Pure + total. `offset` clamps to [0, length]; an empty list or
 * a fully-drained offset yields an empty chunk (the caller marks the job done).
 */
export function chunkIds(ids: number[], offset: number, size = BULK_CHUNK_SIZE): number[] {
  const start = Math.min(Math.max(0, Math.floor(offset)), ids.length)
  const count = Math.max(0, Math.floor(size))
  return ids.slice(start, start + count)
}

/** Total number of chunks a job of `total` rows takes at `size` per chunk. */
export function chunkCount(total: number, size = BULK_CHUNK_SIZE): number {
  const t = Math.max(0, Math.floor(total))
  const s = Math.max(1, Math.floor(size))
  return Math.ceil(t / s)
}

/** True once every selected row has been processed (resume / completion test). */
export function isDrained(total: number, processed: number): boolean {
  return Math.max(0, Math.floor(processed)) >= Math.max(0, Math.floor(total))
}

/** Merge a handler's partial result into a job's running breakdown (additive). */
export function mergeBreakdown(
  base: Record<string, number>,
  add: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...base }
  for (const [k, v] of Object.entries(add ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = (out[k] ?? 0) + v
  }
  return out
}

/** Normalize whatever a handler returned into a complete BulkResult. */
export function normalizeResult(partial: Partial<BulkResult> | undefined): BulkResult {
  return {
    processed: Math.max(0, Math.floor(partial?.processed ?? 0)),
    skipped: Math.max(0, Math.floor(partial?.skipped ?? 0)),
    breakdown: partial?.breakdown ?? {},
  }
}

/** Pull the explicit id list out of a selection, or null when it is ast-mode. */
export function selectionIds(selection: BulkSelection | null | undefined): number[] | null {
  if (selection && 'ids' in selection && Array.isArray(selection.ids)) {
    return selection.ids.filter((n) => Number.isInteger(n)) as number[]
  }
  return null
}

// ── Enqueue + DB helpers ─────────────────────────────────────────────────────

export type EnqueueArgs = {
  kind: string
  selection: BulkSelection
  params?: Record<string, unknown>
  actorEmail: string
  /** Frozen at enqueue: the broker the actor is scoped to (null = superuser). */
  brokerScope: string | null
  /**
   * Optional idempotency key. When set, a second enqueue with the same key while
   * an earlier job is still non-terminal returns that job's id instead of
   * creating a duplicate (double-click / retry protection). Enforced by the
   * partial unique index crm_bulk_jobs_active_dedupe_uidx.
   */
  dedupeKey?: string
}

/**
 * Build the insert row for a bulk job. Pure (no I/O) so it is unit-testable and
 * the enqueue path stays a thin DB call. `total` is set only for ids-mode at
 * enqueue (the count is already known); ast-mode resolves its total at first claim.
 */
export function buildBulkJobInsert(args: EnqueueArgs): {
  kind: string
  selection: BulkSelection
  params: Record<string, unknown>
  actor_email: string
  broker_scope: string | null
  status: 'queued'
  total: number | null
} {
  const ids = selectionIds(args.selection)
  return {
    kind: args.kind,
    selection: args.selection,
    params: args.params ?? {},
    actor_email: args.actorEmail,
    broker_scope: args.brokerScope,
    status: 'queued',
    total: ids ? ids.length : null,
  }
}

/** Enqueue a bulk job. Returns the new job id (or the existing one on a dedupe hit). */
export async function enqueueBulkJob(args: EnqueueArgs): Promise<number> {
  const sb = createServiceClient()
  const row: Record<string, unknown> = { ...buildBulkJobInsert(args) }
  if (args.dedupeKey) row.dedupe_key = args.dedupeKey

  const { data, error } = await sb.from('crm_bulk_jobs').insert(row).select('id').single()
  if (!error) return data.id as number

  // Unique-violation on the active-dedupe index = a job with this key is already
  // in flight (a double-click / retry). Return the existing job instead of
  // duplicating the send. 23505 = unique_violation.
  if (args.dedupeKey && error.code === '23505') {
    const { data: existing } = await sb
      .from('crm_bulk_jobs')
      .select('id')
      .eq('dedupe_key', args.dedupeKey)
      .not('status', 'in', '("done","error","failed")')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return existing.id as number
  }
  throw new Error(`enqueueBulkJob failed: ${error.message}`)
}

/**
 * The lease a claim stamps on a job, in seconds. A worker holds the job for this
 * long; an overrun lets another worker re-claim it (the prior worker's writes are
 * additive + offset-keyed, so a re-claim after an overrun resumes, never doubles).
 * Kept in lockstep with the default in crm_claim_bulk_job's p_lease_seconds.
 */
export const BULK_JOB_LEASE_SECONDS = 240

/**
 * Atomically claim the next chunk of work for the oldest claimable job.
 *
 * Delegates the pick to the SECURITY DEFINER fn crm_claim_bulk_job, which selects
 * the oldest queued/running job whose lease has expired FOR UPDATE SKIP LOCKED,
 * stamps a fresh BULK_JOB_LEASE_SECONDS lease, and flips it to running — all in
 * ONE statement. Two overlapping worker invocations (a cron retry firing mid-run,
 * two regions) can therefore never grab the same job: the second caller either
 * claims a DIFFERENT job or gets nothing back. Returns null when there is nothing
 * claimable.
 *
 * For ast-mode the worker resolves + persists the id set; this helper hands back
 * the job so the worker can do that resolution. For ids-mode it returns the next
 * chunk directly. Call reLeaseBulkJob before each subsequent chunk to extend the
 * lease while a job is still draining.
 */
export async function claimNextChunk(): Promise<
  | { job: BulkJobRow; chunk: number[] }
  | null
> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('crm_claim_bulk_job', {
    p_lease_seconds: BULK_JOB_LEASE_SECONDS,
  })
  if (error) throw new Error(`claimNextChunk claim failed: ${error.message}`)
  const rows = (data as BulkJobRow[] | null) ?? []
  const job = rows[0] ?? null
  if (!job) return null

  const ids = selectionIds(job.selection)
  // ids-mode: the chunk is deterministic from processed offset.
  const chunk = ids ? chunkIds(ids, job.processed) : []
  return { job, chunk }
}

/**
 * Extend the lease on a job the worker is actively draining. Called once per chunk
 * after the claim so a multi-chunk drain inside one cron run keeps the job leased
 * (a second worker can never grab it mid-drain). Best-effort: a failed re-lease
 * just shortens the window the job stays exclusively ours; the next claim's
 * SKIP LOCKED still prevents a true double-drain.
 */
export async function reLeaseBulkJob(jobId: number): Promise<void> {
  const sb = createServiceClient()
  await sb
    .from('crm_bulk_jobs')
    .update({
      locked_until: new Date(Date.now() + BULK_JOB_LEASE_SECONDS * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

/** Apply a chunk's outcome to a job row (additive processed/skipped/breakdown). */
export async function markChunkProgress(
  jobId: number,
  current: { processed: number; skipped: number; breakdown: Record<string, number> },
  result: BulkResult,
): Promise<void> {
  const sb = createServiceClient()
  await sb
    .from('crm_bulk_jobs')
    .update({
      processed: current.processed + result.processed + result.skipped,
      skipped: current.skipped + result.skipped,
      breakdown: mergeBreakdown(current.breakdown, result.breakdown),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

/** Terminal/state update for a job (done / failed / canceled / total set, etc.). */
export async function markJob(
  jobId: number,
  patch: Partial<Pick<BulkJobRow, 'status' | 'total' | 'error' | 'selection'>>,
): Promise<void> {
  const sb = createServiceClient()
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
  if (patch.status === 'done' || patch.status === 'failed' || patch.status === 'canceled') {
    update.finished_at = new Date().toISOString()
  }
  await sb.from('crm_bulk_jobs').update(update).eq('id', jobId)
}

// ── Reference handler: 'noop' ────────────────────────────────────────────────
// Counts the rows in the chunk and reports them processed. Proves the full
// enqueue -> claim -> drain -> done path without mutating any contact. Real
// handlers (assign / tag / ...) register in a later wave.

registerBulkHandler('noop', async (ids) => ({
  processed: ids.length,
  skipped: 0,
  breakdown: { counted: ids.length },
}))
