/**
 * Print the served fleet:public-ux:place-pages punch fingerprints.
 *
 *   npx tsx scripts/loop-place-pages-punch-ids.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { openPunchLines } from '../lib/data/loop/fleet-intake-core'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SERVED = [
  '/subdivisions/south-meadow',
  '/cities/tumalo',
  '/subdivisions/deer-park',
  '/subdivisions/deschutes-river-recreation-homesites',
  '/subdivisions/rivers-edge-village',
  '/cities/bend/boyd-acres',
  '/cities/bend/old-bend',
  '/cities/bend/southern-crossing',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data, error } = await sb.from('loop_work_nodes').select('objective').eq('id', ID).single()
  if (error || !data) {
    console.error(error?.message ?? 'missing')
    process.exit(1)
  }
  const open = openPunchLines(String(data.objective ?? ''))
  const served = SERVED.flatMap((path) => {
    const hits = open.filter((l) => l.url.includes(path))
    return hits.slice(0, 1)
  })
  console.log(
    JSON.stringify(
      served.map((l) => ({
        fingerprint: l.fingerprint,
        url: l.url,
        expected: l.expected,
        observed: l.observed.slice(0, 160),
      })),
      null,
      2,
    ),
  )
  console.log('served', served.length, 'open', open.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
