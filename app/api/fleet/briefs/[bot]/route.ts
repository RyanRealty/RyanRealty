import { NextRequest, NextResponse } from 'next/server'
import { buildFleetBrief, isFleetBot, FLEET_BOTS } from '@/lib/data/loop/fleet-briefs'

/**
 * Live bot briefs (THE LOOP v1.6.x co-evolution wire). Each bot's ONLY pasted
 * instruction is a 3-line bootstrap: fetch this URL every run and follow it.
 * The loop rewrites briefs in code; every bot follows on its next heartbeat.
 *
 *   GET /api/fleet/briefs/walker-mobile   (etc.)
 *   header: x-fleet-secret
 *
 * The secret is substituted into the served text (reporting + pack fetches),
 * so it never lives in a committed file and never needs re-pasting.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ bot: string }> }) {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim() || request.headers.get('x-fleet-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { bot } = await ctx.params
  if (!isFleetBot(bot)) {
    return NextResponse.json({ error: `unknown bot — one of: ${FLEET_BOTS.join(', ')}` }, { status: 404 })
  }
  return new NextResponse(buildFleetBrief(bot, secret), {
    status: 200,
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' },
  })
}
