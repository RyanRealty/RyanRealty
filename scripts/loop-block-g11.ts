/**
 * Block G11 until the accept day. Not imported by the app.
 *
 *   npx tsx scripts/loop-block-g11.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { readMetaAudienceHold } from '../lib/data/loop/meta-audience-hold'

config({ path: '.env.local' })

const OWNER = 'bc-fe75bb57-b840-4d01-846f-67efa6a79fbc'
const NODE_ID = '568d807b-ac07-43cc-9eea-52b8f67460a6'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const hold = await readMetaAudienceHold(sb)
  if (hold.holdMet) {
    console.error('hold is met — complete the node instead of blocking', hold)
    process.exit(1)
  }
  const reason = [
    `Calendar accept not met: consecutive UTC days=${hold.consecutiveDays} lastDay=${hold.lastDay} (need lastDay >= 2026-08-22).`,
    `Last LIVE ${hold.lastRanAt} current=${hold.current}.`,
    `Map cell updated (INT-007 still FIX). Unblock on or after 2026-08-22 when readMetaAudienceHold.holdMet is true, then flip KEEP.`,
  ].join(' ')

  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session')
    .eq('id', NODE_ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
  }
  if (row.state === 'blocked' && row.owner_session === OWNER) {
    console.log(JSON.stringify({ already: 'blocked', reason }, null, 2))
    return
  }
  if (row.owner_session !== OWNER) {
    console.error('owner mismatch', row.owner_session)
    process.exit(1)
  }
  if (!isLegalTransition(row.state, 'blocked')) {
    console.error('illegal transition', row.state, '-> blocked')
    process.exit(1)
  }
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({
      state: 'blocked',
      blocked_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('state', row.state)
    .select('id,state,blocked_reason')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, blocked: data, hold }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
