/**
 * Auto-enrollment sweep — the catch-all that guarantees no new lead sits
 * outside a workflow regardless of which door it came through (LP, Meta
 * webhook, inbound SMS, manual FUB entry picked up by delta sync).
 *
 * Every 15 min: scan people created since the enrollment epoch (bounded to a
 * trailing 7-day window) and run the rules. The inline hook in the lead
 * tagger handles the hot path instantly; this closes every gap.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { autoEnrollPerson, ENROLLMENT_EPOCH } from '@/lib/crm/enroll'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

  // Overlap lease: this cron does ~10 serial queries per candidate over up to 300
  // leads with no processed-flag, so an overrun would re-scan the same window on
  // the next tick. Skip an overlapping run. Self-expires after 300s.
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'crm-auto-enroll', p_lease_seconds: 300 })
  if (gotLease === false) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }

  const windowStart = new Date(Math.max(
    new Date(ENROLLMENT_EPOCH).getTime(),
    Date.now() - 7 * 86400e3,
  )).toISOString()

  const { data: candidates, error } = await sb
    .from('crm_people')
    .select('id,name,source,stage,assigned_broker,tags,fub_created_at')
    .gte('fub_created_at', windowStart)
    .order('id', { ascending: false })
    .limit(300)
  if (error) {
    await sb.rpc('crm_release_cron_lease', { p_name: 'crm-auto-enroll' })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let enrolled = 0
  let alerted = 0
  const skipped: Record<string, number> = {}
  for (const p of candidates ?? []) {
    const r = await autoEnrollPerson(p.id)
    if (r.enrolled) enrolled++
    else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1

    // Instant broker text on every NEW lead (any door: LP, FUB entry, Meta,
    // IDX registration via delta, inbound SMS, detection crons). Dedup is in
    // queueBrokerAlert; the relay on the mini delivers within ~45s.
    if ((p.tags ?? []).includes('compliance:hard-stop')) continue
    const queued = await queueBrokerAlert({
      broker: p.assigned_broker,
      personId: p.id,
      kind: 'new-lead',
      body: newLeadAlertBody({
        name: p.name,
        source: p.source,
        stage: p.stage,
        personId: p.id,
        detail: r.enrolled ? 'Auto-enrolled in nurture workflow.' : null,
      }),
    })
    if (queued) alerted++
  }

  await sb.rpc('crm_release_cron_lease', { p_name: 'crm-auto-enroll' })
  return NextResponse.json({
    ok: true,
    scanned: (candidates ?? []).length,
    enrolled,
    alerted,
    skipped,
    duration_ms: Date.now() - startMs,
  })
}
