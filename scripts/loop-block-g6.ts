/**
 * Block G6 — accept requires a live marketing-line SMS this session cannot send.
 *
 *   npx tsx scripts/loop-block-g6.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const ID = 'c8bbccaa-84ef-492c-8ce8-9af437833e31'

const reason = [
  'Accept is a live marketing-line conversation: broker cell → +15412245025 → agent reply → APPROVE stamp.',
  'Hard limit: no outbound messages to real people. Agent reply would SMS Matt +15412136706.',
  'Environment 2026-08-16: generated_by=broker_sms_agent rows=2, approved_by=null on both (7fc5fa8b, d4711088), both killed as thin-payload approval-gate tests 2026-08-03.',
  'Turns=5, all 2026-08-02 in-process Redmond Q&A smoke (SMe2e*), not a marketing-line APPROVE.',
  'sms_agent_enabled: matt=true, paul=false, rebecca=false. Sessions=2, last activity 2026-08-03.',
  'DoD 3 (live post) is public posting. DoD 10 (Matt-only pilot ≥1 week) needs calendar time after a live APPROVE.',
  'Unblock: Matt texts APPROVE on the marketing line against a ready draft, or authorizes one smoke text to his cell that includes APPROVE (still no live publish).',
].join(' ')

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
    .eq('id', ID)
    .eq('state', row.state)
    .select('id,state,blocked_reason')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, id: data.id, state: data.state, blocked_reason: data.blocked_reason }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
