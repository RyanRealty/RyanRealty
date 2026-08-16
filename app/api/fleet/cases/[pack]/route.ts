import { NextRequest, NextResponse } from 'next/server'
import { buildFleetPack, isFleetPack } from '@/lib/data/loop/fleet-cases'

/**
 * Live case packs for the verification fleet (THE LOOP v1.6.x).
 * Bots GET their pack at the start of every heartbeat run:
 *
 *   GET /api/fleet/cases/core        (also: regression | preflight | flows)
 *   header: x-fleet-secret
 *
 * The pack is generated from the work graph at request time — every closed
 * node updates the fleet's instructions with zero human step. The first line
 * is a RUN-TOKEN that changes only when the graph or deploy changed; a bot
 * whose previous token matches ends its run immediately ("no changes").
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ pack: string }> }) {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim() || request.headers.get('x-fleet-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { pack } = await ctx.params
  if (!isFleetPack(pack)) {
    return NextResponse.json({ error: `unknown pack — use one of: core, regression, preflight, flows` }, { status: 404 })
  }
  try {
    const { markdown } = await buildFleetPack(pack)
    return new NextResponse(markdown, {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' },
    })
  } catch (err) {
    console.error('[fleet/cases]', err)
    return NextResponse.json({ error: 'pack generation failed' }, { status: 500 })
  }
}
