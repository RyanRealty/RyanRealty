/**
 * Daily scan: stage GBP review-ask drafts for TC deals that closed in the
 * last 14 days. Never sends. Matt (or the assigned broker) sends from Inbox.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Cadence: 0 16 * * * — registered in vercel.json.
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

  try {
    const summary = await stageReviewAsksForRecentCloses()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[review-ask-on-close]', err)
    return NextResponse.json({ ok: false, error: 'scan failed' }, { status: 500 })
  }
}
