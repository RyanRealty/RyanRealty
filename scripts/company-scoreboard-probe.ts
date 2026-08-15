/**
 * Live ingest for docs/plans/COMPANY_SCOREBOARD.md.
 * Prints JSON. Does not write. Does not send.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { collectCompanyScoreboardSignals } from '../lib/data/loop/signals'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const signals = await collectCompanyScoreboardSignals(sb)
  console.log(JSON.stringify(signals, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
