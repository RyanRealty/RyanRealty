/**
 * /api/cron/tc-deal-calendar — push listing expiration / acceptance / close
 * onto CRM calendar + Google Calendar (GCal write is fail-open).
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { syncDealCalendar } from '@/lib/tc/deal-calendar'
import { LIVE_DEAL_STAGES } from '@/lib/tc/file-comms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const start = Date.now()
  const sb = createServiceClient()
  const { data: deals, error } = await sb.from('tc_deals').select('id').in('stage', [...LIVE_DEAL_STAGES])
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  let synced = 0
  for (const d of deals ?? []) {
    const r = await syncDealCalendar(d.id)
    synced += r.synced
  }
  return NextResponse.json({ ok: true, deals: deals?.length ?? 0, synced, ms: Date.now() - start })
}
