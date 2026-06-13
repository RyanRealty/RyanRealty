import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Expired-listing outreach backfill (Matt directive 2026-06-12).
 *
 * For the last N detected expired listings that we have a contactable CRM
 * person for, queue the two-text opening of the Expired Recovery workflow:
 *   Text 1 → the expired landing page + "a CMA is coming in a separate text"
 *   Text 2 → the CMA link (built by the producer, held until it exists)
 *
 * Nothing SENDS here. Text 1 lands as the enrollment's first touch in the
 * broker-approval queue (status awaiting_broker); both texts are written as
 * visible "queued" timeline rows so the broker sees the full pending thread.
 * Actual delivery happens through the live sequence engine once the broker
 * approves and the A2P campaign verifies.
 *
 * Uses the real createCmaRequest path so each expired property gets a CMA
 * draft + producer action row + the cmaLink stamped on the contact (which is
 * what Text 2 links to).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://ryan-realty.com/api/cron/expired-outreach-backfill?limit=10"
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return (request.headers.get('authorization') ?? '') === `Bearer ${secret}`
}

const LP_URL = 'https://ryan-realty.com/lp/expired-listing'

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit') ?? '10')))
  const dryRun = url.searchParams.get('dry') === '1'

  const sb = createServiceClient()
  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const { createCmaRequest, cmaPublicUrl } = await import('@/lib/cma-request')
  const { isSuppressed } = await import('@/lib/crm/suppressions')

  // Resolve the Expired Recovery sequence.
  const { data: seq } = await sb.from('crm_sequences').select('id,name').ilike('name', '%expired%').limit(1).maybeSingle()
  if (!seq) return NextResponse.json({ error: 'Expired Recovery sequence not found' }, { status: 500 })

  // Last N expired detections.
  const { data: expired } = await sb
    .from('expired_listings')
    .select('id,full_address,city,fub_person_id,contact_phone,expired_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  const results: Array<Record<string, unknown>> = []
  let queued = 0

  for (const e of expired ?? []) {
    const row: Record<string, unknown> = { address: e.full_address, expired_at: e.expired_at }
    const fubId = e.fub_person_id as number | null
    if (!fubId) { row.skipped = 'no contact resolved (skip trace pending)'; results.push(row); continue }

    const { data: person } = await sb
      .from('crm_people')
      .select('id,name,first_name,custom,tags,phones,assigned_broker,fub_legacy_id')
      .eq('fub_legacy_id', fubId)
      .maybeSingle()
    if (!person) { row.skipped = 'no CRM person'; results.push(row); continue }
    row.crm_id = person.id
    row.name = person.name

    const hardStop = (person.tags as string[] | null)?.includes('compliance:hard-stop')
    const gate = hardStop ? { suppressed: true, reasons: ['hard-stop'] } : await isSuppressed(person.id as number, 'sms')
    if (gate.suppressed) { row.skipped = `suppressed (${gate.reasons.join(', ')})`; results.push(row); continue }

    const phone = (person.phones as Array<{ value?: string }> | null)?.[0]?.value
      ?? (await sb.from('crm_contact_points').select('value').eq('person_id', person.id).eq('kind', 'phone').limit(1).maybeSingle()).data?.value
    if (!phone) { row.skipped = 'no phone on file'; results.push(row); continue }

    if (dryRun) { row.would_queue = true; results.push(row); continue }

    // 1. Ensure a CMA is requested for the property (real path; stamps cmaLink).
    let cmaLink = (person.custom as Record<string, unknown> | null)?.cmaLink as string | undefined
    if (!cmaLink) {
      const cmaRes = await createCmaRequest({
        rawAddress: e.full_address as string,
        parsedStreet: null,
        parsedCity: (e.city as string) ?? null,
        parsedState: 'OR',
        parsedPostalCode: null,
        leadEmail: null,
        leadName: (person.name as string) ?? null,
        leadPhone: phone,
        leadTimeline: 'ready-now',
        leadClassification: 'hot',
        fubPersonId: fubId,
        requestSource: 'expired-listing-cron',
        notifyLead: false,
      })
      if (cmaRes.ok) cmaLink = cmaPublicUrl(cmaRes.slug)
      row.cma = cmaRes.ok ? `requested (${cmaRes.slug})` : `failed: ${cmaRes.error}`
    } else {
      row.cma = 'already requested'
    }

    // 2. Render both texts (address injected so %address% resolves for expired).
    const mergeCtx = {
      first_name: person.first_name as string | null,
      name: person.name as string | null,
      custom: { ...(person.custom as Record<string, unknown> | null ?? {}), customPropertyAddress: e.full_address, cmaLink },
    }
    const slug = person.assigned_broker as string | null
    const text1 = attributeSiteLinks(
      renderCrmMerge(`Hi %first%, this is Matt Ryan, principal broker at Ryan Realty in Bend. I saw your listing at %address% came off the market without selling. Here is a quick rundown of why that happens and what to do next: ${LP_URL} I am pulling together a current market analysis of your home and will text it to you in a separate message shortly. Reply STOP to opt out.`, mergeCtx),
      slug,
    )
    const text2 = renderCrmMerge(`Hi %first%, here is the market analysis I put together for %address%: %cma_link% It shows what your home could realistically bring in today's market. Happy to walk you through it, no pressure. Reply STOP to opt out.`, mergeCtx)

    // 3. Reset/ensure the Expired Recovery enrollment at step 0, awaiting the
    //    broker's approval of the first text.
    const { data: existing } = await sb.from('crm_sequence_enrollments').select('id').eq('person_id', person.id).eq('sequence_id', seq.id).maybeSingle()
    if (existing) {
      await sb.from('crm_sequence_enrollments').update({
        step_index: 0, status: 'awaiting_broker', first_touch_override: text1,
        next_run_at: new Date().toISOString(), approved_by: null, approved_at: null, updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await sb.from('crm_sequence_enrollments').insert({
        person_id: person.id, sequence_id: seq.id, step_index: 0, status: 'awaiting_broker',
        first_touch_override: text1, enrolled_by: 'expired-outreach-backfill', next_run_at: new Date().toISOString(),
      })
    }

    // 4. Visible "queued" rows so the broker sees both texts pending now.
    await sb.from('crm_timeline').upsert([
      {
        person_id: person.id, kind: 'system', title: 'Text 1 queued — expired guide + CMA coming',
        body: text1, source: 'expired-outreach', dedupe_key: `expired-outreach-1:p${person.id}`,
        payload: { queued: true, step: 0, awaiting: 'broker approval + A2P' },
      },
      {
        person_id: person.id, kind: 'system', title: 'Text 2 queued — CMA link (sends after the CMA is built)',
        body: text2, source: 'expired-outreach', dedupe_key: `expired-outreach-2:p${person.id}`,
        payload: { queued: true, step: 1, awaiting: 'CMA build + A2P', cmaLink },
      },
    ], { onConflict: 'dedupe_key' })

    row.queued = ['text1:expired-LP', 'text2:CMA']
    queued++
    results.push(row)
  }

  return NextResponse.json({ ok: true, sequence: seq.name, scanned: (expired ?? []).length, queued, results })
}
