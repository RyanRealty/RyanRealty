/**
 * POST /api/listing-alerts/pause
 *
 * Pause a subscriber's digest for N days. Triggered by:
 *   1. The seller-workflow-pause cron (extended to buyer + listing-alerts
 *      flows) when an inbound broker→subscriber message is detected.
 *   2. A FUB webhook (when one exists).
 *   3. Matt directly from the admin queue.
 *
 * Request shape (JSON):
 *   {
 *     "email":           string,     // required
 *     "reason":          string,     // optional — e.g. "broker engaged", "manual"
 *     "duration_days":   number,     // optional; defaults to 14
 *     "source_lp":       string      // optional — narrows to one row when subscriber has multiple
 *   }
 *
 * Auth: requires the `FUB_WEBHOOK_SECRET` shared-secret in the
 * `x-listing-alerts-secret` header. The same secret authenticates manual
 * admin-side calls. If the secret is not configured we fall back to the
 * CRON_SECRET bearer so this endpoint is callable from internal cron jobs.
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 Step 10 + §4.3
 */
import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const webhookSecret = process.env.FUB_WEBHOOK_SECRET?.trim()
  const headerSecret = req.headers.get('x-listing-alerts-secret')?.trim()
  if (webhookSecret && headerSecret && headerSecret === webhookSecret) return true

  const cronSecret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.trim()
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 })

  const sourceLp = typeof body.source_lp === 'string' ? body.source_lp.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : null
  const durationDays =
    typeof body.duration_days === 'number' && Number.isFinite(body.duration_days) && body.duration_days > 0
      ? Math.min(365, Math.round(body.duration_days))
      : 14

  const now = new Date()
  const pausedUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createServiceClient()
  let query = supabase
    .from('listing_alerts')
    .update({
      status: 'paused',
      paused_until: pausedUntil,
      pause_reason: reason,
      updated_at: now.toISOString(),
    })
    .eq('email', email)
  if (sourceLp) query = query.eq('source_lp', sourceLp)
  // Don't override unsubscribed rows.
  query = query.neq('status', 'unsubscribed')

  const { data, error } = await query.select('id, source_lp, status, paused_until')
  if (error) {
    console.error('[listing-alerts/pause] update failed:', error)
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    updated: data?.length ?? 0,
    paused_until: pausedUntil,
    rows: data ?? [],
  })
}
