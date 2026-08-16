/**
 * Complete G12 with environment evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-complete-g12.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { readVideoDecisionDocket, videoDocketComplete } from '../lib/data/loop/video-docket'

config({ path: '.env.local' })

const OWNER = 'bc-26bd9513-82b6-4e3e-b22e-9aba3838e83e'
const NODE_ID = '53355a5b-fafc-4136-8cbd-dc98aa73ed05'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const docket = readVideoDecisionDocket()
  if (!videoDocketComplete(docket) || docket.status !== 'ok') {
    console.error('docket incomplete', docket)
    process.exit(1)
  }
  const evidence = [
    `Video docket complete. Park incremental vendor $${docket.park.incrementalVendorUsd}.`,
    `Rebuild ElevenLabs Turbo $${docket.rebuild.elevenLabsTurboUsdPer1kChars}/1k chars; producer cap $${docket.rebuild.producerCapPerRowUsd}/row $${docket.rebuild.producerCapPerRunUsd}/run.`,
    `Breakage: ${docket.inventory.deadSafeZoneImports} dead safe-zone imports; ${docket.inventory.decommissionedProducers} producers out of REGISTRY.`,
    `Decision ${docket.decision.status} (M3). Source: ${docket.source}. Gate ci:video-docket.`,
  ].join(' ')

  const sb = createClient(url, key)
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session')
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
  console.log(JSON.stringify({ ok: true, completed: data, evidence, docket }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
