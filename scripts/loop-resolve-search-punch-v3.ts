/**
 * Resolve the served fleet:public-ux:search punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-search-punch-v3.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-1dc8ed53-2026-08-17t21-15'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '0baaeadec3dc0cbf5d16e6b72625cf01',
    status: 'rejected',
    note: 'Acreage Aw Snap false. HTTP 200, heading Homes on Acreage (1+ Acres) in Old Farm District, 1-1 of 1. No page.crash. Bot OOM. 390+1280.',
  },
  {
    fingerprint: '009a30599d628b93f6f094b1cbe63595',
    status: 'fixed',
    note: 'Chip was hardcoded For Sale on pending presets. publishSearchStatusChip + publishListingStatusBadge. After READY f7383a332: Under contract only chip, first card Pending $1,199,000 2999 Three Sisters, 9 Pending badges. 390+1280.',
  },
  {
    fingerprint: 'ba0123987f4150e3e282f820cb8ab7f2',
    status: 'rejected',
    note: 'First card href /homes-for-sale/bend/61445-27th-220227185. Click landed on that listing, not /subdivisions. 390+1280.',
  },
  {
    fingerprint: '07fca1e97f3c5517827d5f673eaace8e',
    status: 'rejected',
    note: 'Save this search is the alert (R-152). Dialog is Email alerts for this search. Get listing alerts at 1280 121x28. 390+1280.',
  },
  {
    fingerprint: 'cb235d844c0432d1800b058cd1615344',
    status: 'rejected',
    note: '1280 count/sort visible: 1,279 homes / 794+ in this map view and Sort Newest. Not clipped by header. 390+1280.',
  },
  {
    fingerprint: 'e2c22a3667ac549a14077db44e70427a',
    status: 'rejected',
    note: 'Get listing alerts visible at 1280 (121x28). Save this search is the alert (R-152). 390+1280.',
  },
  {
    fingerprint: 'c92e3dec986a6bf7a580059a6a5eae65',
    status: 'rejected',
    note: '390 List/Map at y=255 (83x28 / 82x28). Chips sit above. Not overlaying, tappable. 390+1280.',
  },
  {
    fingerprint: 'fed8d9bd4b7e0471a1d394abb8bfe489',
    status: 'rejected',
    note: 'Save dialog is Email alerts for this search, you@email.com, no account needed. Name-only dialog does not reproduce. Did not submit a real email. 390+1280.',
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
