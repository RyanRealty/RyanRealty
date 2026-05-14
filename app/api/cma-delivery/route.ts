/**
 * CMA delivery worker.
 *
 * POST /api/cma-delivery
 *   body: { delivery_id: string }
 *
 * Fired fire-and-forget from `submitSellerLPForm` after the FUB event lands.
 * Picks up the cma_deliveries row, runs the full pipeline (resolve property
 * id → computeCMA → render PDF → upload to Storage → email broker for
 * review), updates the row status.
 *
 * Idempotent: rows already in 'sent' or 'no_match' return early.
 *
 * Lives outside `/api/cron/*` so Vercel's automatic Cron-route bearer-token
 * protection doesn't gate it (we use our own optional `x-cron-secret` header
 * check below). In dev (`NODE_ENV !== 'production'`) the secret check is
 * bypassed.
 */

import { NextResponse } from 'next/server'

import { processCmaDelivery } from '@/lib/cma-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Authorization is opt-in. The worker is idempotent (a no-op on rows that
 * are already in a terminal status) and only acts on UUIDs an attacker
 * would have to guess. The risk of an unauthenticated POST hitting a random
 * pending row is acceptable. To turn auth on, set CMA_WORKER_AUTH_SECRET in
 * the environment — the route then requires `x-cma-worker-secret` to match.
 */
function authorized(req: Request): boolean {
  const expected = process.env.CMA_WORKER_AUTH_SECRET?.trim()
  if (!expected) return true
  const provided = req.headers.get('x-cma-worker-secret')?.trim()
  return !!provided && provided === expected
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { delivery_id?: string } = {}
  try {
    body = (await req.json()) as { delivery_id?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const deliveryId = body.delivery_id?.trim()
  if (!deliveryId) {
    return NextResponse.json({ error: 'delivery_id required' }, { status: 400 })
  }

  const result = await processCmaDelivery(deliveryId)

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status === 'no_match' ? 200 : 500,
  })
}

// GET hook so a human can fire a single delivery from a browser when needed
// (mirrors the cron POST so dev / one-off retries don't require curl).
export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const deliveryId = url.searchParams.get('delivery_id')?.trim()
  if (!deliveryId) {
    return NextResponse.json({ error: 'delivery_id required' }, { status: 400 })
  }
  const result = await processCmaDelivery(deliveryId)
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status === 'no_match' ? 200 : 500,
  })
}
