/**
 * Live G11 evidence. Not imported by the app.
 *
 *   npx tsx scripts/loop-probe-g11.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import {
  computeAudienceHold,
  CRM_AUDIENCE_ID,
  WESTSIDE_AUDIENCE_ID,
} from '../lib/data/loop/meta-audience-hold'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { count, error: countErr } = await sb
    .from('meta_audience_log')
    .select('id', { count: 'exact', head: true })
  const { data: rows, error } = await sb
    .from('meta_audience_log')
    .select('ran_at,audience_id,dry_run,add_num_received,add_would_upload')
    .order('ran_at', { ascending: false })
    .limit(200)
  if (countErr || error) {
    console.error(countErr?.message ?? error?.message)
    process.exit(1)
  }
  const now = new Date()
  const hold = computeAudienceHold(rows ?? [], now)
  const west = (rows ?? []).filter((r) => r.audience_id === WESTSIDE_AUDIENCE_ID)
  const crm = (rows ?? []).filter((r) => r.audience_id === CRM_AUDIENCE_ID)
  console.log(
    JSON.stringify(
      {
        totalRows: count,
        hold,
        crmNewest: crm[0] ?? null,
        westNewest: west[0] ?? null,
        crmHold: computeAudienceHold(crm, now),
        westHold: computeAudienceHold(west, now),
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
