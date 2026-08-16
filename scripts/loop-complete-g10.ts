/**
 * Complete G10 with environment evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-complete-g10.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { readJoinConversionStats } from '../lib/data/loop/join-conversion'

config({ path: '.env.local' })

const OWNER = 'bc-120b6b86-e7c3-4235-8ec9-72f20954bf55'
const NODE_ID = '086bdf15-0172-4f9f-8704-70ba9094ef0f'
const LEDGER_ID = '5683a341-68d4-4b5f-aed0-6a5f4922ed0b'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const join = await readJoinConversionStats(sb)
  if (join.status !== 'ok') {
    console.error('join unreadable', join)
    process.exit(1)
  }
  const evidence = [
    `/join convert ${join.visits7d} visits 7d / ${join.visitsAll} all-time · ${join.conversions7d} conversions 7d / ${join.conversionsAll} all-time.`,
    `Source: ${join.source}.`,
    `Packet §1b + recruit-retain cite getJoinConversionStats. Gate ci:join-conversion.`,
    `Writer: submitContactForm Join the team → recordJoinConversion + tagRecruitJoin (no buyer enroll, no CAPI Lead).`,
  ].join(' ')

  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session,ledger_row_id')
    .eq('id', NODE_ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
  }
  if (row.state === 'done') {
    console.log('already done')
    return
  }
  if (row.owner_session !== OWNER) {
    console.error('owner mismatch', row.owner_session)
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
      ledger_row_id: LEDGER_ID,
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
  console.log(JSON.stringify({ ok: true, completed: data, evidence, join }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
