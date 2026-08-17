/**
 * Resolve the served fleet:public-ux:blog punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-blog-punch-v2.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-bc-b9425f1f-2026-08-17t11-40'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '300d209840574d3b21bc8a191c775a8b',
    status: 'rejected',
    note: 'June 2026 title + Jun 9 byline report May closings ($797,000 / 120). Report month vs close month. July report already in related posts. 390+1280.',
  },
  {
    fingerprint: '30f73dd8f7c0e4eb366483ce9cf7ef4f',
    status: 'fixed',
    note: 'NW Crossing slug/tags matched city Bend. Alias match now publishes NorthWest Crossing homes. After READY f29d930 See NorthWest Crossing homes / $1,549,500.',
  },
  {
    fingerprint: '20abbd827e014c0f7be1a6627d9e7204',
    status: 'rejected',
    note: 'Attached floor $475,000 vs conclusion less ideal under $500,000. Different grains. SFR starts $600,000. 390+1280.',
  },
  {
    fingerprint: '4ff52bfb392b669932f23cf6ecb88d24',
    status: 'rejected',
    note: 'Schools scroll at 390+1280: ids unchanged, no skip-to-footer, no duplicate tab. 390+1280.',
  },
  {
    fingerprint: '9f2e7a08523da3dbbac114cb84f7162e',
    status: 'rejected',
    note: 'Eagle Crest already has #related-homes + See Eagle Crest homes. Prior related-homes class. 390+1280.',
  },
  {
    fingerprint: '6b10337139f4b8b4fa9da8306582798f',
    status: 'rejected',
    note: 'Buyers post has Bend homes + MORE RESOURCES (See Bend homes, tags, All posts). Not blank. 390+1280.',
  },
  {
    fingerprint: 'ca5ea1e0ef61f92fe4f5decf30bbedfc',
    status: 'rejected',
    note: 'H1 tilting toward buyers; body says 3.6 months is seller/balanced, not a full buyer market. No same-label pair. 390+1280.',
  },
  {
    fingerprint: 'd53d181132fe3198ba82927f1faa7b9b',
    status: 'rejected',
    note: 'Dining lifestyle withholds related-homes. Talk to a broker is the contextual CTA. Value my home is the global seller door. 390+1280.',
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
