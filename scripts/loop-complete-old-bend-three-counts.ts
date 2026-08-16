/**
 * Complete the Old Bend 6/9/7/8 three-count fleet finding.
 *
 *   npx tsx scripts/loop-complete-old-bend-three-counts.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-16t23-30-c3e9'
const NODE_ID = 'aa0849fc-c79b-45d5-9efd-0700385fa791'
const FLEET = 'f9d85a124cbb4c58bfbf246112b89085'
const PUBLIC_UX_WINDOW = '2a5054ac'

async function main() {
  const evidence = process.argv.slice(2).join(' ').trim()
  if (!evidence) {
    console.error('usage: npx tsx scripts/loop-complete-old-bend-three-counts.ts <evidence>')
    process.exit(2)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: publicUxOpen, error: ledgerErr } = await sb
    .from('site_improvement_ledger')
    .select('id,domain,change_class')
    .eq('domain', 'public-ux')
    .is('verdict', null)
  if (ledgerErr) {
    console.error('ledger read failed', ledgerErr.message)
    process.exit(1)
  }
  const publicUxIds = (publicUxOpen ?? []).map((r) => String(r.id))
  if (publicUxIds.length !== 1 || !publicUxIds[0].startsWith(PUBLIC_UX_WINDOW)) {
    console.error('unexpected public-ux open windows — refusing a second ledger row', publicUxIds)
    process.exit(1)
  }

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
  } else {
    if (row.owner_session && row.owner_session !== OWNER) {
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
    console.log(JSON.stringify({ ok: true, completed: data, publicUxOpen: publicUxIds }, null, 2))
  }

  const { data: findings, error: findErr } = await sb
    .from('fleet_findings')
    .select('id,status,fingerprint')
    .eq('fingerprint', FLEET)
  if (findErr) {
    console.error('finding read failed', findErr.message)
    process.exit(1)
  }
  for (const f of findings ?? []) {
    if (f.status === 'rejected') continue
    const { error } = await sb
      .from('fleet_findings')
      .update({
        status: 'rejected',
        node_id: NODE_ID,
        triaged_at: new Date().toISOString(),
      })
      .eq('id', f.id)
    if (error) {
      console.error('finding reject failed', error.message)
      process.exit(1)
    }
    console.log(JSON.stringify({ findingRejected: f.id, fingerprint: f.fingerprint }, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
