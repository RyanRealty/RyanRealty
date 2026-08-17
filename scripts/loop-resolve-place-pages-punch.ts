/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-b73a7e1b-2026-08-17t08-20'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '14ae20dcbfdea1fb4621389855014f62',
    status: 'rejected',
    note: 'Braydon Park hero is "Single-family homes…", not 1 homes. List+map 1 Active $500,000 at 1113 22nd. 390+1280.',
  },
  {
    fingerprint: 'e48365e95b43140a3fdc70368aca9548',
    status: 'rejected',
    note: 'Brooktree hero has no count. List has 1 href 432 Oak. Empty-list claim does not reproduce. 390+1280.',
  },
  {
    fingerprint: '8efc63671d79942215272b5a28a37ffe',
    status: 'rejected',
    note: 'Centennial Glen hero has no count. Empty list is honest. 111 closings since 2005. No See-homes door. 390+1280.',
  },
  {
    fingerprint: 'c04765fbe4e8fe853613693dc3db29d4',
    status: 'rejected',
    note: 'Choctaw Village hero has no count. List has 1 href 2849 Lotno. Not empty. 390+1280.',
  },
  {
    fingerprint: 'd24ef436e7695a27499cc90282c8e034',
    status: 'rejected',
    note: 'Aspen Meadows 0 homes + empty list. No 4 Closed · 30 days. YTD Homes sold 0 vs 33 since 1997 is grain, not leak.',
  },
  {
    fingerprint: 'a88b100d354f325dfddc37d07ab3b149',
    status: 'rejected',
    note: 'Canyon View hero has no count. List has 1 href 1443 Canyon. Empty-list claim does not reproduce. 390+1280.',
  },
  {
    fingerprint: '0b52d2f7aa35931445220efe444840fd',
    status: 'rejected',
    note: 'Alstrup 1 card $542,500 at 20431 Cider. No $756,000. No 155 Closed. Parent leak does not reproduce. 390+1280.',
  },
  {
    fingerprint: '3516d9bd962819b2ab41edff9c2e893e',
    status: 'rejected',
    note: '1925 Townhomes hero has no count. List has 1 href 20339 Jack Benny. Empty-list claim does not reproduce. 390+1280.',
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
