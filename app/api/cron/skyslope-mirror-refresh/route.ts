/**
 * Inbound SkySlope Files API → skyslope_transactions recon mirror.
 *
 * Read-only against SkySlope after HMAC login. Writes only the two local
 * snapshot tables. Vault (tc_deals) stays the deal SoR.
 *
 * Schedule: daily 06:20 UTC. vercel.json entry required.
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { refreshSkySlopeMirrorInbound } from '@/lib/data/tc/skyslope-mirror'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function writeLog(input: {
  ok: boolean
  durationMs: number
  records: number
  error: string | null
  cycleId: string
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return
    const sb = createClient(url, key)
    await sb.from('sync_logs').insert({
      endpoint: 'skyslope_mirror_refresh',
      method: 'GET',
      response_status: input.ok ? 200 : 503,
      records_returned: input.records,
      duration_ms: input.durationMs,
      sync_cycle_id: input.cycleId,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      error_message: input.error,
      alert_sent: false,
    })
  } catch (err) {
    console.warn('[skyslope-mirror-refresh] sync_logs skip', err)
  }
}

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied
  const t0 = Date.now()
  const cycleId = randomUUID()
  const result = await refreshSkySlopeMirrorInbound()
  const durationMs = Date.now() - t0
  await writeLog({
    ok: result.ok,
    durationMs,
    records: result.upserted,
    error: result.error ?? result.blocker,
    cycleId,
  })
  const status = result.ok ? 200 : result.blocker ? 503 : 500
  return NextResponse.json({ ...result, durationMs, cycleId }, { status })
}
