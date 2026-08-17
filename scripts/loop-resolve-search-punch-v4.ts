/**
 * Resolve the served fleet:public-ux:search punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-search-punch-v4.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-e33bc1b4-2026-08-17t21-46'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'c34b8b5c6225a1e90d281b9042eef36a',
    status: 'rejected',
    note: '390 List/Map at y=255 (83x28 / 82x28). Chips y=198. No overlay. Click Map → pressed=on, 10 tiles. 390+1280.',
  },
  {
    fingerprint: '7655e29d742d5e7be97ceb9db7e5e19c',
    status: 'rejected',
    note: 'SEO grid page1 and page2 are 9/9 disjoint. Toolbar 10-18 of 1,280. Greedy MLS regex false-overlapped. 390+1280.',
  },
  {
    fingerprint: 'f9cac8817cd71fedaed4e321b92fd9d3',
    status: 'rejected',
    note: '1280 H1 y=57 flush under header 57. bandAboveH1=0. No 75px white band. 390+1280.',
  },
  {
    fingerprint: '485b09315eef20c0a4e0e0ce6fd40b8b',
    status: 'rejected',
    note: 'All-filters sheet 390x844, widerThanViewport false, clippedInputs []. Owner financing unclipped. 390+1280.',
  },
  {
    fingerprint: 'b72f05aeccb4a9084a249e82664e8e36',
    status: 'rejected',
    note: 'First paint tiles 0 (Maps hydrate). After 2.8s without click: gm-style imgs + canvas. Interaction not required. 390+1280.',
  },
  {
    fingerprint: 'a65af0277c3a315653277eb189bdacbe',
    status: 'rejected',
    note: '390 chips For sale/Beds/Baths/All filters 79-97x44, not one button. Save is the alert (R-152). 1280 Get listing alerts 121x28. 390+1280.',
  },
  {
    fingerprint: 'c7bbcb3522a24bfd3f6e8626c3e740bf',
    status: 'rejected',
    note: 'First card 63290 Ski $864,000 photo hero. videoCount 0, unmute []. View all 27. 390+1280.',
  },
  {
    fingerprint: '5a5e39fc479c42198a329964234b08bc',
    status: 'rejected',
    note: 'beds=4 sheet Show 365 homes; applied 365 homes. 374 vs 281+ was filter-match vs map-viewport (already labeled). 390+1280.',
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
