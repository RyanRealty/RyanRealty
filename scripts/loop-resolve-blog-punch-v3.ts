/**
 * Resolve the served fleet:public-ux:blog punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-blog-punch-v3.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-791e34a1-2026-08-17t12-16'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'f865ead5d3569de3da1b49d9d5fff190',
    status: 'fixed',
    note: '5.4 was middle (Prineville) and buyer (Madras). rewriteBlogMosVerdicts uses marketVerdict. After READY b4f03efdc: Sunriver 12.0 + La Pine 11.4 buyer; Madras 5.4 balanced. 390+1280.',
  },
  {
    fingerprint: 'baf11029f9f9b7c9481c4a1817468135',
    status: 'rejected',
    note: 'Active listings at June 30: 474 vs 512 as of July 9. Dated grains, not a same-label pair. 390+1280.',
  },
  {
    fingerprint: 'b75fc748ac2130f76a109a6f045121a9',
    status: 'fixed',
    note: 'Vacation Rental on page 2 and 3. published_at+id order + global ItemList positions. After READY: p2 13-24 Vacation Rental; p3 25-36 NW Crossing. Overlap empty. 390+1280.',
  },
  {
    fingerprint: '2e9c6c2c641dac869db4958956ff6782',
    status: 'rejected',
    note: 'Index excerpt as of July 2026 matches title vintage. Body current list is labeled as of Aug 17. Not a same-label pair. 390+1280.',
  },
  {
    fingerprint: '42587e569222e5e0205bc1fae7c1d552',
    status: 'rejected',
    note: 'Day headings are ranges: 1-5, 6-12, 13-18, 19-24, 25-28, 29-30. Days 6-24 present. 390+1280.',
  },
  {
    fingerprint: 'e204b68a5cf67f9c1c371ec26b3acff0',
    status: 'rejected',
    note: 'Moving to Redmond has #related-homes + See Redmond homes + Keep reading / More in Relocation Guides. §7 place CTA. 390+1280.',
  },
  {
    fingerprint: 'fbf4844d88bd940d809b1c2774c33d65',
    status: 'rejected',
    note: 'Buyer article has Talk to a broker /contact. Value my home is the global seller door. Prior contextual-CTA class. 390+1280.',
  },
  {
    fingerprint: '36e5ed340bb5c1f7d6914ea7b0d1d7b6',
    status: 'rejected',
    note: 'how-to-sell-your-home-bend at 390+1280: scrollWidth=clientWidth, overflowing=[]. v3-article-island gutter already holds. 390+1280.',
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
