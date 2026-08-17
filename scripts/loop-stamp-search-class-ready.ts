/**
 * Update evidence on the already-done search-class nodes. Does not reopen them.
 *
 *   npx tsx scripts/loop-stamp-search-class-ready.ts <evidence>
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const OWNER = 'cursor-loop-chain-2026-08-16t23-45-84b5'
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
    console.error('usage: npx tsx scripts/loop-stamp-search-class-ready.ts <evidence>')
    process.exit(2)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: rows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session')
    .in('id', IDS)
  if (readErr) {
    console.error('read failed', readErr.message)
    process.exit(1)
  }
  const stamped: string[] = []
  const failed: string[] = []
  for (const id of IDS) {
    const row = rows?.find((r) => r.id === id)
    if (!row) {
      failed.push(`${id}: missing`)
      continue
    }
    if (row.state !== 'done') {
      failed.push(`${id}: state ${row.state} (refusing to reopen)`)
      continue
    }
    const { error } = await sb
      .from('loop_work_nodes')
      .update({
        evidence,
        owner_session: OWNER,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('state', 'done')
    if (error) {
      failed.push(`${id}: ${error.message}`)
      continue
    }
    stamped.push(id)
  }
  console.log(JSON.stringify({ ok: failed.length === 0, stamped, failed }, null, 2))
  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
