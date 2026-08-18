/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v9.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-812b6297-2026-08-18t02-04'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'c2c6c0fb0'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '19ac3db1d801907c92b9f705bf5ab49c',
    status: 'fixed',
    note: `August monthly sold_count=1 median null hid July $1,262,500. publishCompleteMonthMedian prints July median sale. READY ${SHA}. 390+1280 after.`,
  },
  {
    fingerprint: '8fcc07cf97f716e5cd26fb1cf810aa6d',
    status: 'rejected',
    note: `/subdivisions/altura H1 + No active listings + sales history at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'f2153ef664e722d615739ec55c71cddd',
    status: 'rejected',
    note: `/subdivisions/american-west H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'd0508e9539716ffeb4906126d565f59c',
    status: 'rejected',
    note: `/subdivisions/antler-crossing H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '199da8484ac0297562003e5937f04071',
    status: 'rejected',
    note: `/subdivisions/arborwood H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'f7877ae5598b40c6a1590fa348cd15bb',
    status: 'rejected',
    note: `/subdivisions/awbrey-meadows H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'c7b2710f337bdabf47509b3af3eb2f64',
    status: 'rejected',
    note: `/subdivisions/big-sky-country H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'cf6bec01d48cf986d06fe1ac45251648',
    status: 'rejected',
    note: `/subdivisions/arrowdale H1 + empty-state + sales history. Chrome-only did not reproduce. READY ${SHA}.`,
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
