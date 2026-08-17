/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v5.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-17t09-06-ba29'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'a61efd1e6ad26d96368812477e7ce936',
    status: 'rejected',
    note: 'Calaveras hero silent (no 5-home claim). List 5 cards $510k–$439k. Not empty. 390+1280.',
  },
  {
    fingerprint: '1bbfd2db24998354d1bd045427d34ca8',
    status: 'rejected',
    note: '1925 Townhomes has no 155 Closed · 30 days and no $756k/18 days. Sales history 33 SFR. 1 card $999,000.',
  },
  {
    fingerprint: '6a8039c32e747fd9f5fda3346400d703',
    status: 'rejected',
    note: 'Blakley Heights hero silent (no 9-home claim). List 8 cards, not empty. 390+1280.',
  },
  {
    fingerprint: '862d00a45aa6262703b5e55b2d54ef29',
    status: 'rejected',
    note: 'Aspenwood hero silent (no 1-home claim). List 1 card 353 Aspenwood $710,000. Not empty.',
  },
  {
    fingerprint: 'b7d975505a2ac93f926fc958f3a9f8d9',
    status: 'rejected',
    note: 'Canyon Breeze hero silent (no 1-home claim). List 1 card 19658 Harvard. Not empty.',
  },
  {
    fingerprint: '51ca9d001268ae8b33e355868c6d3507',
    status: 'rejected',
    note: 'Aubrey Heights hero silent (no 1-home claim). List 1 card 1991 1st. Not empty.',
  },
  {
    fingerprint: '7e61cd0d52a6d2f3e67964c49c16303e',
    status: 'rejected',
    note: 'Summit West list + ticker both $2,034,500 at 3393 Celilo and $1,999,900 at 3437 Celilo. 0 of $2,035,000.',
  },
  {
    fingerprint: '963b10a69e7020dee77bd76ccf98c199',
    status: 'rejected',
    note: 'Bend Park hero silent. No $756,000 / 18 days. List 4 cards $1,195,000–$475,000. 390+1280.',
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
