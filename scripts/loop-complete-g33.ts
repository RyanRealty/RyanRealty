/**
 * Complete G33 with environment evidence.
 *
 *   npx tsx scripts/loop-complete-g33.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-grok-loop-status-20260816'
const NODE_ID = '1a6eb37a-ce0d-44fb-86a3-3a7d33977d92'

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
    .select('id,state,owner_session,version_gap,title')
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
  const { data: factoryOpen, error: ledgerErr } = await sb
    .from('site_improvement_ledger')
    .select('id,domain,change_class')
    .eq('domain', 'factory')
    .is('verdict', null)
  if (ledgerErr) {
    console.error('ledger read failed', ledgerErr.message)
    process.exit(1)
  }
  const factoryIds = (factoryOpen ?? []).map((r) => String(r.id))
  if (factoryIds.length !== 1 || !factoryIds[0].startsWith('ba3435dd')) {
    console.error('unexpected factory open windows — refusing a second ledger row', factoryIds)
    process.exit(1)
  }
  const evidence = [
    'READY dpl_G9w7nisxxBiAkXh7gchLsBzMrG1y (385s) main@1f01f54f.',
    'Class: /admin/loop Now/Next/Waiting/Finished in plain English; shop jargon folded.',
    'Accept: signed-in 390+1280 on localhost and https://ryan-realty.com/admin/loop. Verdict + human titles. No Fleet finding / p0 / sentinel in primary chrome. Console errors none.',
    'Shots: out/loop-status and out/loop-status-prod.',
    'No factory ledger insert (open window ba3435dd unchanged). Did not claim a fleet node. Did not fire an extra sentinel.',
  ].join(' ')
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
    .select('id,state,version_gap')
    .single()
  if (error || !data?.id) {
    console.error('update failed', error?.message ?? 'no row')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, completed: data, factoryOpen: factoryIds }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
