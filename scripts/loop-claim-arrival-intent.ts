/**
 * Claim the served solo Matt CHANGE: remove homepage ArrivalIntent strip.
 *
 *   npx tsx scripts/loop-claim-arrival-intent.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-17t08-22-7277'
const IDS = ['08152acc-40fc-40c1-b182-0a06bea97c32']

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: rows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,title,owner_session')
    .in('id', IDS)
  if (readErr) {
    console.error('read failed', readErr.message)
    process.exit(1)
  }
  const claimed: string[] = []
  const already: string[] = []
  const failed: string[] = []
  for (const id of IDS) {
    const row = rows?.find((r) => r.id === id)
    if (!row) {
      failed.push(`${id}: missing`)
      continue
    }
    if (row.state === 'in_progress' && row.owner_session === OWNER) {
      already.push(id)
      continue
    }
    if (row.state === 'in_progress' && row.owner_session !== OWNER) {
      failed.push(`${id}: already claimed by ${row.owner_session}`)
      continue
    }
    if (!isLegalTransition(row.state, 'in_progress')) {
      failed.push(`${id}: illegal ${row.state} -> in_progress`)
      continue
    }
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'in_progress',
        owner_session: OWNER,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('state', row.state)
      .select('id,state,owner_session,title')
      .single()
    if (error || !data?.id) {
      failed.push(`${id}: ${error?.message ?? 'no row'}`)
      continue
    }
    claimed.push(id)
  }
  console.log(JSON.stringify({ ok: failed.length === 0, claimed, already, failed }, null, 2))
  if (failed.length > 0 && claimed.length === 0 && already.length === 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
