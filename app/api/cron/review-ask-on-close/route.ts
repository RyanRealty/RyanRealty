/**
 * Daily scan: draft a Google review ask for each buyer and seller on a real
 * Vault closing in the last 12 months who has not been asked. NEVER SENDS
 * (Matt 2026-10-14: each send needs his yes). Every draft waits in Matt's CRM
 * Drafts (/admin/messages?f=drafts) until he opens it and presses Send.
 * See lib/data/tc/stageReviewAsksForRecentCloses.ts for why the old 14-day
 * window never reached a real client.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Cadence: 0 16 * * * (vercel.json). `?dryRun=1` counts without writing.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { stageReviewAsksForRecentCloses } from '@/lib/data/tc/stageReviewAsksForRecentCloses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  try {
    const summary = await stageReviewAsksForRecentCloses({ dryRun })
    return NextResponse.json({ ok: summary.errors === 0, ...summary }, { status: summary.errors === 0 ? 200 : 500 })
  } catch (err) {
    console.error('[review-ask-on-close]', err)
    return NextResponse.json({ ok: false, error: 'scan failed' }, { status: 500 })
  }
}
