/**
 * Resolve the served fleet:public-ux:place-pages slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v11.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-3e78ee0e-2026-08-18t05-18'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'd5a59f3c3'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '8e8c9d3f8a2e96474c3e3dc68e4f9418',
    status: 'rejected',
    note: `/subdivisions/alder-glen H1 + No active listings + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '75a80eed4efe37d27be9625fb53b88bd',
    status: 'rejected',
    note: `/subdivisions/blue-ridge H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '5decd1d10869ca707e4e4d722c422253',
    status: 'rejected',
    note: `/subdivisions/boyd-crossing H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '4331f59fc7a1a74e84eacae8cceae11b',
    status: 'fixed',
    note: `/cities/bend/summit-west Updated 10:20 PM + FAQ as of August 2026 reproduced at 390+1280. Class publishPulseFreshness names the Pacific calendar day. SHA ${SHA}.`,
  },
  {
    fingerprint: 'dc2de9a28a0478a0affb515a76d12ff8',
    status: 'rejected',
    note: `/subdivisions/canyon-ridge-phase-3 H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '27a6b1a2c87acd3772995c60bb0bb4e5',
    status: 'rejected',
    note: `/subdivisions/canyon-view H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '6641f11706b289110d705a8d57438a77',
    status: 'rejected',
    note: `/subdivisions/ambrosia-acres H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '0ad1646a7a408d6087a375155e2de878',
    status: 'rejected',
    note: `/subdivisions/cascade H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,title,objective,owner_session')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }
  const objective = appendPunchDispositions(String(row.objective ?? ''), RESOLUTIONS)
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({ objective, updated_at: new Date().toISOString() })
    .eq('id', ID)
    .select('id,objective,state,owner_session')
    .single()
  if (error || !data?.id) {
    console.error('resolve failed', error?.message ?? 'no row')
    process.exit(1)
  }
  const openRemaining = openPunchLines(String(data.objective ?? '')).length
  console.log(JSON.stringify({ resolved: true, id: data.id, openRemaining }, null, 2))

  if (data.state === 'in_progress' && data.owner_session === OWNER && isLegalTransition('in_progress', 'open')) {
    const { data: released, error: relErr } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'open',
        owner_session: null,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ID)
      .eq('state', 'in_progress')
      .eq('owner_session', OWNER)
      .select('id,state,owner_session')
      .single()
    if (relErr || !released?.id) {
      console.error('release failed', relErr?.message ?? 'no row')
      process.exit(1)
    }
    console.log(JSON.stringify({ released: true, row: released }, null, 2))
  } else {
    console.log(JSON.stringify({ released: false, state: data.state, owner: data.owner_session }, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
