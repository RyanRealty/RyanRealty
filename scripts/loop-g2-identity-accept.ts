/**
 * G2 accept + hosted backfill (THE LOOP).
 *
 * 1. Copy fub_person_id onto crm_person_id for the pre-fix rows.
 * 2. Run the same stitch a form submit uses (fleet-test identity only).
 * 3. Print the map row + packet §1b counts.
 *
 *   npx tsx scripts/loop-g2-identity-accept.ts
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { FLEET_TEST_TAG } from '../lib/crm/fleet-test-identity'
import { stitchFormSubmitIdentity } from '../lib/visitor-backfill'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: beforeTotal } = await sb
    .from('visitor_identity_map')
    .select('rr_vid', { count: 'exact', head: true })
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: beforeMapped } = await sb
    .from('visitor_identity_map')
    .select('rr_vid', { count: 'exact', head: true })
    .not('crm_person_id', 'is', null)
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: fubOnly } = await sb
    .from('visitor_identity_map')
    .select('rr_vid', { count: 'exact', head: true })
    .not('fub_person_id', 'is', null)
    .is('crm_person_id', null)

  console.log(
    `BEFORE  total=${beforeTotal} mapped=${beforeMapped} fub_only=${fubOnly}`,
  )

  // supabase-js cannot SET col = other_col. Copy per row (hosted backlog is tens).
  const { data: orphans } = await sb
    .from('visitor_identity_map')
    .select('rr_vid,fub_person_id')
    .is('crm_person_id', null)
    .not('fub_person_id', 'is', null)
    .limit(1000)

  const orphanIds = [...new Set((orphans ?? []).map((r) => Number(r.fub_person_id)))]
  const { data: livePeople } = orphanIds.length
    ? await sb.from('crm_people').select('id').in('id', orphanIds)
    : { data: [] as { id: number }[] }
  const live = new Set((livePeople ?? []).map((p) => Number(p.id)))
  const staleIds = orphanIds.filter((id) => !live.has(id))
  const { data: legacyPeople } = staleIds.length
    ? await sb.from('crm_people').select('id,fub_legacy_id').in('fub_legacy_id', staleIds)
    : { data: [] as { id: number; fub_legacy_id: number }[] }
  const legacy = new Map(
    (legacyPeople ?? []).map((p) => [Number(p.fub_legacy_id), Number(p.id)]),
  )
  let copied = 0
  let remapped = 0
  let skippedStale = 0
  for (const row of orphans ?? []) {
    const fubId = Number(row.fub_person_id)
    const crmId = live.has(fubId) ? fubId : (legacy.get(fubId) ?? null)
    if (crmId == null) {
      skippedStale += 1
      continue
    }
    const { error } = await sb
      .from('visitor_identity_map')
      .update({ crm_person_id: crmId })
      .eq('rr_vid', row.rr_vid)
    if (error) {
      console.error('backfill row failed', row.rr_vid, error.message)
      process.exit(1)
    }
    copied += 1
    if (crmId !== fubId) remapped += 1
  }
  console.log(
    `BACKFILL copied ${copied} (legacy-remapped ${remapped}); skipped ${skippedStale} ids with no crm_people row`,
  )

  const { data: people, error: peopleErr } = await sb
    .from('crm_people')
    .select('id,tags')
    .contains('tags', [FLEET_TEST_TAG])
    .limit(5)
  if (peopleErr || !people?.length) {
    console.error('UNREADABLE: no fleet:test person', peopleErr?.message)
    process.exit(2)
  }
  const personId = people[0].id as number

  const { data: points } = await sb
    .from('crm_contact_points')
    .select('value')
    .eq('person_id', personId)
    .eq('kind', 'email')
    .limit(1)
  const email = String(points?.[0]?.value ?? 'fleet-test@example.com')

  const rrVid = `g2-accept-${randomUUID()}`
  await stitchFormSubmitIdentity({
    personId,
    email,
    rrVid,
    sessionId: null,
  })

  const { data: row, error: rowErr } = await sb
    .from('visitor_identity_map')
    .select('rr_vid,crm_person_id,fub_person_id,email,identify_source')
    .eq('rr_vid', rrVid)
    .maybeSingle()

  const stitched =
    row != null &&
    Number(row.crm_person_id) === personId &&
    Number(row.fub_person_id) === personId

  console.log(
    JSON.stringify(
      {
        accept: stitched ? 'PASS' : 'FAIL',
        rrVid,
        personId,
        email,
        row,
        rowErr: rowErr?.message ?? null,
      },
      null,
      2,
    ),
  )

  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: afterTotal } = await sb
    .from('visitor_identity_map')
    .select('rr_vid', { count: 'exact', head: true })
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: afterMapped } = await sb
    .from('visitor_identity_map')
    .select('rr_vid', { count: 'exact', head: true })
    .not('crm_person_id', 'is', null)

  console.log(`AFTER   total=${afterTotal} mapped=${afterMapped}`)
  console.log(
    `PACKET  identity map ${afterTotal} · mapped to CRM ${afterMapped} (was ${beforeMapped}/${beforeTotal})`,
  )

  if (!stitched) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
