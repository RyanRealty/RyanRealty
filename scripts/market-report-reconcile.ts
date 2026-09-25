/**
 * Spark × Supabase reconciliation for a monthly edition (CLAUDE.md §0 hard gate).
 *
 *   npx tsx --conditions=react-server scripts/market-report-reconcile.ts --month 2026-08
 *
 * Prints both counts, the missing share, and PASS/FAIL per monthly market.
 * Exit code 1 when any market fails the 1% tolerance.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { MONTHLY_CITIES } from '@/lib/market-report/geos'
import { reconcileMonth, reconciliationLine } from '@/lib/market-report/reconcile'

const argv = process.argv.slice(2)
const i = argv.indexOf('--month')
const month = i >= 0 ? argv[i + 1] : undefined

async function main() {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error('usage: --month YYYY-MM')
  const results = await reconcileMonth(month, MONTHLY_CITIES.map((c) => ({ label: c.label, slug: c.slug })))
  for (const r of results) {
    console.log(reconciliationLine(r))
    if (r.missingFromUs.length > 0) console.log(`  missing keys: ${r.missingFromUs.slice(0, 20).join(', ')}`)
    if (r.extraInOurs.length > 0) console.log(`  extra keys: ${r.extraInOurs.slice(0, 20).join(', ')}`)
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
