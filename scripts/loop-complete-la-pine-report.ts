/**
 * Complete the La Pine housing-market report fleet finding.
 *
 *   npx tsx scripts/loop-complete-la-pine-report.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-16t18-00-f801'
const NODE_ID = '7d7c74c6-466a-477f-a252-201f3ca5dbc1'

async function main() {
  const evidence = process.argv.slice(2).join(' ').trim()
  if (!evidence) {
    console.error('usage: npx tsx scripts/loop-complete-la-pine-report.ts <evidence>')
    process.exit(2)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session')
    .eq('id', NODE_ID)
    .maybeSingle()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
  }
  if (row.state === 'done') {
    console.log('already done')
    return
  }
  if (!isLegalTransition(row.state, 'done')) {
    console.error('illegal transition', row.state, '-> done')
    process.exit(1)
  }
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({
      state: 'done',
      evidence,
      owner_session: OWNER,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('state', row.state)
    .select('id,state')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, completed: data, evidence }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
