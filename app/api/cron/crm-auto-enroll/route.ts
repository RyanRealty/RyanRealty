/**
 * Auto-enrollment sweep — the catch-all that guarantees no new lead sits
 * outside a workflow regardless of which door it came through (LP, Meta
 * webhook, inbound SMS, manual FUB entry picked up by delta sync).
 *
 * Every 15 min: scan people created since the enrollment epoch (bounded to a
 * trailing 7-day window) and run the rules. The inline hook in the lead
 * tagger handles the hot path instantly; this closes every gap.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { autoEnrollPerson, ENROLLMENT_EPOCH, type AutoEnrollResult } from '@/lib/crm/enroll'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { classifyLeadSource } from '@/lib/data/crm/leadSourceTaxonomy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * The four master-sequence FUB plan ids — mirrors RULES in lib/crm/enroll.ts
 * (module-private there). Used ONLY for the advisory batch pre-filter below;
 * autoEnrollPerson keeps its own authoritative master-sequence check, so drift
 * here can cost speed, never correctness.
 */
const MASTER_PLAN_IDS = [71, 72, 69, 70]

/** Max ids per .in() clause (PostgREST URL-length safety, ~2 KB). */
const ID_CHUNK_SIZE = 150

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const startMs = Date.now()
  const sb = createServiceClient()

  // Overlap lease: unprocessed candidates still cost ~6 serial queries each
  // (the batch pre-filter below only fast-paths ALREADY-processed ones), so an
  // overrun would double-work the same window on the next tick. Skip an
  // overlapping run. Self-expires after 300s.
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'crm-auto-enroll', p_lease_seconds: 300 })
  if (gotLease === false) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }

  const windowStart = new Date(Math.max(
    new Date(ENROLLMENT_EPOCH).getTime(),
    Date.now() - 7 * 86400e3,
  )).toISOString()

  // COALESCE(fub_created_at, created_at) window: native (post-FUB-cutover) rows
  // never set fub_created_at, so a bare fub_created_at.gte excluded every native
  // lead from the sweep — the exact leads this catch-all exists for. Mirrors
  // autoEnrollPerson's own epoch check (fub_created_at ?? created_at).
  const { data: candidates, error } = await sb
    .from('crm_people')
    .select('id,name,source,stage,assigned_broker,tags,fub_created_at')
    .or(`fub_created_at.gte.${windowStart},and(fub_created_at.is.null,created_at.gte.${windowStart})`)
    .order('id', { ascending: false })
    .limit(300)
  if (error) {
    await sb.rpc('crm_release_cron_lease', { p_name: 'crm-auto-enroll' })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Batch pre-filters — the "already processed" markers, read in a handful of
  // round trips instead of ~6 serial queries per candidate on every 15-min tick
  // (the same 7-day window re-scans 96×/day, and nearly every candidate is a
  // no-op after its first pass):
  //   (a) already enrolled in a master sequence -> autoEnrollPerson would walk
  //       ~5 queries just to return 'already enrolled in a master sequence';
  //   (b) already sent the one-per-person new-lead alert (the crm_timeline
  //       dedupe row queueBrokerAlert writes) -> the queue call would re-read
  //       telephony and fail the dedupe insert.
  // Both are ADVISORY fast-paths: autoEnrollPerson and queueBrokerAlert keep
  // their own authoritative checks, so a miss here costs speed, not correctness.
  const rows = candidates ?? []
  const candidateIds = rows.map((p) => p.id as number)
  const alreadyEnrolled = new Set<number>()
  const alreadyAlerted = new Set<number>()
  if (candidateIds.length > 0) {
    const { data: masterSeqs } = await sb
      .from('crm_sequences')
      .select('id')
      .in('fub_legacy_plan_id', MASTER_PLAN_IDS)
    const masterIds = (masterSeqs ?? []).map((s) => s.id as number)
    await Promise.all(
      chunk(candidateIds, ID_CHUNK_SIZE).flatMap((ids) => [
        masterIds.length > 0
          ? sb
              .from('crm_sequence_enrollments')
              .select('person_id')
              .in('person_id', ids)
              .in('sequence_id', masterIds)
              .then(({ data }) => {
                for (const r of data ?? []) alreadyEnrolled.add(Number(r.person_id))
              })
          : Promise.resolve(),
        sb
          .from('crm_timeline')
          .select('person_id')
          .in('dedupe_key', ids.map((id) => `alert:new-lead:${id}`))
          .then(({ data }) => {
            for (const r of data ?? []) alreadyAlerted.add(Number(r.person_id))
          }),
      ]),
    )
  }

  let enrolled = 0
  let alerted = 0
  const skipped: Record<string, number> = {}
  for (const p of rows) {
    // OUTREACH LISTS NEVER AUTO-ENROLL OR ALERT. Skip-traced expired/FSBO
    // owners and Farm/Import/Sphere rows are lists WE built — not inbound
    // leads. Their intent:expired-listing / intent:fsbo tags map to the
    // texting sequences (plans 71/72), and those sends are manual
    // approve-and-send by design (docs in the expired/FSBO dashboards). The
    // old fub_created_at-only window excluded these rows by accident; now
    // that native rows are swept, the exclusion is explicit and principled:
    // the same taxonomy line every lead KPI draws. Homeowners who submitted
    // OUR forms (expired-lp / fsbo-lp sources) classify as inbound and still
    // enroll.
    if (classifyLeadSource(p.source as string | null).outreachList) {
      skipped['outreach-list source (manual outreach only)'] =
        (skipped['outreach-list source (manual outreach only)'] ?? 0) + 1
      continue
    }
    const skipEnroll = alreadyEnrolled.has(p.id)
    const skipAlert = alreadyAlerted.has(p.id)
    if (skipEnroll && skipAlert) {
      // Fully processed on a prior tick — zero per-candidate queries.
      skipped['already processed (batch)'] = (skipped['already processed (batch)'] ?? 0) + 1
      continue
    }

    let r: AutoEnrollResult
    if (skipEnroll) {
      r = { enrolled: false, reason: 'already enrolled in a master sequence' }
    } else {
      r = await autoEnrollPerson(p.id)
    }
    if (r.enrolled) enrolled++
    else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1

    // Instant broker text on every NEW lead (any door: LP, FUB entry, Meta,
    // IDX registration via delta, inbound SMS, detection crons). Dedup is in
    // queueBrokerAlert; the relay on the mini delivers within ~45s.
    if (skipAlert) continue
    if ((p.tags ?? []).includes('compliance:hard-stop')) continue
    const queued = await queueBrokerAlert({
      broker: p.assigned_broker,
      personId: p.id,
      kind: 'new-lead',
      body: newLeadAlertBody({
        name: p.name,
        source: p.source,
        stage: p.stage,
        personId: p.id,
        detail: r.enrolled ? 'Auto-enrolled in nurture workflow.' : null,
      }),
    })
    if (queued) alerted++
  }

  await sb.rpc('crm_release_cron_lease', { p_name: 'crm-auto-enroll' })
  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    enrolled,
    alerted,
    skipped,
    duration_ms: Date.now() - startMs,
  })
}
