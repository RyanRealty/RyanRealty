/**
 * Complete G7 with environment evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-complete-g7.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const ID = 'f10b9c7c-c4ad-4d55-bdbe-3294000a8e62'
const OWNER = 'bc-311e4201-0cc8-4ade-b44d-879873938822'

const evidence = process.argv.slice(2).join(' ').trim()
if (!evidence) {
  console.error('usage: npx tsx scripts/loop-complete-g7.ts <evidence>')
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
    .select('id,state,owner_session')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
  }
  if (row.owner_session !== OWNER) {
    console.error('refusing complete: owner mismatch', row)
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
    .eq('owner_session', OWNER)
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
