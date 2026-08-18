/**
 * Dump the served sitemap.xml punch lines and probe live status.
 *
 *   npx tsx scripts/loop-probe-sitemap-punch.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { openPunchLines } from '../lib/data/loop/fleet-intake-core'
import { selectPunchSlice } from '../lib/data/loop/ship-class'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const FINGERPRINTS = [
  'fe303e01b3c306991850ccddd8298b6e',
  'af2543a434cf52d68801d9e948bbaf7f',
  '76d8247a2d0efce402db514ecbe22769',
  'cbf99bdeee95ba5a59bfe0f8ad9a7a87',
]

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
    .select('id,objective,state,owner_session')
    .eq('id', ID)
    .single()
  if (error || !row) {
    console.error('read failed', error?.message ?? 'missing')
    process.exit(1)
  }
  const slice = selectPunchSlice(String(row.objective ?? ''), 'public-ux')
  const served = slice.served.filter((l) => FINGERPRINTS.includes(l.fingerprint))
  console.log(JSON.stringify({
    owner: row.owner_session,
    state: row.state,
    family: slice.family,
    servedCount: served.length,
    openTotal: slice.openTotal,
    lines: served.map((l) => ({
      fingerprint: l.fingerprint,
      severity: l.severity,
      url: l.url,
      expected: l.expected ?? null,
      observed: l.observed,
    })),
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
