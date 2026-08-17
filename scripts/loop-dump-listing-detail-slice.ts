/**
 * Print the served fleet:public-ux:listing-detail punch slice.
 *
 *   npx tsx scripts/loop-dump-listing-detail-slice.ts
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { selectPunchSlice } from '../lib/data/loop/ship-class'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: row, error } = await sb
    .from('loop_work_nodes')
    .select('id,state,owner_session,updated_at,objective,domain')
    .eq('id', ID)
    .single()
  if (error || !row) {
    console.error('read failed', error?.message ?? 'missing')
    process.exit(1)
  }
  const slice = selectPunchSlice(String(row.objective ?? ''), String(row.domain ?? 'public-ux'))
  console.log(
    JSON.stringify(
      {
        state: row.state,
        owner: row.owner_session,
        updated_at: row.updated_at,
        key: slice.key,
        family: slice.family,
        openTotal: slice.openTotal,
        leftoverInFamily: slice.leftoverInFamily,
        leftoverOtherFamilies: slice.leftoverOtherFamilies,
        served: slice.served.map((l) => ({
          severity: l.severity,
          url: l.url,
          fingerprint: l.fingerprint,
          observed: l.observed,
        })),
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
