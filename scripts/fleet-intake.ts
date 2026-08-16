/**
 * fleet-intake — standalone runner for the fleet intake core.
 *
 *   npx tsx scripts/fleet-intake.ts
 *
 * NOTE: the loop-brief runs the same intake automatically at every boot
 * (lib/data/loop/fleet-intake-core.ts), so this script is only needed to
 * triage findings without starting an iteration.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { runFleetIntake } from '../lib/data/loop/fleet-intake-core'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const r = await runFleetIntake(sb)
  console.log(
    `findings processed: ${r.processed} · nodes created: ${r.created.length} · duplicates: ${r.duplicates} · baselines: ${r.baselines}`,
  )
  for (const c of r.created) console.log(`  -> node ${c.nodeId.slice(0, 8)}: ${c.title}`)
  for (const e of r.errors) console.error(`  ERROR: ${e}`)
  process.exit(r.errors.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
