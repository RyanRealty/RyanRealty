/**
 * Claim FLEET-PUNCH parent for the served fleet:public-ux:place-pages slice.
 *
 *   npx tsx scripts/loop-claim-fleet-punch-place-v12.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-bc-d14c774b-2026-08-18t06-04'
const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

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
    .select('id,state,title,owner_session,updated_at,objective')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }
  if (row.state === 'in_progress' && row.owner_session === OWNER) {
    console.log(JSON.stringify({ ok: true, already: { ...row, objective: undefined } }, null, 2))
    return
  }
  if (row.state === 'in_progress' && row.owner_session !== OWNER) {
    console.error('already claimed by', row.owner_session)
    process.exit(1)
  }
  if (!isLegalTransition(row.state, 'in_progress')) {
    console.error('illegal', row.state, '-> in_progress')
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
    .eq('id', ID)
    .eq('state', row.state)
    .select('id,state,owner_session,title')
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
