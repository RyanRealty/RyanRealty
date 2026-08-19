/**
 * Resolve the served fleet:public-ux:place-pages chrome-only slice, then release the parent.
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

const OWNER = 'cursor-loop-chain-bc-e3dbb660-2026-08-18t04-58'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'ab140f397'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'cd46e542c718c94e5d73c20316a66bf1',
    status: 'rejected',
    note: `/subdivisions/bella-vista H1 + No active listings + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'e58fd89289f409c212236bb52f6dc8bf',
    status: 'rejected',
    note: `/subdivisions/blue-ridge H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '5168e29ac0378db210301a7786052ec4',
    status: 'rejected',
    note: `/subdivisions/brookside H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '908a478b54ffcb92cc8cc5f0f644e3e0',
    status: 'rejected',
    note: `/subdivisions/buena-ventura H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '4ebd5de430bec74d07784754d74b77f3',
    status: 'rejected',
    note: `/subdivisions/big-sky H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '2585deb010c8d413d36624d1c0adfe51',
    status: 'rejected',
    note: `/subdivisions/brier-ridge H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'd9f1fadc723f141a5d3ccdd9b62d51b8',
    status: 'rejected',
    note: `/subdivisions/black-bear-meadows H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'ff222e2727a368d883465a90e0cd08cc',
    status: 'rejected',
    note: `/subdivisions/boyd-crossing H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
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
