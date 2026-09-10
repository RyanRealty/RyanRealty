/**
 * GET /api/cron/cma-solicit-screen — hourly (vercel.json).
 *
 * Pulls out of the expired and FSBO queues anyone we may not write to: a
 * for-sale-by-owner now listed on the MLS, an expired owner who relisted, and
 * one whose home sold after it came off the market (Matt 2026-09-09). A
 * prospect can relist on any morning, so this runs continuously rather than
 * only when someone remembers.
 *
 * ARCHIVES ONLY — it never sends, and it never notifies. The send paths carry
 * the same screen as a hard block, so this is hygiene, not the guarantee.
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runSolicitSweep } from '@/lib/cma/solicit-sweep'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  try {
    const result = await runSolicitSweep({ archive: true })
    return NextResponse.json({ ok: !result.error, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cma-solicit-screen]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
