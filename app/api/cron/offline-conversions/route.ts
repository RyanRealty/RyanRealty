// cron: registered in vercel.json
/**
 * Closed-loop ROAS — upload real deal milestones back to Meta.
 *
 * THE PROBLEM THIS SOLVES. Meta only ever saw the form fill, so it optimized for
 * cheap leads, because a cheap lead was the only outcome it could measure. Every
 * report we could produce answered cost-per-LEAD. Nobody could answer
 * cost-per-CLOSING, which is the only number that says whether the spend worked.
 *
 * `lib/meta-offline-conversions.ts` has done the upload since Phase 6, but nothing
 * ever called it: the one caller was an admin endpoint a human had to POST by hand,
 * and its own docblock left the deal→milestone join open as a business decision.
 * So the closed loop existed and had never once closed.
 *
 * TIMING IS THE WHOLE CONSTRAINT. Meta's /events endpoint rejects an event_time
 * older than about 7 days. A closing from three months ago cannot be uploaded at
 * all — there is no backfill. That is why this runs daily and why it had to be
 * built BEFORE spend resumes rather than bolted on after.
 *
 * WHAT IT DOES. Finds deals that entered a milestone stage inside the upload
 * window, resolves the person's hashed match keys, and uploads once per
 * (deal, milestone) through the shared idempotency ledger so a retry or a
 * re-deploy can never double-count a conversion.
 *
 * PRIVACY. A contact carrying a channel='all' suppression is SKIPPED entirely,
 * never uploaded under Limited Data Use. That suppression is what the GPC
 * opt-out path writes (app/api/visitors/track/route.ts) and what pulls someone
 * from Meta audiences; a do-not-sell signal means do not send them, not send
 * them with a flag. Only SHA-256 hashes leave this process — raw email or phone
 * reaching Meta is a compliance failure (lib/meta-offline-conversions.ts).
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 * Dry run: ?dryRun=1 reports what it WOULD upload and sends nothing.
 * Test mode: ?testEventCode=TEST123 routes to the Events Manager Test tab.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { uploadOfflineConversion } from '@/lib/meta-offline-conversions'
import { withIdempotency } from '@/lib/crm/idempotency'
import { primaryValue } from '@/lib/crm/merge'
import {
  UPLOAD_WINDOW_DAYS,
  conversionValue,
  milestoneForStage,
  withinUploadWindow,
} from '@/lib/marketing/offline-milestones'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type DealRow = {
  id: number
  person_id: number | null
  stage: string | null
  entered_stage_at: string | null
  actual_close_date: string | null
  commission_dollars: number | null
  assigned_broker: string | null
}

type PersonRow = {
  id: number
  first_name: string | null
  last_name: string | null
  emails: unknown
  phones: unknown
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  let sb: ReturnType<typeof createServiceClient>
  try {
    sb = createServiceClient()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Supabase service role not configured' },
      { status: 500 },
    )
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const testEventCode = request.nextUrl.searchParams.get('testEventCode')?.trim() || undefined
  const now = new Date()
  const since = new Date(now.getTime() - UPLOAD_WINDOW_DAYS * 86400_000).toISOString()

  const uploaded: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  const { data: deals, error: dealErr } = await sb
    .from('crm_deals')
    .select('id,person_id,stage,entered_stage_at,actual_close_date,commission_dollars,assigned_broker')
    .gte('entered_stage_at', since)
    .order('entered_stage_at', { ascending: true })
    .limit(500)
  if (dealErr) {
    return NextResponse.json({ error: `deal read failed: ${dealErr.message}` }, { status: 500 })
  }

  for (const deal of (deals ?? []) as DealRow[]) {
    const milestone = milestoneForStage(deal.stage)
    if (!milestone) continue

    if (!deal.person_id) {
      skipped.push(`deal ${deal.id}: no person_id — nothing to match on`)
      continue
    }
    if (!deal.entered_stage_at) {
      skipped.push(`deal ${deal.id}: no entered_stage_at — cannot date the event`)
      continue
    }
    const milestoneAt = new Date(deal.entered_stage_at)
    if (!withinUploadWindow(milestoneAt, now)) {
      skipped.push(`deal ${deal.id}: ${milestone} is outside the ${UPLOAD_WINDOW_DAYS}-day window`)
      continue
    }

    // A do-not-sell / GPC opt-out means do not send them at all.
    const { data: supp, error: suppErr } = await sb
      .from('crm_suppressions')
      .select('channel')
      .eq('person_id', deal.person_id)
      .eq('channel', 'all')
      .limit(1)
    if (suppErr) {
      // Fail CLOSED, exactly like the send chokepoint: an unreadable compliance
      // table means we do not upload, rather than risk sharing an opted-out
      // contact with an ad platform.
      skipped.push(`deal ${deal.id}: suppression table unreadable — failing closed`)
      continue
    }
    if ((supp ?? []).length > 0) {
      skipped.push(`deal ${deal.id}: contact is suppressed (do-not-sell) — never uploaded`)
      continue
    }

    const { data: person, error: personErr } = await sb
      .from('crm_people')
      .select('id,first_name,last_name,emails,phones')
      .eq('id', deal.person_id)
      .maybeSingle()
    if (personErr || !person) {
      skipped.push(`deal ${deal.id}: person ${deal.person_id} not readable`)
      continue
    }
    const p = person as PersonRow
    const email = primaryValue(p.emails)
    const phone = primaryValue(p.phones)

    // The stored Meta click id, when this person ever arrived from an ad. It is
    // the strongest attribution key, but it is optional — Meta matches on hashed
    // email or phone too, which is the path that actually fires today.
    const { data: sessions } = await sb
      .from('visitor_sessions')
      .select('fbclid')
      .eq('crm_person_id', deal.person_id)
      .not('fbclid', 'is', null)
      .order('first_seen_at', { ascending: true })
      .limit(1)
    const fbclid = (sessions ?? [])[0]?.fbclid as string | undefined
    const fbc = fbclid ? `fb.1.${Math.floor(milestoneAt.getTime() / 1000)}.${fbclid}` : null

    if (!email && !phone && !fbc) {
      skipped.push(`deal ${deal.id}: no email, phone or click id — nothing Meta can match`)
      continue
    }

    const eventId = `deal:${deal.id}:${milestone}`
    const value = conversionValue(milestone, deal.commission_dollars)

    if (dryRun) {
      uploaded.push(
        `WOULD upload ${eventId}${value != null ? ` value=$${value}` : ''}` +
          ` keys=[${[email && 'email', phone && 'phone', fbc && 'fbc'].filter(Boolean).join(',')}]`,
      )
      continue
    }

    try {
      const res = await withIdempotency(
        { key: eventId, scope: 'meta_offline_conversion' },
        () =>
          uploadOfflineConversion({
            milestone,
            email,
            phone,
            firstName: p.first_name,
            lastName: p.last_name,
            fbc,
            value,
            eventTimeSec: Math.floor(milestoneAt.getTime() / 1000),
            eventId,
            testEventCode,
          }),
      )
      if (res.ok) {
        uploaded.push(`${eventId}${value != null ? ` value=$${value}` : ''}`)
      } else {
        errors.push(`${eventId}: ${res.error}`)
      }
    } catch (e) {
      errors.push(`${eventId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dryRun,
    windowDays: UPLOAD_WINDOW_DAYS,
    dealsScanned: (deals ?? []).length,
    uploaded,
    skipped,
    errors,
    ranAt: now.toISOString(),
  })
}
