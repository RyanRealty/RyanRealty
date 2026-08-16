/**
 * Claim the Awbrey Butte place-page city-grain hero-copy fleet finding.
 *
 *   npx tsx scripts/loop-claim-awbrey-grain.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-sentinel-2026-08-16t16-50-c8df'
const FLEET = '97c68da5aab650182ea830ef358103f2'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: rows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,version_gap,title,accept,owner_session,objective,output,domain')
    .eq('state', 'open')
    .ilike('objective', `%${FLEET}%`)
  if (readErr) {
    console.error('read failed', readErr.message)
    process.exit(1)
  }
  const row = rows?.[0]
  if (!row) {
    console.error(`no open node for fleet:${FLEET}`)
    process.exit(1)
  }
  console.log(JSON.stringify({ found: row }, null, 2))
  if (row.state === 'in_progress' && row.owner_session === OWNER) {
    console.log('already claimed by this session')
    return
  }
  if (!isLegalTransition(row.state, 'in_progress')) {
    console.error('illegal transition', row.state, '-> in_progress')
    process.exit(1)
  }
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({
      state: 'in_progress',
      owner_session: OWNER,
      blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('state', row.state)
    .select('id,state,owner_session,title,domain,accept,objective,output')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, claimed: data }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
