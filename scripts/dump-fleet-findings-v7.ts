/**
 * Dump the 8 served fleet findings in full.
 *
 *   npx tsx scripts/dump-fleet-findings-v7.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const FPS = [
  'c4295f3918ba1e3b6e56337da7c2f76d',
  '11f1005157422824b2e3ef7eb7a14ae7',
  '5709b40930603d356a1625d63ded320b',
  'b3b134ea04cf196a6fc92f51feab58fd',
  '33af9e74607f9cbdf5a53e6175105b36',
  'c1f7420c85e68ae7033281b01532361b',
  'bf86c695cfea8b256c15e57abae23ca9',
  '7a7b29baf8624f4c2c0873209d8cd01c',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('fleet_findings')
    .select('id,bot,case_id,url,viewport,expected,observed,severity,evidence,domain,status,fingerprint,created_at')
    .in('fingerprint', FPS)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  for (const row of data ?? []) {
    console.log('=====')
    console.log(JSON.stringify(row, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
