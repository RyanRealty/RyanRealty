/**
 * Resolve the served fleet:public-ux:place-pages slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v11.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-17952d67-2026-08-18t05-50'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = '0f57f5e7c'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '7b860ce3c9a97e5f8209697b6d665783',
    status: 'rejected',
    note: `/subdivisions/aubrey-heights H1 + 2 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '12ee8ecd42436465de55c5027d8a27f8',
    status: 'rejected',
    note: `/subdivisions/chase-village H1 + No active listings + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'be798c87690e6539ba4227baea822577',
    status: 'rejected',
    note: `/subdivisions/chloe-estates H1 + empty-state + sales history at 390+1280. GIS plat exists (boundaries 3,213). Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '1e6a2554a1757d6610d522a81d911c60',
    status: 'rejected',
    note: `/subdivisions/brookswood-estates H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '67bdf823fe83550a2f43fd75d005097d',
    status: 'rejected',
    note: `/subdivisions/brentwood H1 + empty-state + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '9c4a60a724cda71a85920aa73d82ec87',
    status: 'rejected',
    note: `/housing-market Terrebonne row is 6 for sale / $685,000 with no days-to-pending. Pulse city terrebonne methodology v3-2026-05-07 median_days_to_pending=null (Metolius also null). SITE_PAGE_STANDARD omits unverified days. Do not invent. Prod ${SHA}.`,
  },
  {
    fingerprint: '7d4313de7db6f8c77b9c1ee6fc88c4fe',
    status: 'rejected',
    note: `/subdivisions/blue-chip-ranch H1 + 4 listing cards + sales history at 390+1280. Chrome-only did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '94affa2928c11fb8e6b66b20c531aa16',
    status: 'rejected',
    note: `/central-oregon/events/bend-farmers-market map slot v3-field__map 586×440 at 1280 / 350×263 at 390; 36/33 Google tiles after load. Empty gray first-paint is the pending frame, not a missing map. Prod ${SHA}.`,
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
