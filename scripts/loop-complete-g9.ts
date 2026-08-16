/**
 * Complete G9 with environment evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-complete-g9.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'
import { lookWalkBaselineComplete, readLookWalkBaseline } from '../lib/data/loop/look-walk'

config({ path: '.env.local' })

const OWNER = 'bc-66d23ef1-fc40-4fe7-87ec-b7dc59ce4f39'
const NODE_ID = '4aa54907-47ce-4b96-9eaa-d370a6e56df5'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const look = readLookWalkBaseline()
  if (!lookWalkBaselineComplete(look)) {
    console.error('baseline incomplete', look)
    process.exit(1)
  }
  const evidence = [
    `Look-walk baseline ${look.recordedAt}: ${look.public.routes.length}/8 beat_on routes HTTP 200 at 390+1280.`,
    `Public verdicts: ${look.public.routes.map((r) => `${r.route}=${r.verdict}`).join(', ')}.`,
    `CMA ${look.cma.slug} ${look.cma.verdict} pages=${look.cma.pageCount} coverIsHouse=${look.cma.coverIsHouse} sellerReadableOnePass=${look.cma.sellerReadableOnePass}.`,
    `Packet §1b cites docs/plans/ENTERPRISE_MAP/look-walk-baseline.json. Gate ci:look-walk.`,
    `Source: production https://ryan-realty.com. Capture out/look-walk/capture.json.`,
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
