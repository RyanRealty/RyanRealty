/**
 * Resolve the served fleet:public-ux:place-pages punch slice, then release the parent.
 *
 *   npx tsx scripts/loop-resolve-place-pages-punch-v10.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-de0e0460-2026-08-18t03-21'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = 'c2c6c0fb0'

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '86c750cf785b4208b6fdb5ccd7ce269a',
    status: 'rejected',
    note: `/subdivisions/aspenwood H1 Aspenwood, Homes for Sale + $719,000 353 Aspenwood Avenue + sales history (12 since 2008) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: 'b480b4d6202df4e5ebebea5bcbd90c00',
    status: 'rejected',
    note: `/subdivisions/badlands-ranch H1 + No active listings + sales history (1 since 2024 $2,200,000) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '282b70153d4714af57326b95e53e261e',
    status: 'rejected',
    note: `/subdivisions/canyon-breeze H1 + $749,900 19658 Harvard Place + sales history (49 since 2008) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '372c35f6ec598e4e5dc6ee147dc7c672',
    status: 'rejected',
    note: `/subdivisions/awbrey-highlands H1 + No active listings + sales history (22 since 1998) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '7b81f1f7531bd7b9fc1f4ad0e84f9793',
    status: 'rejected',
    note: `/subdivisions/banta-acres H1 + No active listings + sales history (5 since 1999) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '82e84cfe4d45cc8032ef6b04aa818f40',
    status: 'rejected',
    note: `/subdivisions/canyon-park H1 + No active listings + sales history (155 since 1997) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '0f14721c9f8dd9a82fb251f93424a2a2',
    status: 'rejected',
    note: `/subdivisions/awbrey-point H1 + $2,195,000 2580 Awbrey Point Cir + sales history (42 since 2005) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
  },
  {
    fingerprint: '494ca726b295b911941a9924eb87cc7f',
    status: 'rejected',
    note: `/subdivisions/chaparral-estates H1 + No active listings + sales history (171 since 1997) at 390+1280. Chrome-only did not reproduce. READY ${SHA}.`,
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
