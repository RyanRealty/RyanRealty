/**
 * Resolve the served fleet:public-ux:site punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-site-punch.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-2026-08-17t02-40-c49f'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '615845e728efe9ee9fa36f855155d2f0',
    status: 'rejected',
    note: 'Bend town door and /cities/bend both 483 ACTIVE / $756,000 at 390+1280. Stale.',
  },
  {
    fingerprint: '0ec3012133f7feee0b76ebb30f137124',
    status: 'rejected',
    note: 'Fleet-test email confirmed Set on 1280 after ~40s. No silent empty revert. Do not invent alert rewrite.',
  },
  {
    fingerprint: '77739293beb758575692181ffec8afaf',
    status: 'rejected',
    note: 'Same alert class as 0ec30121. 1280 Set. 390 still Setting up at screenshot, not empty revert.',
  },
  {
    fingerprint: 'f50976fada396c0e892234a348f527a6',
    status: 'rejected',
    note: 'Hero and map settle at 1,836. Mid-count is map count-up. Town-door sum is a different labeled set.',
  },
  {
    fingerprint: 'ac0910650588c9170979822e660e771b',
    status: 'rejected',
    note: 'Search + See homes + Value my home reproduced. Product lock / Matt keep-kill. Do not redesign hero.',
  },
  {
    fingerprint: 'ef6af6b44156e99f0f5ca42850819b19',
    status: 'fixed',
    note: 'publishRegionalSearchHref → ?view=list on homepage See homes / towns / map / featured / footer. Gate ci:publish-regional-search-href.',
  },
  {
    fingerprint: '23064b9da53e042252ebeda2261286e3',
    status: 'rejected',
    note: 'V3Chrome + Buy/Sell/Look reproduced. ArrivalIntent lock. Do not merge the two headers.',
  },
  {
    fingerprint: 'ceab7b4624596692749024bdda136458',
    status: 'rejected',
    note: 'Town-fill photos visible opacity 1 with real TOWN_IMG backgrounds at 390+1280.',
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
