/**
 * GET /api/cron/cma-build-worker — every 30 minutes (vercel.json).
 *
 * Polls marketing_brain_actions for open `content:cma` rows (pending or
 * stuck in_production) and builds each into a reviewable draft CMA via the
 * deterministic builder (lib/cma/build.ts). Caps at 3 builds per run.
 *
 * BUILD ONLY — never sends anything. Drafts surface at /admin/cmas.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same pattern as sibling crons).
 * Query params: ?limit=N (1-10, default 3) for manual invocations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runCmaBuildWorker } from '@/lib/cma/worker'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const limitParam = parseInt(url.searchParams.get('limit') ?? '3', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 3, 1), 10)

  try {
    const result = await runCmaBuildWorker(limit)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cma-build-worker]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
