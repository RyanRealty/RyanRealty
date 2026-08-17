/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v6.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-99eda833-2026-08-17t09-40'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '35357a0829eaf99ee7230b36890c3a6f',
    status: 'rejected',
    note: 'Big Sky hero silent. No $756k / 18 days. publishPlatFigures withholds parent pulse. 390+1280.',
  },
  {
    fingerprint: '133b4d23ae683ac15b9c61ab25f73ffe',
    status: 'rejected',
    note: 'Calaveras hero silent. No leaked $756k / 18 days pair. 390+1280.',
  },
  {
    fingerprint: 'c6f045e8c5e8fcc559f2e5691c3bf6a3',
    status: 'rejected',
    note: 'Wheel scroll at 390+1280 stays on /housing-market. No hub router.push.',
  },
  {
    fingerprint: '8dec3959fee45873a0ed742db4564305f8841b38f077ce3f04ccf91bb901dc16',
    status: 'rejected',
    note: 'Larkspur Grotto prints exact $1,238,136. 0 of $1,238,000. 390+1280.',
  },
  {
    fingerprint: 'a7a6038f1d78857572e7e2199cf399bf',
    status: 'fixed',
    note: 'Homepage Tetherow 12 vs /communities/tetherow 35. Alias-aware overlay on index + homepage. After READY both 35 / $1,499,000.',
  },
  {
    fingerprint: 'bfcad1b5eb5efd9a4e7e7941bcd996b6',
    status: 'rejected',
    note: '19 / $2.25M does not reproduce on /communities. A-Z showed Tetherow 12 (same 12-vs-35 class; fixed).',
  },
  {
    fingerprint: '0d7c0760e7acb301d7eebd19dabf92d5',
    status: 'rejected',
    note: '/neighborhoods/tetherow is 404. Tetherow is a resort at /communities/tetherow. 390+1280.',
  },
  {
    fingerprint: '44b5c2688b202267e285e7e3cd3eee38',
    status: 'fixed',
    note: 'Home 12 / communities A-Z 12 / page 35. 19 does not reproduce. Same alias-aware overlay class as a7a6038f.',
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
