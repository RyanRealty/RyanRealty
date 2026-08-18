/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v9.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-a712da53-2026-08-18t01-40'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '98dca9d79c9ba3f6bfc91a4de391de46',
    status: 'rejected',
    note: 'Aero Acres 390+1280 has H1 Aero Acres, Homes for Sale + empty-state No active listings. Not chrome-only.',
  },
  {
    fingerprint: '71c4fdb28b7ab628d2d65828c7e8eeea',
    status: 'rejected',
    note: 'Anderson Acres 390+1280 has H1 + No active listings empty-state. Not chrome-only.',
  },
  {
    fingerprint: '0d42028c4275997beec47008a101ec8c',
    status: 'rejected',
    note: 'Crooked River Ranch listing door See Crooked River Ranch homes → #homes and /homes-for-sale/terrebonne/crooked-river-ranch. 9 listing hrefs. ArrivalIntent overlay is residual, not a missing door.',
  },
  {
    fingerprint: '0954c74045562ffb6c799fd56a4ef001',
    status: 'rejected',
    note: '1880 Ranch 390+1280 has H1 + /homes-for-sale/bend/1880-ranch listing door. Not chrome-only.',
  },
  {
    fingerprint: 'd0e6af6fcddafb9756a943d30263ee5b',
    status: 'rejected',
    note: '27th Park 390+1280 has H1 + No active listings empty-state. Not chrome-only.',
  },
  {
    fingerprint: '86856b8604eb1aaff88ae4e59aa28203',
    status: 'rejected',
    note: '27th Street Addition 390+1280 has H1 + /homes-for-sale/bend/27th-street-addition door. Not chrome-only.',
  },
  {
    fingerprint: 'a088e433724bc00f747b5587805ae666',
    status: 'rejected',
    note: '27th Street Crossing 390+1280 has H1 + No active listings empty-state. Not chrome-only.',
  },
  {
    fingerprint: 'de4dd2b5ca4bb91969691703ac2d5501',
    status: 'rejected',
    note: 'Brentwood 390+1280 has H1 + No active listings empty-state. Not chrome-only.',
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
