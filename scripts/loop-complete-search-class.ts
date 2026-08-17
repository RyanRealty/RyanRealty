/**
 * Complete the fleet:public-ux:search ship class (8 nodes).
 *
 *   npx tsx scripts/loop-complete-search-class.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-16t23-45-84b5'
const PUBLIC_UX_WINDOW = '2a5054ac'
const IDS = [
  'b4995958-e6b8-4702-9c87-3d952bf45cba',
  'b56e840e-6541-46e0-adc0-d49eb7b2a91d',
  '05b26c63-3358-4766-96cc-2bc72292f2c4',
  '9f083fee-2367-4b43-9428-cd221ec2adfe',
  '163f5602-7fc6-4cb5-9251-5c620dfa6927',
  'c31af584-4f01-434b-a07e-a30a8679511a',
  '76b54b94-b4b8-4279-ad2d-767aaab48013',
  '044570e2-2e08-4d63-8161-3aa9dac9febf',
]

async function main() {
  const evidence = process.argv.slice(2).join(' ').trim()
  if (!evidence) {
    console.error('usage: npx tsx scripts/loop-complete-search-class.ts <evidence>')
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

  const { data: rows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session,title')
    .in('id', IDS)
  if (readErr) {
    console.error('read failed', readErr.message)
    process.exit(1)
  }

  const completed: string[] = []
  const already: string[] = []
  const failed: string[] = []

  for (const id of IDS) {
    const row = rows?.find((r) => r.id === id)
    if (!row) {
      failed.push(`${id}: missing`)
      continue
    }
    if (row.state === 'done') {
      already.push(id)
      continue
    }
    if (row.owner_session && row.owner_session !== OWNER) {
      failed.push(`${id}: owner ${row.owner_session}`)
      continue
    }
    if (!isLegalTransition(row.state, 'done')) {
      failed.push(`${id}: illegal ${row.state} -> done`)
      continue
    }
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'done',
        evidence,
        owner_session: OWNER,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('state', row.state)
      .select('id,state')
      .single()
    if (error || !data?.id) {
      failed.push(`${id}: ${error?.message ?? 'no row'}`)
      continue
    }
    completed.push(id)
  }

  console.log(
    JSON.stringify({ ok: failed.length === 0, completed, already, failed, publicUxOpen: publicUxIds }, null, 2),
  )
  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
