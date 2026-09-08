/**
 * GET /api/cron/crm-response-clock — the five-minute response clock (SITE-09).
 *
 * Matt 2026-09-07: "a CRM timer flags any valuation, tour, or alert with no
 * human touch after five minutes." This is that timer. Every five minutes it
 * takes the site submits of the last 26 hours, asks lib/crm/response-clock.ts
 * whether a person has answered, and texts the assigned broker when nobody has;
 * a submit still unanswered a full day later goes to Matt as the principal
 * broker. A lead that gets answered after a flag clears it, so the admin panel
 * shows what is actually outstanding and not a graveyard.
 *
 * CONCURRENCY: none needed. Every write is keyed by a dedupe_key or a flag
 * already on the record (see lib/crm/response-clock-run.ts), so an overlapping
 * run reaches the same state and writes nothing the first one did.
 *
 * ?dry=1 returns every decision and writes nothing — the way to verify the run
 * against live data without waking anyone.
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runResponseClock } from '@/lib/crm/response-clock-run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const startedMs = Date.now()
  try {
    const run = await runResponseClock({ dry })
    return NextResponse.json({ ok: true, ...run, tookMs: Date.now() - startedMs })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[response-clock] run failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
