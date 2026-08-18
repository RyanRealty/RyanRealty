/**
 * Resolve the served fleet:public-ux:listing-detail calendar-day slice, then
 * release FLEET-PUNCH if this session still holds it.
 *
 *   npx tsx scripts/loop-resolve-listing-calendar-day.ts
 *
 * Does NOT complete FLEET-PUNCH. Fingerprints are hex-only (formatPunchDisposition
 * adds the fleet: tag). A prior pass prefixed fleet: and wrote fleet:fleet: lines
 * that openPunchLines cannot match.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const OWNER = 'cursor-loop-chain-bc-4c1236cf-2026-08-18t09-14'
const SHA = 'de3733b74'
const DEPLOY = '4NCw2Hhc7tLrrD5cJ47oTTo2u8zi'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'ab1d0f99602513a09d570de1a55de11e',
    status: 'rejected',
    note: `654 Providence 220224933: Listing history + Listed Jul 8 at 390+1280. Prior publishListingHistory. READY ${SHA}.`,
  },
  {
    fingerprint: '773b54d7d585036f20849cae5e5aa2c4',
    status: 'rejected',
    note: `1019 Hale 220225331: OpenHouses null, no Open houses section at 390+1280. Aug 15 gone. READY ${SHA}.`,
  },
  {
    fingerprint: 'e100e9e1a244369ec0d5b7aee1ce11a6',
    status: 'fixed',
    note: `Kilimanjaro 220222798 stored 08/18-20 printed Mon Aug 17. YYYY-MM-DD UTC parse. publishCalendarDay. READY ${SHA} ${DEPLOY}; prod Tue Aug 18 / Wed 19 / Thu 20.`,
  },
  {
    fingerprint: 'd602a242f408bd469082c6febb2d46c3',
    status: 'rejected',
    note: `2736 Rainier 220227000: Listing history + Listed Aug 12 at 390+1280. Prior publishListingHistory. READY ${SHA}.`,
  },
  {
    fingerprint: 'fa401db3bd569a07bdb31e23ce5204d4',
    status: 'rejected',
    note: `2448 Violet 220223541: Spark hero + View all 46 at 390+1280. PhotoURL present, media_suppressed=false. READY ${SHA}.`,
  },
  {
    fingerprint: '9e6e4aabedf8e853ecf2134c65e23836',
    status: 'rejected',
    note: `61172 Hilmer Creek 220222626: Listing history + Listed Jun 3 + Price change Jul 7 $755k at 390+1280. READY ${SHA}.`,
  },
  {
    fingerprint: 'ca21968f637cfb825cb16eee6196bfb4',
    status: 'rejected',
    note: `58062 Verdin 220224992: OpenHouses null, no Open houses section at 390+1280. Aug 15 gone. READY ${SHA}.`,
  },
  {
    fingerprint: '0574202028e4d2db841a3c6e2c1b49aa',
    status: 'rejected',
    note: `3366 7th 220223472: OpenHouses null, no Open houses section at 390+1280. Aug 15 gone. READY ${SHA}.`,
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
