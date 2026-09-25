/**
 * Spark × Supabase reconciliation for monthly editions (CLAUDE.md §0 hard gate),
 * without rendering or writing anything.
 *
 *   npx tsx --conditions=react-server scripts/market-report-reconcile.ts --month 2026-08
 *   npx tsx --conditions=react-server scripts/market-report-reconcile.ts --from 2006-01 --to 2026-08 --json out/recon.json
 *
 * Builds each edition from the stored series exactly as the publish step does,
 * then checks every figure it prints that Spark can also produce
 * (lib/market-report/reconcile.ts). Prints one summary line per edition and a
 * line for every check over the 1% tolerance (--verbose prints every check).
 * Exit code 1 when any edition fails.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { REPORT_DEFINITION_ID } from '@/lib/data/market-report/compute'
import { buildEdition } from '@/lib/market-report/build-edition'
import { loadEditionInputs, monthRange } from '@/lib/market-report/pipeline'
import {
  checkLine,
  liveReconcileSources,
  reconcileEdition,
  reconciliationSummary,
  type EditionReconciliation,
} from '@/lib/market-report/reconcile'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (n: string) => argv.includes(`--${n}`)

async function main() {
  const one = flag('month')
  const from = one ?? flag('from')
  const to = one ?? flag('to')
  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    throw new Error('usage: --month YYYY-MM | --from YYYY-MM --to YYYY-MM [--json file] [--verbose]')
  }
  const inputs = await loadEditionInputs(from, to)
  const sources = liveReconcileSources()
  const results: EditionReconciliation[] = []
  for (const month of monthRange(from, to)) {
    const payload = buildEdition({
      editionMonth: month,
      series: inputs.series,
      bands: inputs.bands,
      generatedAt: new Date().toISOString(),
      definitionId: REPORT_DEFINITION_ID,
    })
    const r = await reconcileEdition(payload, sources)
    results.push(r)
    console.log(reconciliationSummary(r))
    for (const i of r.inconsistencies) console.log(`  FAIL printed twice: ${i}`)
    for (const c of r.checks) {
      if (c.ok && !has('verbose')) continue
      console.log(`  ${checkLine(c)}`)
      if (!c.ok) {
        if (c.missingFromUs.length) console.log(`    missing: ${c.missingFromUs.slice(0, 25).join(', ')}`)
        if (c.extraInOurs.length) console.log(`    extra: ${c.extraInOurs.slice(0, 25).join(', ')}`)
        if (c.priceMismatches.length) console.log(`    price differs: ${c.priceMismatches.slice(0, 25).join(', ')}`)
      }
    }
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length} editions checked, ${failed.length} fail${failed.length ? `: ${failed.map((r) => r.month).join(', ')}` : ''}`)
  const out = flag('json')
  if (out) {
    mkdirSync(path.dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(results, null, 2))
  }
  if (failed.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
