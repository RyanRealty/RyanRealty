/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v8.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-1d730b67-2026-08-18t00-28'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'aa4c62d67'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '59a3b1d9b25abb26e4da0c8c521047d2',
    status: 'rejected',
    note: `Index 64 Active equals /cities/bend/awbrey-butte 64 homes. Same SoR getBendNeighborhoodPublicInventory. 52 vs 63 did not reproduce. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: '20608cb80395d36181ba0249d8153c02',
    status: 'rejected',
    note: `Index 12 Active $909,950 equals ridge-at-eagle-crest 12 homes / $909,950. 14 / $535k did not reproduce. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: 'f1c3af5d6779393ab1d093fba77d3791',
    status: 'rejected',
    note: `No closed_cte / service_area_v1 / ILIKE %Closed% on /housing-market. publicClosedSalesMethodology already holds. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: '869e578bf05ec02a89be62bb81403d1d',
    status: 'fixed',
    note: `/neighborhoods/{district} 308s in middleware via resolveNeighborhoodAliasRedirect to /cities/bend/{slug}. Page-level permanentRedirect was a soft 200 under Next 16 streaming. /neighborhoods/tetherow stays a non-district 404. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: 'ca552556c46f87dbefdbe4ae948f1b68',
    status: 'fixed',
    note: `publishPlatDisplayName withholds Oww / DrrhTrs / Drrh Trs / OWW2 / Bbr / StoneTH / Crr 1. River Meadows More areas no longer prints those codes. Does not invent expansions. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: 'f91d0a242ddd89a20fdb623d77189803',
    status: 'rejected',
    note: `No Regional median string on /communities/tetherow. publishSellMedian already shipped. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: 'd929b7038ec7f52e7bff7ada64232f9f',
    status: 'rejected',
    note: `No closed_cte on /housing-market/central-oregon. Same methodology class as f1c3af5d. 390+1280 after READY ${SHA}.`,
  },
  {
    fingerprint: '183a9397e0040acfaac560d593e8c5b3',
    status: 'rejected',
    note: `0 Closed · 30 days is honest slow-turnover. 23-day median-to-pending did not reproduce (medianToPending null). Pending hits are activity-feed, not a missing inventory count. 390+1280 after READY ${SHA}.`,
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
