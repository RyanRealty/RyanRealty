/**
 * Resolve the served fleet:public-ux:place-pages slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v13.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-028b80c5-2026-08-18t07-30'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = '9f207c4cc'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '7ffe6801eb43a8ab7c5cc62a85b0d988',
    status: 'rejected',
    note: `/subdivisions/brookswood-crossing 200 + H1 + No active listings + sales history at 390+1280. 404 did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'dfc34292228be02dbe5838c01e1a9117',
    status: 'rejected',
    note: `/subdivisions/brooktree 200 + H1 + listing cards + sales history at 390+1280. 404 did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '4f30e3b16052ee2a667a9f9b3f450053',
    status: 'rejected',
    note: `/schools/summit-high map slot 350×263 / 586×440 with 6/9 Google tiles after load. Showing 12 of N is the field cap, not an empty map. Prod ${SHA}.`,
  },
  {
    fingerprint: '53c301ceea1fd8845cf3bd6fd9dfbef4',
    status: 'rejected',
    note: `/oregon/portland is the out-of-area referral tier: 19 all-type / 12 SFR / $505,000 from geo_snapshot_mv for Portland. Medford and peers are the Other markets ledger. Portland is outside Central Oregon. Prod ${SHA}.`,
  },
  {
    fingerprint: '02a3e3f681e48a0d6ec88b6cebbaa31f',
    status: 'rejected',
    note: `/housing-market ALL-TYPE closes 5,707. Visible cards include Farm/ranch 11 + Other 5. Sum of 8 type cards = 5,707, delta 0. Prod ${SHA}.`,
  },
  {
    fingerprint: '7db87989cf270288b73b2950d3464fc0',
    status: 'rejected',
    note: `/housing-market mix chart renders 8 segments plus the ordered list of all 8 types. Figure pills already print every close count. Stacked-bar slivers are mix geometry, not a missing mix. Prod ${SHA}.`,
  },
  {
    fingerprint: 'd13107bc46d3879a7249a7638f5dea73',
    status: 'rejected',
    note: `/communities/tetherow claims 34 homes and prints See all 34 Tetherow homes for sale. Count vs featured-rail cards is the rail cap with a see-all control. Prod ${SHA}.`,
  },
  {
    fingerprint: '85d5a3fa03607cc61dfe981d2da84308',
    status: 'fixed',
    note: `/subdivisions featured 7 of 12 tiles as 0 ACTIVE. publishFeaturedPlats prefers the highest verified SFR plat per community and does not pad zeros. Gate ci:publish-featured-plat-inventory. Prod ${SHA}.`,
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
    .select('id,objective')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  const openRemaining = openPunchLines(String(data.objective ?? '')).length
  if (row.state === 'in_progress' && isLegalTransition('in_progress', 'open')) {
    const { error: relErr } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'open',
        owner_session: null,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ID)
      .eq('owner_session', OWNER)
    if (relErr) {
      console.error('release failed', relErr.message)
      process.exit(1)
    }
  }
  console.log(JSON.stringify({ ok: true, id: data.id, openRemaining, released: true }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
