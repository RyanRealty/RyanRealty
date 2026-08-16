/**
 * Complete G8 with environment evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-complete-g8.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { isLegalTransition } from '../lib/data/loop/work-node'

const ID = '05980864-bfd1-4556-8145-0ddac4fbb0d1'
const OWNER = 'bc-0369d0e1-5c3f-43e2-9a78-9cddc20f2c4c'

const evidence = process.argv.slice(2).join(' ').trim()
if (!evidence) {
  console.error('usage: npx tsx scripts/loop-complete-g8.ts <evidence>')
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
      ledger_row_id: '1b9367f1-908a-4902-890d-c34d981a9a80',
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
