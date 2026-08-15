import { NextRequest, NextResponse } from 'next/server'
import { insertFleetFinding, validateFindingDraft } from '@/lib/data/loop/fleet'

/**
 * Findings inbox for the external verification fleet (Grok Bots).
 * THE LOOP v1.6.0 — bots browse production like users; when a case brief's
 * expected state does not match what they observe, they POST here.
 *
 * Auth: `x-fleet-secret` header must equal CRON_SECRET (interim v1 token —
 * the same operator secret that guards crons; bots receive it inside their
 * brief. Rotate to a dedicated FLEET_SECRET when the fleet grows beyond
 * Matt's own bots).
 *
 * This endpoint only INSERTS validated findings. Conversion into work-graph
 * nodes happens in-session via scripts/fleet-intake.ts, where the adversarial
 * confirm rule applies — a bot report is a lead, not a verdict.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim() || request.headers.get('x-fleet-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const { draft, error } = validateFindingDraft(body)
  if (!draft) return NextResponse.json({ error }, { status: 400 })

  const result = await insertFleetFinding(draft)
  if (!result.data) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json(
    result.data.duplicate
      ? { ok: true, duplicate: true, note: 'already reported — thank you, no action needed' }
      : { ok: true, id: result.data.id },
    { status: result.data.duplicate ? 200 : 201 },
  )
}
