/**
 * Resolve the served fleet:public-ux:search punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-search-punch-v1.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-decba6c7-2026-08-17t13-06'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'ebee46dd6aeea160a998891d3fbf96c5',
    status: 'fixed',
    note: 'Card $2,000,000 vs H1 $1,999,900. ListingCard/VideoListingCard use formatPublishedAsk. After READY 19ef79d81: search card $1,999,900, 0 of $2,000,000. 390+1280.',
  },
  {
    fingerprint: '43c9a0a90b083c1a2f9f815fbd15aa46',
    status: 'rejected',
    note: 'Save this search is the alert (R-152). Get listing alerts is on the page at 1280 (121x28). 390+1280.',
  },
  {
    fingerprint: 'a5cedb212d4b1a3436d93c9387f06b12',
    status: 'fixed',
    note: 'Sheet was w-3/4 so Owner finan clipped. Full-width + wrap. After READY: sheet 390 wide, Owner financing unclipped. 390+1280.',
  },
  {
    fingerprint: 'e64a9cf3ebc7229667edf220af840fe2',
    status: 'rejected',
    note: 'Price/status history is listing-detail, not search cards. Search URL has no history section. 390+1280.',
  },
  {
    fingerprint: '93306f99249de42e711c713336fcb3dd',
    status: 'rejected',
    note: 'Sold 200, no Search took too long. Empty map viewport No homes. Header Homes for Sale. 390+1280.',
  },
  {
    fingerprint: '9f1ff24d92f9b00a908ef68257593c66',
    status: 'rejected',
    note: 'Beds/Baths/Price/For sale/Home type measure 79x44+ at 390, tappable. Row-3 chips are hidden sm:flex on purpose. 390+1280.',
  },
  {
    fingerprint: 'a6b65686f6a0691a5c104badc508d3fb',
    status: 'rejected',
    note: 'Duplicate of Save/Alerts. Save this search + Get listing alerts at 1280. 390+1280.',
  },
  {
    fingerprint: 'd7b6d60cb10a0b6d9e1a56d93990494a',
    status: 'rejected',
    note: 'Dismiss without Apply is cancel. Apply filters commits. URL unchanged is intended. 390+1280.',
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
