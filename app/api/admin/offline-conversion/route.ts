/**
 * POST /api/admin/offline-conversion — Phase 6 (full-funnel attribution).
 *
 * Upload an OFFLINE conversion (a lead milestone: signed listing, under
 * contract, closed) back to Meta so the ad that drove the original click gets
 * credited — closed-loop ROAS. Admin-gated. The hashing / dedup / Meta call live
 * in lib/meta-offline-conversions.ts. A future cron can call uploadOfflineConversion
 * directly once the closed-deal -> stored-fbc join is decided (which Vault status
 * / FUB stage counts as a conversion is a business-process call).
 *
 * Body: { milestone, dedupKey, email?, phone?, fbc?, firstName?, lastName?,
 *         value?, eventTimeSec?, ldu?, testEventCode? }
 *   - milestone: listing_signed | buyer_signed | under_contract | closed
 *   - dedupKey:  stable per lead+milestone (e.g. "fub-12345") -> event_id so a
 *                retry / re-run never double-counts the conversion.
 *   - testEventCode: routes to the Events Manager Test tab (no real conversion).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { uploadOfflineConversion, type OfflineMilestone } from '@/lib/meta-offline-conversions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MILESTONES: OfflineMilestone[] = ['listing_signed', 'buyer_signed', 'under_contract', 'closed']

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const adminRole = await getAdminRoleForEmail(user.email)
  if (!adminRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const milestone = body.milestone as OfflineMilestone
  if (!MILESTONES.includes(milestone)) {
    return NextResponse.json({ error: `milestone must be one of: ${MILESTONES.join(', ')}` }, { status: 400 })
  }
  const dedupKey = typeof body.dedupKey === 'string' ? body.dedupKey.trim() : ''
  if (!dedupKey) return NextResponse.json({ error: 'dedupKey required (idempotency)' }, { status: 400 })

  const result = await uploadOfflineConversion({
    milestone,
    email: typeof body.email === 'string' ? body.email : null,
    phone: typeof body.phone === 'string' ? body.phone : null,
    firstName: typeof body.firstName === 'string' ? body.firstName : null,
    lastName: typeof body.lastName === 'string' ? body.lastName : null,
    fbc: typeof body.fbc === 'string' ? body.fbc : null,
    fbp: typeof body.fbp === 'string' ? body.fbp : null,
    value: typeof body.value === 'number' ? body.value : null,
    eventTimeSec: typeof body.eventTimeSec === 'number' ? body.eventTimeSec : undefined,
    eventId: `offline:${milestone}:${dedupKey}`,
    ldu: body.ldu === true,
    testEventCode: typeof body.testEventCode === 'string' ? body.testEventCode : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
