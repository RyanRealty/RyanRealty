/**
 * Resolve the served fleet:public-ux:blog punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-blog-related-homes.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import {
  appendPunchDispositions,
  openPunchLines,
  type PunchDisposition,
} from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition, type WorkNodeState } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const PARENT = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: 'd35fe53ce986b36ea9cb017860c94ad7',
    status: 'rejected',
    note: 'Already shipped. firstChar.left equals H1 at 390 (20) and 1280 (84) on eagle-crest. Gutter class is done.',
  },
  {
    fingerprint: '97d9b5e145ae2d200cb47178372c49ad',
    status: 'rejected',
    note: 'Could not reproduce. After full scroll URL and title stay /blog/eagle-crest-affordable-resort-redmond.',
  },
  {
    fingerprint: 'ca73cc646c27bc5269bb6beb6be9baea',
    status: 'rejected',
    note: 'Could not reproduce. Scroll does not open a second tab. Probe popupCount was about:blank from context.newPage.',
  },
  {
    fingerprint: 'cbe644fe86a8a2a609b0d2917a4d15dd',
    status: 'fixed',
    note: 'Related homes now render from live Active SFR inventory via matchBlogPlace + getCityListings. Local 390+1280: 6 /homes-for-sale tiles.',
  },
  {
    fingerprint: '154056f672766e8786ab617fec90d627',
    status: 'fixed',
    note: 'Drive times rewrite to 18-22 min Redmond-Bend and 5-10 min airport. Median gap is live pulse, not the mid-2025 table.',
  },
  {
    fingerprint: '5594c4d572f55d2ec254dfbb2608c25a',
    status: 'rejected',
    note: 'Seller checklist is not a buyable-place post. Related homes withheld by matchBlogPlace null.',
  },
  {
    fingerprint: '159f6c61a3c3b307e8e07fd32952a7b1',
    status: 'fixed',
    note: 'HB 2001 is a Bend-place post. Related homes now 6 live Active SFR tiles via getCityListings(bend).',
  },
  {
    fingerprint: '1fc3ee7fd296eb89b6ba467d2730945b',
    status: 'rejected',
    note: 'Already shipped. first body char left equals H1 at 390 and 1280 on arts-culture.',
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
    .select('id,state,owner_session,objective,title,version_gap')
    .eq('id', PARENT)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }

  const objective = appendPunchDispositions(String(row.objective ?? ''), RESOLUTIONS)
  const { data: updated, error: updateErr } = await sb
    .from('loop_work_nodes')
    .update({ objective, updated_at: new Date().toISOString() })
    .eq('id', PARENT)
    .select('id,objective,state,owner_session')
    .single()
  if (updateErr || !updated?.id) {
    console.error('resolve failed', updateErr?.message ?? 'no row')
    process.exit(1)
  }

  const openRemaining = openPunchLines(String(updated.objective ?? '')).length
  const from = updated.state as WorkNodeState
  if (from !== 'open') {
    if (!isLegalTransition(from, 'open')) {
      console.error(JSON.stringify({ ok: false, step: 'release', error: `illegal ${from} -> open`, openRemaining }))
      process.exit(1)
    }
    const { data: released, error: relErr } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'open',
        owner_session: null,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', PARENT)
      .eq('state', from)
      .select('id,state,owner_session')
      .single()
    if (relErr || !released?.id) {
      console.error('release failed', relErr?.message ?? 'no row')
      process.exit(1)
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          openRemaining,
          released: true,
          state: released.state,
          owner: released.owner_session,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        openRemaining,
        released: false,
        alreadyOpen: true,
        state: updated.state,
        owner: updated.owner_session,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
