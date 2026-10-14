/**
 * On-demand replay of inbound SMS / voicemail enrichment.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (requireCronAuth).
 * POST { personId } or GET ?personId=64825
 *
 * Re-reads the stored inbound body and applies the same extract/apply path
 * the webhooks use. Never sends a reply text or email. Not a scheduled cron
 * (crm-* under app/api/cron must be in vercel.json).
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { replayInboundMessageEnrichment } from '@/lib/data/crm/applyInboundMessageEnrichment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function personIdFrom(request: Request, body: { personId?: unknown } | null): number | null {
  const url = new URL(request.url)
  const raw = body?.personId ?? url.searchParams.get('personId')
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function handle(request: Request): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { personId?: unknown } | null = null
  if (request.method === 'POST') {
    try {
      body = (await request.json()) as { personId?: unknown }
    } catch {
      body = null
    }
  }
  const personId = personIdFrom(request, body)
  if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 })

  const result = await replayInboundMessageEnrichment(personId)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
