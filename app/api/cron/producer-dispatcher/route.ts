/**
 * Producer dispatcher cron.
 *
 * Polls marketing_brain_actions for status='pending' rows ordered by
 * priority_score DESC NULLS LAST, picks the top N (default 5), and for
 * each row transitions it to 'in_production' and writes a dispatch
 * envelope to executor_response.
 *
 * Producers are LLM-driven SKILL.md recipes that require a Claude Agent
 * SDK runtime. This cron queues them; actual producer execution happens
 * when Matt (or a separate runtime with Anthropic budget) picks up the
 * 'in_production' rows and runs the Agent SDK against them.
 *
 * Idempotency: uses Supabase .eq + .in status guard before UPDATE so a
 * row that was already transitioned by a concurrent run is skipped.
 *
 * Schedule: every 15 minutes (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/producer-dispatcher
 *     ?maxRows=5    (default 5, max 20)
 *     &dryRun=true  (returns candidates without writing)
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

const DEFAULT_MAX_ROWS = 5
const HARD_MAX_ROWS = 20

interface DispatchedRow {
  id: string
  action_type: string
  assigned_producer: string | null
  priority_score: number | null
  queued_at: string
}

interface SkippedRow {
  id: string
  reason: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const maxRowsParam = url.searchParams.get('maxRows')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  const maxRows = maxRowsParam
    ? Math.min(HARD_MAX_ROWS, Math.max(1, parseInt(maxRowsParam, 10) || DEFAULT_MAX_ROWS))
    : DEFAULT_MAX_ROWS

  const startedAt = new Date().toISOString()
  const supabase = createServiceClient()

  // Fetch top-priority pending rows. Supabase JS client does not expose
  // SELECT FOR UPDATE SKIP LOCKED, so we use a two-phase approach:
  // 1. Read candidates.
  // 2. UPDATE each one only where status is still 'pending' (optimistic lock).
  // Concurrent runs that race on the same row will find status != 'pending'
  // on the UPDATE and skip it cleanly.
  const { data: candidates, error: fetchErr } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, assigned_producer, priority_score, scheduled_for')
    .eq('status', 'pending')
    .or('scheduled_for.is.null,scheduled_for.lte.' + startedAt)
    .order('priority_score', { ascending: false, nullsFirst: false })
    .limit(maxRows)

  if (fetchErr) {
    console.error('[producer-dispatcher] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const rows = candidates ?? []

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: rows.map((r) => ({
        id: r.id,
        action_type: r.action_type,
        assigned_producer: r.assigned_producer,
        priority_score: r.priority_score,
      })),
      startedAt,
    })
  }

  const dispatched: DispatchedRow[] = []
  const skipped: SkippedRow[] = []

  for (const row of rows) {
    const queuedAt = new Date().toISOString()

    const producerPath = row.assigned_producer ?? 'unknown'
    const envelope = {
      dispatch_status: 'queued_for_agent_runtime',
      queued_at: queuedAt,
      ready_for_runtime: true,
      runtime_invocation_command: `cd /Users/matthewryan/RyanRealty && claude --skill ${producerPath} --action-row-id ${row.id}`,
    }

    // Optimistic lock: only UPDATE rows still in 'pending' status.
    // A concurrent dispatcher run that already claimed this row will have
    // set status='in_production', so the .eq filter will match 0 rows and
    // we skip gracefully.
    const { data: updated, error: updateErr } = await supabase
      .from('marketing_brain_actions')
      .update({
        status: 'in_production',
        executed_at: queuedAt,
        executor_response: envelope,
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')

    if (updateErr) {
      console.error(`[producer-dispatcher] update error for ${row.id}:`, updateErr.message)
      skipped.push({ id: row.id, reason: `update_error: ${updateErr.message}` })
      continue
    }

    if (!updated || updated.length === 0) {
      // Row was claimed by a concurrent run between our SELECT and UPDATE.
      skipped.push({ id: row.id, reason: 'already_claimed_by_concurrent_run' })
      continue
    }

    dispatched.push({
      id: row.id,
      action_type: row.action_type,
      assigned_producer: row.assigned_producer,
      priority_score: row.priority_score,
      queued_at: queuedAt,
    })
  }

  return NextResponse.json({
    startedAt,
    dispatched_count: dispatched.length,
    skipped_count: skipped.length,
    candidates_found: rows.length,
    dispatched,
    skipped,
    note: 'Rows are now in_production. Invoke the Claude Agent SDK against each row to execute the producer recipe.',
  })
}
