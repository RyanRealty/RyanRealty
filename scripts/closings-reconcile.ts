/**
 * Closings reconciliation: Spark × Supabase for every closing in a window.
 *
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --from 2026-02-01 --to 2026-08-31
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --from 2025-09-01 --to 2026-09-24 --repair
 *
 * Flags
 *   --from / --to YYYY-MM-DD   close-date window, inclusive
 *   --repair                   re-pull every drifted listing from Spark and write it back
 *   --max <n>                  repair at most n listings (default 2000)
 *   --json <file>              write the full result (every drifted key and why) to a file
 *
 * Without --repair nothing is written. See lib/sync/closingsReconcile.ts.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { writeFileSync } from 'node:fs'
import { reconcileClosings } from '@/lib/sync/closingsReconcile'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

async function main() {
  const from = flag('from')
  const to = flag('to')
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('usage: --from YYYY-MM-DD --to YYYY-MM-DD [--repair] [--max n] [--json file]')
  }
  const t0 = Date.now()
  const r = await reconcileClosings({
    from,
    to,
    repair: argv.includes('--repair'),
    maxRepairs: flag('max') ? Number(flag('max')) : undefined,
  })
  const byReason = new Map<string, number>()
  for (const d of r.drift) for (const reason of d.reasons) byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
  console.log(`window ${from}..${to}: Spark ${r.sparkClosings} closings; we hold ${r.ourClosedInWindow} closed`)
  console.log(`drifted ${r.drift.length}: ${[...byReason].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)
  console.log(`not in Spark (reported only): ${r.notInSpark.length}`)
  if (argv.includes('--repair')) {
    console.log(`repaired ${r.repaired}, history replaced ${r.historyRefreshed}, re-frozen ${r.refinalized}, failed ${r.repairFailed.length}`)
    if (r.repairFailed.length > 0) console.log(`  failed: ${r.repairFailed.join(', ')}`)
  }
  const out = flag('json')
  if (out) writeFileSync(out, JSON.stringify(r, null, 1))
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
