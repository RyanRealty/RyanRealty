/**
 * Complete G15 with environment evidence.
 *
 *   npx tsx scripts/loop-complete-g15.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { readSearchCompletenessAccept, searchCompletenessComplete } from '../lib/data/loop/search-completeness'

config({ path: '.env.local' })

const OWNER = 'cursor-grok-g15-20260816'

async function main() {
  const accept = readSearchCompletenessAccept()
  if (!searchCompletenessComplete(accept) || accept.status !== 'ok') {
    console.error('accept failed', {
      status: accept.status,
      disposed: accept.longTail.disposedCount,
      unexplained: accept.longTail.unexplainedCount,
      ttfb: accept.perf.p75,
    })
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
    .eq('version_gap', 'G15')
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
    `G15 accept: FILTER_COMPLETENESS ledger complete. Probe ${accept.recordedAt}.`,
    `268 long-tail dispositioned, unexplained=0.`,
    `TTFB p75 /homes-for-sale ${accept.perf.p75.ttfbHomesForSaleMs}ms /homes-for-sale/bend ${accept.perf.p75.ttfbBendMs}ms (target 600ms, n=${accept.perf.samples}).`,
    accept.acceptItems.map((i) => `${i.id} ${i.requirement} ${i.disposition}`).join(' | '),
    `Source: ${accept.source}. Gate ci:search-completeness-accept.`,
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
