/**
 * Resolve the served fleet:public-ux:sitemap.xml punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-sitemap-punch.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-f4e9d63b-2026-08-18t15-03'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'fe303e01b3c306991850ccddd8298b6e',
    status: 'rejected',
    note: 'sitemap.xml 200 twice, sitemapindex, x-matched-path /sitemaps/index.xml. Children 200. No 500 at 390+1280.',
  },
  {
    fingerprint: 'af2543a434cf52d68801d9e948bbaf7f',
    status: 'rejected',
    note: 'Same class as fe303e01. Index 200. core/geo/listings/matrix/content all 200. Do not invent a 500 fix.',
  },
  {
    fingerprint: '76d8247a2d0efce402db514ecbe22769',
    status: 'rejected',
    note: 'Same class as fe303e01. Children opened: listings 7597 locs, geo 1542, core 155. No 500.',
  },
  {
    fingerprint: 'cbf99bdeee95ba5a59bfe0f8ad9a7a87',
    status: 'rejected',
    note: 'Index 200 as observed. listings.xml 200 urlset 7597 homes-for-sale locs. /sit is 403 truncated path, not a child.',
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
