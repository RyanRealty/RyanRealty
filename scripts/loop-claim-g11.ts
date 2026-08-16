/**
 * Claim G11 (Meta audience 7-day hold) and print live ledger evidence.
 *
 *   npx tsx scripts/loop-claim-g11.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isLegalTransition } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const OWNER = 'bc-fe75bb57-b840-4d01-846f-67efa6a79fbc'

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
    .select('id,state,version_gap,title,accept,owner_session,objective,output')
    .eq('version_gap', 'G11')
    .maybeSingle()
  if (readErr || !row) {
    console.error('read failed', readErr?.message)
    process.exit(1)
  }
  console.log(JSON.stringify({ found: row }, null, 2))
  if (row.state === 'in_progress' && row.owner_session === OWNER) {
    console.log('already claimed by this session')
  } else {
    if (!isLegalTransition(row.state, 'in_progress')) {
      console.error('illegal transition', row.state, '-> in_progress')
      process.exit(1)
    }
    const { data, error } = await sb
      .from('loop_work_nodes')
      .update({
        state: 'in_progress',
        owner_session: OWNER,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('state', row.state)
      .select('id,state,owner_session,version_gap,title')
      .single()
    if (error || !data?.id) {
      console.error('update failed', error?.message ?? 'no row')
      process.exit(1)
    }
    console.log(JSON.stringify({ ok: true, claimed: data }, null, 2))
  }

  const { data: logs, error: logErr } = await sb
    .from('meta_audience_log')
    .select('id,ran_at,audience_id,dry_run,add_num_received,add_would_upload,message')
    .order('ran_at', { ascending: false })
    .limit(40)
  if (logErr) {
    console.error('log read failed', logErr.message)
    process.exit(1)
  }
  const days = [...new Set((logs ?? []).map((r) => String(r.ran_at).slice(0, 10)))]
  console.log(
    JSON.stringify(
      {
        rowCountReturned: logs?.length ?? 0,
        distinctUtcDays: days,
        newest: logs?.[0] ?? null,
        byAudience: (logs ?? []).reduce<Record<string, number>>((acc, r) => {
          const k = String(r.audience_id ?? 'null')
          acc[k] = (acc[k] ?? 0) + 1
          return acc
        }, {}),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
