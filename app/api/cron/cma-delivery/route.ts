/**
 * CMA delivery worker.
 *
 * POST /api/cron/cma-delivery
 *   body: { delivery_id: string }
 *
 * Fired fire-and-forget from `submitSellerLPForm` after the FUB event lands.
 * Picks up the cma_deliveries row, runs the full pipeline (resolve property
 * id → computeCMA → render PDF → upload to Storage → email broker for
 * review), updates the row status.
 *
 * Idempotent: rows already in 'sent' or 'no_match' return early.
 *
 * Secured by a shared CRON_SECRET header (`x-cron-secret`) so the route
 * isn't a public DOS surface. In dev (`NODE_ENV !== 'production'`) the
 * secret check is bypassed.
 */

import { NextResponse } from 'next/server'

import { processCmaDelivery } from '@/lib/cma-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) return true // ungated until explicitly configured
  const provided = req.headers.get('x-cron-secret')?.trim()
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
