/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v10.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-59aff8be-2026-08-18t04-00'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = '2f30232a7'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '789bda6a8f5b0cab4fd1ecd1b90409e3',
    status: 'rejected',
    note: `/subdivisions/awbrey-view H1 + empty-state or cards + sales history at 390+1280. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '6d0144c5ec38edbcf55feffe01aa2347',
    status: 'rejected',
    note: `/subdivisions/bella-sera H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '39f6de8d289ae83c4967805c13c3791f',
    status: 'rejected',
    note: `/subdivisions/breckenridge H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '50653fb5dc6bc3a922db84c1adf470ee',
    status: 'rejected',
    note: `/subdivisions/ayres-acres H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '8fb9926803ef5ce09141caeac96d3950',
    status: 'rejected',
    note: `/communities/crooked-river-ranch title + H1 present at 390+1280. Claimed empty title/h1 did not reproduce. Crr* 0-homes class-fix is ${SHA} PR #96, not that fingerprint. SHA ${SHA}.`,
  },
  {
    fingerprint: 'c0ec3e83c45e6cbdff8954504ac962b2',
    status: 'rejected',
    note: `/subdivisions/bear-springs-acres H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '20729bd208955ea2a02ad441027139c2',
    status: 'rejected',
    note: `/subdivisions/brier-ridge H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
  },
  {
    fingerprint: '055a56ac39ac8a11ee03f6a87bc9cab4',
    status: 'rejected',
    note: `/subdivisions/cascade-meadow-ranch H1 + empty-state or cards + sales history. Chrome-only did not reproduce. SHA ${SHA}.`,
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
