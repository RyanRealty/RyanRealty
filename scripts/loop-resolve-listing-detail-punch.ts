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

const OWNER = 'bc-42b57373-e2ac-41eb-8e01-b44e28a1677d'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '1400f2fa89d1a2082646e324d4b8d8ba',
    status: 'fixed',
    note: 'publishListingContactKey prefers ListNumber. Contact page resolves listingKeys + listNumbers. Hilmer MLS 220222626 loads the tile.',
  },
  {
    fingerprint: '1c49031c7eea8492a01ac8eedc219140',
    status: 'fixed',
    note: '7th Street: Facts + True cost share publishListingHoa $45. H1/drop/JSON-LD share publishListingAsk $424,990.',
  },
  {
    fingerprint: '3ccb220656d54ed0d3cf6a81229e0e3d',
    status: 'fixed',
    note: 'Horse Back Facts + True cost share publishListingHoa $70. Gate ci:publish-listing-hoa.',
  },
  {
    fingerprint: '5256872fd4a775785f71bfe1d609cdb1',
    status: 'fixed',
    note: 'Kokanee HOA $42 via publishListingHoa. Baths 3 vs 2.5 rejected: hero BathroomsTotal, remarks are MLS prose.',
  },
  {
    fingerprint: '5c0dab89dd5d797b64c246eb068cc562',
    status: 'fixed',
    note: 'Hudspeth: HOA $160 exact. Ask/drop $629,500 / $15,500 from $645,000. Gate ci:publish-listing-ask.',
  },
  {
    fingerprint: '494f1c5baa31a864708eccc537f3e67f',
    status: 'fixed',
    note: 'Canyons Facts + True cost share publishListingHoa $1,529. No thousand-round $2,000.',
  },
  {
    fingerprint: '0ecadb61b89ea68364114df872400c76',
    status: 'fixed',
    note: 'Foley Facts + True cost share publishListingHoa $22. No $0 nearest-thousand.',
  },
  {
    fingerprint: '61640c337085bbc293276ecde2c01ab4',
    status: 'rejected',
    note: 'Bryant Albany 200 at 390+1280. Title and H1 $1,073,000. No crash. Stale.',
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
