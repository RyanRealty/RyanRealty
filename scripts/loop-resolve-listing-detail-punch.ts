/**
 * Resolve the served fleet:public-ux:listing-detail punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-listing-detail-punch.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-17t05-41-9db6'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'b11ab70e13b9265226b29434cf712a6f',
    status: 'rejected',
    note: 'Bryant Albany 390+1280: H1 + strip $1,073,000. MLS ListPrice 1073000, type D. Tax $1,233 is extra, not the only figure. Stale.',
  },
  {
    fingerprint: '1d85e5006ea519d4caac5da4e96056d5',
    status: 'fixed',
    note: '725 Broadway $0 was Spark type-G ListPrice 2.4. publishListingAsk withholds ask < $1000. Card prints Price on request / em dash, not $0.',
  },
  {
    fingerprint: '5bd258939f7362b9707335e456ee6582',
    status: 'fixed',
    note: 'Old Farm $0 cards were lease crumbs 1.2 / 1.08. Same MIN_PUBLIC_SALE_ASK withhold. Gate ci:publish-listing-ask.',
  },
  {
    fingerprint: 'f169f0418652a589589b62f66da95a81',
    status: 'fixed',
    note: 'Agness 23/22/1000 withheld by publishListingRooms. Living area stays. Hero/Facts/JSON-LD/alerts share that set. Gate ci:publish-listing-rooms.',
  },
  {
    fingerprint: '4f21b7b8d2af4f756f7a5f6165ebbd8c',
    status: 'rejected',
    note: 'Empire HOA already shipped. Facts + True cost HOA $135. FINANCIAL no $0. Prior publishListingHoa class.',
  },
  {
    fingerprint: 'c5679c0f72d8b7aba6981d157b37a405',
    status: 'rejected',
    note: 'Empire HOA $135 vs FINANCIAL $0 does not reproduce after publishListingHoa. Both $135.',
  },
  {
    fingerprint: '22f88adc01ed31de6325ff802276e6ed',
    status: 'rejected',
    note: 'Empire wheel-down stayed on the listing. pageCount 1. No /neighborhoods navigation.',
  },
  {
    fingerprint: '15f928e00adcc0b42ca16b74abab8679',
    status: 'rejected',
    note: 'Foley Facts + True cost HOA $22. FINANCIAL no $0. Prior publishListingHoa class.',
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
