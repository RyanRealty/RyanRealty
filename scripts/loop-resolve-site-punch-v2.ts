/**
 * Resolve the served fleet:public-ux:site punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-site-punch-v2.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'bc-b730bb2b-9d3b-4632-a9f0-ba05441b4b7a'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '719fdbf874b71a8f1eeb94422be4b33d',
    status: 'rejected',
    note: 'Six town doors have town-fill opacity 1 + real TOWN_IMG at 390+1280. Named Communities cards have media (Tetherow photo). Not text-only.',
  },
  {
    fingerprint: '7070dc67557c28814d8826b43f4a98cd',
    status: 'rejected',
    note: 'H1 is Central Oregon Homes for Sale, overflow visible, clippedRight false at 1280. After 220px scroll y=135, not under chrome. Stale clip.',
  },
  {
    fingerprint: '2ee1ea17d46e84c1e37b8fed4513e9c0',
    status: 'rejected',
    note: 'No Buy/Look quiz. First paint is V3Chrome only (R-218). Sell is the header destination, not ArrivalIntent. 390+1280.',
  },
  {
    fingerprint: 'b9ca9ee824cbdde8904762f52e9b05e9',
    status: 'rejected',
    note: 'Closed: one 57px sticky bar. Open menu: overlay 844/800 opaque cream; overlay-bar is the sheet chrome, not a second first-paint bar.',
  },
  {
    fingerprint: '1fb5e0417f109526f21282da52e00e92',
    status: 'rejected',
    note: 'Overlay bg rgb(250,248,244) opacity 1, full viewport. footerVisibleThrough false. Center hit is in overlay. Not translucent.',
  },
  {
    fingerprint: '74a5f8ddd7c70ed590df9d78a62571d2',
    status: 'rejected',
    note: 'Menu click opens overlay. Close hit isClose true; click closes (hidden). After close, menuHit isMenu true. Not a dead target.',
  },
  {
    fingerprint: '041614f2d0e8034304a23fd1d988c665',
    status: 'rejected',
    note: 'Search + See homes + Value my home still present. Product lock / homepage-v6 / prior reject. Do not redesign hero. 390+1280.',
  },
  {
    fingerprint: '1655726187cc3b156d303562d77c9137',
    status: 'rejected',
    note: 'ArrivalIntent unmounted (R-218). Single V3Chrome header. No Buy/Sell/Look bar. Same class as 2ee1ea17.',
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
