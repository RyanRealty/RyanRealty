/**
 * On-market reconciliation: every listing we hold as for sale or under contract
 * (Active, Active Under Contract, Pending, Coming Soon) against the MLS's current
 * record, statewide.
 *
 *   npx tsx --conditions=react-server scripts/on-market-reconcile.ts
 *   npx tsx --conditions=react-server scripts/on-market-reconcile.ts --repair --max 500 --json out/on-market.json
 *
 * Flags
 *   --repair          re-pull every drifted listing from Spark and write it back
 *   --max <n>         repair at most n listings (default 500)
 *   --json <file>     write the full result (every drifted key and why) to a file
 *
 * Without --repair nothing is written. With it, each drifted listing's old row
 * is kept in listing_mls_repair_log (source 'on-market-reconcile') before it is
 * re-pulled. A listing the MLS changed since the delta-sync cursor is left to
 * the delta sync, and one the MLS no longer serves is listed, never changed.
 * The daily cron /api/cron/on-market-reconcile runs the same sweep with repair
 * (Matt 2026-10-01, "Fix now and check daily"). See lib/sync/onMarketReconcile.ts.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { reconcileOnMarket } from '@/lib/sync/onMarketReconcile'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

async function main() {
  const repair = argv.includes('--repair')
  const maxRaw = flag('max') ?? '500'
  if (!/^\d+$/.test(maxRaw)) throw new Error(`--max takes a whole number, got ${JSON.stringify(maxRaw)}`)
  const maxRepairs = Number(maxRaw)
  const today = new Date().toISOString().slice(0, 10)
  const t0 = Date.now()
  const r = await reconcileOnMarket({ repair, maxRepairs, today })
  const pairs = new Map<string, number>()
  for (const d of r.drift) {
    const k = d.reasons.includes('missing') ? `missing -> ${d.mls.status}` : `${d.ours?.status} -> ${d.mls.status}${d.reasons.includes('status') ? '' : ` (${d.reasons.join(', ')})`}`
    pairs.set(k, (pairs.get(k) ?? 0) + 1)
  }
  console.log(
    `Spark on the market ${r.sparkOnMarket}, ours ${r.ourOnMarket}; drifted ${r.drift.length} to repair, ${r.leftToDeltaSync} left to the delta sync; not served by the MLS ${r.notInSpark.length}`,
  )
  for (const [k, n] of [...pairs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
  if (r.notInSpark.length) console.log(`not served: ${r.notInSpark.map((x) => `${x.key} (${x.status})`).join(', ')}`)
  if (repair) {
    console.log(`repaired ${r.repaired} (before-images logged ${r.repairLogged}), failed ${r.repairFailed.length}${r.repairFailed.length ? `: ${r.repairFailed.join(', ')}` : ''}`)
    if (r.leftAtRepair.length) console.log(`changed in the MLS since the cutoff when re-pulled, left to the delta sync: ${r.leftAtRepair.join(', ')}`)
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
  const out = flag('json')
  if (out) {
    mkdirSync(path.dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(r, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
