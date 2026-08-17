/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v4.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-96d8d9d5-2026-08-17t07-47'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '0ae2deac132d4c1bb311935af7da5010',
    status: 'fixed',
    note: 'Southern Crossing hero/HUD/FAQ/sell $919,500. kbMoneyFull + formatPriceExact. READY 3168f52fc. No $920,000 median.',
  },
  {
    fingerprint: 'cc63ca33d641bc676e1406b87129e8dc',
    status: 'rejected',
    note: 'Tetherow median is $1,499,000. $1,199,500 is 19305 Brookside Way, not a second median.',
  },
  {
    fingerprint: '32b26579642a71c475df533c5f408315',
    status: 'rejected',
    note: '2322 High Lakes $1,549,900 and 2745 Ordway $439,500 / $849,950 already exact. HUD $1,200,000 vs hero $1,199,900 was the Southern Crossing class and shipped with it.',
  },
  {
    fingerprint: '2ed14c72914c260b536879cac3cfbb9f',
    status: 'rejected',
    note: 'Widgi Creek card/FAQ 10 days. No 23 days. Sell caption is Widgi Creek median $1,087,000, not Regional.',
  },
  {
    fingerprint: 'b674a34b13544bb84abe67fdd01b75c1',
    status: 'rejected',
    note: 'Awbrey Court has no 155 Closed · 30 days. Sales history 26 single-family since 2004. Hero 0 / no active listings.',
  },
  {
    fingerprint: '5bf645a0500c20bd39d904f0f0e0c51f',
    status: 'rejected',
    note: 'Amber Springs hero does not claim 2 homes. List has 2 cards (Kingwood, Kilnwood). Not empty.',
  },
  {
    fingerprint: '58040bd75dad88317326efc0ea6a1b09',
    status: 'rejected',
    note: 'Bailey hero does not claim 2 homes. List has 2 cards (Elaine, Lois). Not empty.',
  },
  {
    fingerprint: '302801acc99ceee47b4bec6196978c82',
    status: 'rejected',
    note: 'Bradetich Park hero does not claim 1 home. List has 1 card (Bunchgrass). Not empty.',
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
