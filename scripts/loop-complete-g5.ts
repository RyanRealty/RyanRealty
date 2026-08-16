/**
 * Complete G5 with environment evidence. Not imported by the app (server-only DAL).
 *
 *   npx tsx scripts/loop-complete-g5.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const ID = '468febf9-3e86-46d1-96cc-a327061bcae0'

const evidence = process.argv.slice(2).join(' ').trim()
if (!evidence) {
  console.error('usage: npx tsx scripts/loop-complete-g5.ts <evidence>')
  process.exit(2)
}

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
    .select('id,state')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
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
      blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ID)
    .eq('state', row.state)
    .select('id,state')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, id: data.id, state: data.state }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
