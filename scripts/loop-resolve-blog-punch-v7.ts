/**
 * Resolve the served fleet:public-ux:blog punch slice (period-title class), then release the parent.
 *
 *   npx tsx scripts/loop-resolve-blog-punch-v7.ts
 *
 * Does NOT complete FLEET-PUNCH. Append-only: already-dispositioned fingerprints are skipped.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-3f90972f-2026-08-17t11-41'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '300d209840574d3b21bc8a191c775a8b',
    status: 'fixed',
    note: 'publishBlogReportPeriod: H1/meta/JSON-LD use the body data month (May 2026), not the issue month. Period note: May 2026 closings. Published June 2026. READY 84b7d991c / aDAAikduwH3hfRgnmkSedYd3aSUY.',
  },
  {
    fingerprint: '30f73dd8f7c0e4eb366483ce9cf7ef4f',
    status: 'fixed',
    note: 'Sibling f29d930dd maps NW Crossing short names to NorthWest Crossing. Prod heading: NorthWest Crossing homes. CTA /communities/northwest-crossing.',
  },
  {
    fingerprint: '20abbd827e014c0f7be1a6627d9e7204',
    status: 'rejected',
    note: 'CMS copy uses two price bands ($475k typical, under $500k). Not a same-label pair. No rewrite. 390+1280.',
  },
  {
    fingerprint: '4ff52bfb392b669932f23cf6ecb88d24',
    status: 'rejected',
    note: 'Schools scroll: headingsUnchanged=true, skippedToFooterOnFirstScroll=false, midY=1013, bottomY=12732. 390+1280.',
  },
  {
    fingerprint: '9f2e7a08523da3dbbac114cb84f7162e',
    status: 'rejected',
    note: 'Eagle Crest homes already present (prior related-homes class). 390+1280.',
  },
  {
    fingerprint: '6b10337139f4b8b4fa9da8306582798f',
    status: 'rejected',
    note: 'Bend homes + explore-more already populated. Not a blank MORE RESOURCES. 390+1280.',
  },
  {
    fingerprint: 'ca5ea1e0ef61f92fe4f5decf30bbedfc',
    status: 'rejected',
    note: 'Method note already qualifies 3.6 months as seller-side (≤4). Tilting toward buyers is direction, not a buyer-market verdict. 390+1280.',
  },
  {
    fingerprint: 'd53d181132fe3198ba82927f1faa7b9b',
    status: 'rejected',
    note: 'Lifestyle withhold (related-homes) + Value my home is global chrome (decisions.md). Not a dining-page defect. 390+1280.',
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
    .select('id,state,title,objective,owner_session,updated_at')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }
  const beforeOpen = openPunchLines(String(row.objective ?? '')).length
  const objective = appendPunchDispositions(String(row.objective ?? ''), RESOLUTIONS)
  const appended = objective !== String(row.objective ?? '')
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({ objective, updated_at: new Date().toISOString() })
    .eq('id', ID)
    .select('id,objective,state,owner_session,updated_at')
    .single()
  if (error || !data?.id) {
    console.error('resolve failed', error?.message ?? 'no row')
    process.exit(1)
  }
  const openRemaining = openPunchLines(String(data.objective ?? '')).length
  console.log(
    JSON.stringify(
      {
        resolved: true,
        appended,
        beforeOpen,
        openRemaining,
        priorOwner: row.owner_session,
        priorState: row.state,
        priorUpdated: row.updated_at,
        id: data.id,
      },
      null,
      2,
    ),
  )

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
