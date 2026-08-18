/**
 * Resolve the served fleet:public-ux:place-pages slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v12.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-b0114878-2026-08-18t07-10'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'c3b968afb'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '862e9441bc0874cc50440a1476c562be',
    status: 'rejected',
    note: `/subdivisions/bend-park 200 at 390+1280. H1 Bend Park, Homes for Sale (h1Top 527/381), 5 listing cards + sales history. No Aw Snap / Error 9. chromeOnly=false. Prod ${SHA}.`,
  },
  {
    fingerprint: '6decff32b865184bb42ea293a394aa1d',
    status: 'rejected',
    note: `/subdivisions/braydon-park 200 not 404. H1 + 2 listing cards + sales history at 390+1280. Tab Homes for Sale in Braydon Park. chromeOnly=false. Prod ${SHA}.`,
  },
  {
    fingerprint: 'db3b403cad3c5bd6adf2f207bef346a1',
    status: 'rejected',
    note: `/subdivisions/breckenridge 200 not 404. H1 + No active listings + sales history at 390+1280. chromeOnly=false. Prod ${SHA}.`,
  },
  {
    fingerprint: '773aa49d1df741dd9856a0b5cd8067b8',
    status: 'rejected',
    note: `/cities/redmond 200. H1 Redmond Homes for Sale, Showing 24 of 390 homes, median list $525,450. No Aw Snap. chromeOnly=false. Prod ${SHA}.`,
  },
  {
    fingerprint: '7ada36524a81c9df0f2fc6ca903627bd',
    status: 'rejected',
    note: `/subdivisions/bradetich-park 200 not 404. H1 + 2 listing cards + sales history at 390+1280. chromeOnly=false. Prod ${SHA}.`,
  },
  {
    fingerprint: '11e83aaa26f6b0afd7ed198d7967ea1c',
    status: 'rejected',
    note: `/central-oregon/golf/crosswater map slot .v3-field__map 586×440 at 1280 / 350×263 at 390; 24/19 Google tiles after load. Listing rail Showing 12 of 60. Same on Tetherow Golf Club. Empty beige first-paint is the pending frame + cream map style, not a missing map. Prod ${SHA}.`,
  },
  {
    fingerprint: '578aba643c947f1a874f7616cc7e23f3',
    status: 'rejected',
    note: `/central-oregon/golf/crosswater hero and FAQ share getGolfDetail stats.medianListPrice via medianListLabel. Live both $1,712,000 on 60 homes. Fleet $1,732,000 vs $1,745,000 is stale inventory, not two query shapes. Prod ${SHA}.`,
  },
  {
    fingerprint: 'd258a18bf4ee915c092f8c24bca1628e',
    status: 'rejected',
    note: `/subdivisions/brookswood-estates 200 not 404. H1 + No active listings + sales history at 390+1280. chromeOnly=false. Prod ${SHA}.`,
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
