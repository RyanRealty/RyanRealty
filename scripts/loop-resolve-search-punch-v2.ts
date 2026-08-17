/**
 * Resolve the served fleet:public-ux:search punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-search-punch-v2.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-16d00c5f-2026-08-17t20-40'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'f56f6ca6e1670749121584a2ddce13e2',
    status: 'rejected',
    note: 'Chips 0x0 false. For sale/Beds/Baths 79x44+ at 390. Price probe matched Price drops. Sort clip is the 777dc8 line. After READY d12437028 chips still tappable. 390+1280.',
  },
  {
    fingerprint: 'e4e32c355ee31575f3bcddfec5a09e90',
    status: 'fixed',
    note: 'Homes nav was bare /homes-for-sale (Bend inject). Now REGIONAL_SEARCH_HREF ?view=list. After READY d12437028: Homes href + click land on /homes-for-sale?view=list, 3,380 homes found, no Showing Bend only. 390+1280.',
  },
  {
    fingerprint: '5eccc53ef323bf5214d36f77c0ab4640',
    status: 'rejected',
    note: 'Clean visit /join watching false. Did not submit a real email. Residual cookie only after Save. 390+1280.',
  },
  {
    fingerprint: '96adcb52687eabbb17ed27267330a93a',
    status: 'rejected',
    note: 'All filters opens 390x844 sheet. Owner financing unclipped. Save this search is the alert (R-152). 390+1280.',
  },
  {
    fingerprint: 'df780b3b998932eac7e6a29160caa47c',
    status: 'rejected',
    note: 'Sheet 390 wide, scrollWidth===clientWidth, Owner financing unclipped. No left-offset overflow. 390+1280.',
  },
  {
    fingerprint: '5ef441036680f2d1d4a2cdef5782e86d',
    status: 'rejected',
    note: 'Save this search visible (R-152). Get listing alerts at 1280 (121x28). 390+1280.',
  },
  {
    fingerprint: 'c8f0c9b44293ff5d097508b1cee6e7e4',
    status: 'rejected',
    note: 'All filters tap opens the sheet at 390. After READY still open:true 390x844. 390+1280.',
  },
  {
    fingerprint: '777dc8d611dd1f838044793980cb6176',
    status: 'fixed',
    note: '390 sort sat on the chip row (globals 64px frame offset + sticky dock). Frame height 100dvh-3.5rem, dock in flow. After READY d12437028: chips y=198, sort Newest y=255, 1,279 homes visible, not under header. 390+1280.',
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
