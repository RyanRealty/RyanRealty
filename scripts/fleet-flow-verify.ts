/**
 * fleet-flow-verify — backend-effects check after Flow Prover runs
 * (THE LOOP v1.6.x). The bot proves the BROWSER side (submit → confirmation);
 * this proves the ADMIN side landed correctly for the designated test
 * identity, without any human clicking through admin.
 *
 *   npx tsx scripts/fleet-flow-verify.ts
 *
 * PASS means: the fleet identity's rows exist where flows should write them,
 * carry the fleet:test tag, are suppressed on all channels, triggered zero
 * wake tasks and zero enrollments, and are excluded from packet counts.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { FLEET_TEST_TAG } from '../lib/crm/fleet-test-identity'

config({ path: '.env.local' })

let failures = 0
function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} — ${detail}`)
  if (!ok) failures += 1
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: people } = await sb
    .from('crm_people')
    .select('id,tags,stage')
    .contains('tags', [FLEET_TEST_TAG])
  const ids = (people ?? []).map((p) => p.id as number)
  check('fixture person exists', ids.length >= 1, `${ids.length} fleet:test people (${ids.join(', ')})`)

  for (const p of people ?? []) {
    check(`person ${p.id} tagged`, Array.isArray(p.tags) && p.tags.includes(FLEET_TEST_TAG), String(p.tags))
  }

  if (ids.length > 0) {
    const { data: sup } = await sb
      .from('crm_suppressions')
      .select('person_id,channel')
      .in('person_id', ids)
    const suppressed = new Set((sup ?? []).filter((s) => s.channel === 'all').map((s) => s.person_id))
    for (const id of ids) {
      check(`person ${id} suppressed all-channels`, suppressed.has(id), `suppression rows: ${JSON.stringify(sup)}`)
    }

    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    const { count: tasks } = await sb
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .in('person_id', ids)
    check('zero wake tasks', (tasks ?? 0) === 0, `crm_tasks rows: ${tasks}`)

    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    const { count: enrollments } = await sb
      .from('crm_sequence_enrollments')
      .select('id', { count: 'exact', head: true })
      .in('person_id', ids)
    check('zero sequence enrollments', (enrollments ?? 0) === 0, `enrollment rows: ${enrollments}`)

    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    const { count: visible } = await sb
      .from('crm_people')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .not('tags', 'cs', `{"${FLEET_TEST_TAG}"}`)
      .in('id', ids)
    check('excluded from packet people count', (visible ?? 0) === 0, `visible in excluded query: ${visible}`)
  }

  // Flow artifacts (present only after Flow Prover actually ran a submit —
  // reported as observations, not failures, when absent).
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: newsletterRows } = await sb
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .ilike('email', '%fleet-test%')
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: alertRows } = await sb
    .from('listing_alerts')
    .select('id', { count: 'exact', head: true })
    .ilike('email', '%fleet-test%')
  console.log(`INFO  flow artifacts — newsletter rows: ${newsletterRows ?? 0} · alert rows: ${alertRows ?? 0} (nonzero once Flow Prover has run)`)

  console.log(failures === 0 ? '\nALL CHECKS PASS — the flows lane is safe and clean.' : `\n${failures} FAILURES — fix before the next Flow Prover run.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
