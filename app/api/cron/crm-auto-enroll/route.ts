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

  const windowStart = new Date(Math.max(
    new Date(ENROLLMENT_EPOCH).getTime(),
    Date.now() - 7 * 86400e3,
  )).toISOString()

  const { data: candidates, error } = await sb
    .from('crm_people')
    .select('id')
    .gte('fub_created_at', windowStart)
    .order('id', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let enrolled = 0
  const skipped: Record<string, number> = {}
  for (const p of candidates ?? []) {
    const r = await autoEnrollPerson(p.id)
    if (r.enrolled) enrolled++
    else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1
  }

  return NextResponse.json({
    ok: true,
    scanned: (candidates ?? []).length,
    enrolled,
    skipped,
    duration_ms: Date.now() - startMs,
  })
}
