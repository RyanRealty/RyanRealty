/**
 * Resolve the served fleet:public-ux:listing-detail punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-listing-history-dump.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-8bf1d624-2026-08-18t13-29'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'af9e9308d'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '294ca39dabffb8cd034e2c28a1194d06',
    status: 'rejected',
    note: `20556 Empire: Data last updated August 18, 2026 (today). No future date. READY ${SHA}.`,
  },
  {
    fingerprint: '63f7d09ae26b228f85e9271b2b376468',
    status: 'rejected',
    note: `20556 Empire: Listing history + Listed present at 390+1280. H1 $455,000. READY ${SHA}.`,
  },
  {
    fingerprint: '8c96a616c99d54935bfcdcefe0d393fe',
    status: 'rejected',
    note: `Rockway: still photo $649K 3/2/1392. UNMUTE absent. video=0. READY ${SHA}.`,
  },
  {
    fingerprint: '69c5f14fb62d9ca35b914bb58d6a34ab',
    status: 'rejected',
    note: `Rockway: no Next-step alert overlay / NOT NOW at 390+1280. READY ${SHA}.`,
  },
  {
    fingerprint: '7e278bfeb28c9806649154eeb32c5567',
    status: 'fixed',
    note: `Swalley: withhold ListPrice: 14900000.00 dump. Delta $3.0M down. Gate ci:publish-listing-history. READY ${SHA}.`,
  },
  {
    fingerprint: '672670d4916a91a3ec7a61b1ddcfe634',
    status: 'rejected',
    note: `438 9th: Listing courtesy of Premiere Property Group, LLC. READY ${SHA}.`,
  },
  {
    fingerprint: '59ea4599775b097b2aa0fa0d67e36495',
    status: 'rejected',
    note: `Roosevelt: Listing courtesy of Stellar Realty Northwest. READY ${SHA}.`,
  },
  {
    fingerprint: 'e735c1532b401ae32af2837ac69ff899',
    status: 'rejected',
    note: `438 9th: Lot size 0.64 acres in specs. Hero withholds acres when beds exist. READY ${SHA}.`,
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
