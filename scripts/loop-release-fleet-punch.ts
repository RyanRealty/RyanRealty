/**
 * Release FLEET-PUNCH so leftover lines stay the inbox.
 *
 *   npx tsx scripts/loop-release-fleet-punch.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const OWNER = 'cursor-loop-chain-2026-08-17t03-23-70dd'

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
    .select('id,state,owner_session')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error(readErr?.message ?? 'missing')
    process.exit(1)
  }
  if (row.owner_session !== OWNER) {
    console.error(`owner mismatch: ${row.owner_session}`)
    process.exit(1)
  }
  if (!isLegalTransition(row.state, 'open')) {
    console.error(`illegal ${row.state} -> open`)
    process.exit(1)
  }
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({
      state: 'open',
      owner_session: null,
      blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ID)
    .eq('owner_session', OWNER)
    .select('id,state,owner_session')
    .single()
  if (error || !data?.id) {
    console.error(error?.message ?? 'release failed')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, released: data.id, state: data.state }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
