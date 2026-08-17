/**
 * Complete the ArrivalIntent Matt CHANGE node with environment evidence.
 *
 *   npx tsx scripts/loop-complete-arrival-intent.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-17t08-22-7277'
const NODE_ID = '08152acc-40fc-40c1-b182-0a06bea97c32'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const evidence = [
    'Matt CHANGE ArrivalIntent quiz unmounted from public /.',
    'Product df1a8bfd8 on origin/main.',
    'Vercel Production READY 3doPtMka2BFtvCg7uLj2c8GbthAS (npm run deploy:verify exit 0).',
    'Reproduce before READY: clean-cookie / quizNav true y=57, Buy/Sell/Look y=69, heroY 512/423 at 390/1280.',
    'Accept after READY: quizNav false, no Buy/Look quiz links, header Sell only, heroY 444/355.',
    'Shots /opt/cursor/artifacts/{before,after}_home_{390,1280}_top.png.',
    'Class: ArrivalIntent.client.tsx deleted; D103 + homepage-v6 parity; R-218; V3SectionTracker keeps public-ui mixed.',
    'No hosted migration. No public-ux ledger insert (open window 2a5054ac).',
  ].join(' ')

  const sb = createClient(url, key)
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
      ledger_row_id: row.ledger_row_id,
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
