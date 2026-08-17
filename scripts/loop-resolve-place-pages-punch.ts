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

const OWNER = 'cursor-loop-chain-bc-3a2506e2-2026-08-17t06-56'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'cf361ea46c820bff29a90d330ac62da4',
    status: 'fixed',
    note: 'South Meadow 3 / $795,000 after plat city aliases + v3 cache. READY d3bff1ccb. Not Sisters $699k.',
  },
  {
    fingerprint: '68e429f53384684f4bff707cec907db9',
    status: 'fixed',
    note: 'Tumalo 200 at /cities/tumalo. Pulse-only snapshot. 0 homes honest empty. No Bend redirect.',
  },
  {
    fingerprint: '53fbb339d4998dbc2b69d8375c772367',
    status: 'rejected',
    note: 'Deer Park 12=12. Plat median $862,498, not Sunriver $899k. Own inventory.',
  },
  {
    fingerprint: '57d1a8efa9cb58fea2fb01a302a340b7',
    status: 'rejected',
    note: 'Deschutes River Recreation Homesites 14=14. Own median $789,950. Not Bend city.',
  },
  {
    fingerprint: 'c87427f1ebc63801eb23de0f36973fc8',
    status: 'rejected',
    note: 'Rivers Edge Village 11=11. Own median $1,159,000. Not Bend city $756k.',
  },
  {
    fingerprint: 'e2f333fbad215d6ad15de6fd92c2f85b',
    status: 'fixed',
    note: 'Boyd Acres cards $949,900 and $899,900 exact ListPrice. formatPublishedAsk.',
  },
  {
    fingerprint: '7060207100ba86d1265142be18789906',
    status: 'fixed',
    note: 'Old Bend 425 State Street $1,999,500 exact. No thousand-round $2,000,000.',
  },
  {
    fingerprint: '75d190e8e72b7e04c338259a5feece40',
    status: 'fixed',
    note: 'Southern Crossing medianList $919,500. Bryanwood card $919,500. No $920,000.',
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
