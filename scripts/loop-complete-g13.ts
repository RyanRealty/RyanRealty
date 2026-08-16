/**
 * Complete G13 with environment evidence.
 *
 *   npx tsx scripts/loop-complete-g13.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { integrationHealthComplete, readIntegrationHealth } from '../lib/data/loop/integration-health'

config({ path: '.env.local' })

const OWNER = 'bc-4c2a67d8-8857-473a-9878-2099c2607f5f'

async function main() {
  const probes = readIntegrationHealth()
  if (!integrationHealthComplete(probes) || probes.unknownCount !== 0) {
    console.error('accept failed', { status: probes.status, unknownCount: probes.unknownCount })
    process.exit(1)
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
    .select('id,state,version_gap,owner_session')
    .eq('version_gap', 'G13')
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
  const evidence = [
    `G13 accept: INTEGRATIONS unknown=0. Probe ${probes.recordedAt}.`,
    `green=${probes.greenCount} park=${probes.parkCount} probed=${probes.probedCount}.`,
    probes.rows.map((r) => `${r.id} ${r.health}/${r.disposition} ${r.evidence}`).join(' | '),
    `Source: ${probes.source}. Gate ci:integration-health.`,
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
  console.log(JSON.stringify({ ok: true, completed: data, evidence }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
