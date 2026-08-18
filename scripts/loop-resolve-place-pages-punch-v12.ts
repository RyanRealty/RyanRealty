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

const OWNER = 'cursor-loop-chain-bc-d14c774b-2026-08-18t06-04'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'c3b968afb'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '14861a063d46a650327c0388a5f36bb5',
    status: 'fixed',
    note: `/central-oregon/events/sunriver-music-festival printed "Tower Theatre, Bend in Sunriver". publishPlaceInCity withholds the page city when the venue already names one. Prod ${SHA}.`,
  },
  {
    fingerprint: 'd1615532514589444b8b0c3bfd181149',
    status: 'rejected',
    note: `/central-oregon/venues/tower-theatre map slot sized 586×440 / 350×263 with 24/21 Google tiles after load. Empty gray first-paint is the pending frame, not a missing map. Prod ${SHA}.`,
  },
  {
    fingerprint: '1da3f7833afbafd9f1ae7dfa0d0c09f6',
    status: 'rejected',
    note: `/subdivisions/barclay-meadows 200 + H1 + No active listings + sales history at 390+1280. Aw Snap did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '3545811a84a2445587694783602cebc1',
    status: 'fixed',
    note: `/cities/bend/awbrey-butte cards printed 0 Moonshadow Court for MLS 220221237 / 220221242 / 220221243. publishStreetLine withholds placeholder StreetNumber 0 and keeps Moonshadow Court. Do not invent a house number. Prod ${SHA}.`,
  },
  {
    fingerprint: '1ea36728a43a3e6f0db61ae78c3e49a4',
    status: 'rejected',
    note: `/central-oregon/trails/pilot-butte map slot 586×440 / 350×263 with 28/20 Google tiles after load. Empty-map first-paint is the pending frame. Prod ${SHA}.`,
  },
  {
    fingerprint: '9bc72fd3b5f25514a9b5f9476b5b970e',
    status: 'rejected',
    note: `/subdivisions/brentwood 200 + H1 + No active listings + sales history at 390+1280. 404 did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: '0cf2ba5712758f1bae5e71ade899556e',
    status: 'rejected',
    note: `/subdivisions/brier-ridge 200 + H1 + listing cards + sales history at 390+1280. 404 did not reproduce. Prod ${SHA}.`,
  },
  {
    fingerprint: 'a779ba29cc70dd547cff7a503a683255',
    status: 'rejected',
    note: `/central-oregon/trails/tumalo-falls map slot 586×440 / 350×263 with 13/10 Google tiles after load. Empty-map first-paint is the pending frame. Prod ${SHA}.`,
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
