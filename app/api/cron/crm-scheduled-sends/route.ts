/**
 * CRM scheduled-sends cron — fires due future-dated cohort emails through the SAME
 * bulk worker path as an immediate send (Wave 5).
 *
 * A "send later" from /admin/email/compose froze the resolved selection ({ids} or
 * {ast}), the caller's broker scope, the actor email, and the cohort params into
 * crm_scheduled_sends. This cron claims each due, still-scheduled row (flipping
 * status scheduled -> enqueued atomically so a double tick can't double-send),
 * then enqueues it via enqueueBulkJob(kind 'email-cohort'). From there the
 * crm-bulk-worker cron drains it with the per-recipient suppression chokepoint and
 * the email_events 'sent' rows — identical to a "send now". No second send path.
 *
 * Never throws to the cron caller — every failure is a JSON status so a Vercel
 * retry never thunders against a 500.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same posture as the other CRM crons).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enqueueBulkJob, type BulkSelection } from '@/lib/crm/bulk-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** How many due rows to enqueue per invocation (each is one cheap insert). */
const MAX_PER_RUN = 25

type DueRow = {
  id: number
  kind: string
  selection: unknown
  params: Record<string, unknown> | null
  actor_email: string
  broker_scope: string | null
}

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
  const sb = createServiceClient()

  let claimed = 0
  let enqueued = 0
  let failed = 0

  try {
    const nowIso = new Date().toISOString()
    const { data, error } = await sb
      .from('crm_scheduled_sends')
      .select('id,kind,selection,params,actor_email,broker_scope')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_PER_RUN)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, duration_ms: Date.now() - startMs })
    }

    const rows = (data ?? []) as DueRow[]

    for (const row of rows) {
      // Claim the row atomically: only flip if it is STILL scheduled. A concurrent
      // tick that already claimed it sees status != 'scheduled' and the update
      // touches zero rows, so we skip it.
      const { data: claimedRows, error: claimErr } = await sb
        .from('crm_scheduled_sends')
        .update({ status: 'enqueued', enqueued_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'scheduled')
        .select('id')
      if (claimErr || !claimedRows || claimedRows.length === 0) {
        continue
      }
      claimed += 1

      try {
        const jobId = await enqueueBulkJob({
          kind: row.kind || 'email-cohort',
          selection: row.selection as BulkSelection,
          params: row.params ?? {},
          actorEmail: row.actor_email,
          brokerScope: row.broker_scope,
        })
        await sb
          .from('crm_scheduled_sends')
          .update({ bulk_job_id: jobId })
          .eq('id', row.id)
        enqueued += 1
      } catch (e) {
        // Mark the row failed (visible) and move on — never loop the same row.
        failed += 1
        await sb
          .from('crm_scheduled_sends')
          .update({
            status: 'failed',
            error: e instanceof Error ? e.message : String(e),
          })
          .eq('id', row.id)
      }
    }

    return NextResponse.json({
      ok: true,
      claimed,
      enqueued,
      failed,
      duration_ms: Date.now() - startMs,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      claimed,
      enqueued,
      failed,
      duration_ms: Date.now() - startMs,
    })
  }
}
