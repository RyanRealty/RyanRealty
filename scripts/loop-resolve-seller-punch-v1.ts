/**
 * Resolve the served fleet:public-ux:seller punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-seller-punch-v1.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-53dadb0e-2026-08-17t23-20'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '9e965a69bc38f7fa88b30d08b55bbe57',
    status: 'fixed',
    note: 'Step 2 required Your name (name=name required:true). Spec is email required, name optional. After READY 109af2b3b: sell-value-name has no required. 390+1280.',
  },
  {
    fingerprint: '5026b06ec4af92997e2cba879f4f3d8a',
    status: 'rejected',
    note: 'Address did not clear after Places select. 61855 Somerset and 200 NW Greenwood stuck, then advanced. 390+1280.',
  },
  {
    fingerprint: '8a52cd4a7fa70eb2c6c1430b38aa8537',
    status: 'fixed',
    note: '390 .pac-item sat over Value my home. AddressAutocomplete reserves pb-48 while open and removes its pac-container on unmount. 390+1280.',
  },
  {
    fingerprint: '8a845cbc9a4b77743f72d709233055c6',
    status: 'rejected',
    note: 'Step 2 stayed up while typing phone (503 / 541). Address still shown. No reset to Enter a location. 390+1280.',
  },
  {
    fingerprint: '61a282201f342eae94578a96a2e53949',
    status: 'rejected',
    note: 'Visible v3-figure__value is $755,000 once. $$755,000 is RSC $ escape in the flight payload, not a second format. 390+1280.',
  },
  {
    fingerprint: '9be98c0abe3ed6159515a0d28904e7a3',
    status: 'fixed',
    note: 'Same overlay class as 8a52cd4a. Suggestions no longer cover the submit. 390+1280.',
  },
  {
    fingerprint: '4f94f6fb22d02a9fe7e83c7f9d9a7376',
    status: 'fixed',
    note: 'Name field is optional, matching phone. Email stays required. 390+1280.',
  },
  {
    fingerprint: 'cdeaa5ee3e45d45b96951fdb69f65fab',
    status: 'fixed',
    note: 'Confirm uses publishSellValuationConfirm: within 24 hours, not a business-day hedge. 390+1280.',
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
