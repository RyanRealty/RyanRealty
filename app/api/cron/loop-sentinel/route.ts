import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runLoopSentinel } from '@/lib/data/loop/sentinel'

/**
 * Loop sentinel cron (THE LOOP, R-206): when the loop is dormant and eligible
 * work exists, launch a cloud agent that runs the loop unattended. Guards:
 * kill switch, fresh-activity standdown, 3h cooldown, dry mode (?dry=1).
 * Registered in vercel.json (G53).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const dry = request.nextUrl.searchParams.get('dry') === '1'
  const decision = await runLoopSentinel({ dry })
  console.log('[loop-sentinel]', JSON.stringify(decision))
  return NextResponse.json(decision)
}
