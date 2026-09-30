/**
 * Closings and listing status reconciliation: Spark × Supabase.
 *
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --from 2026-02-01 --to 2026-08-31
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --from 2025-09-01 --to 2026-09-24 --repair
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --status
 *   npx tsx --conditions=react-server scripts/closings-reconcile.ts --status --repair
 *
 * Flags
 *   --from / --to YYYY-MM-DD   close-date window, inclusive (closings mode)
 *   --status                   status mode instead: every listing Spark or we hold on the market, plus
 *                              our recent Expired/Withdrawn/Canceled rows, set against Spark by key
 *   --terminal-days <n>        status mode: re-check our terminal rows whose status changed in the last
 *                              n days (default 120; 0 skips them)
 *   --repair                   re-pull every drifted listing from Spark and write it back
 *   --max <n>                  repair at most n listings (default 2000)
 *   --json <file>              write the full result (every drifted key and why) to a file
 *
 * Without --repair nothing is written. With it, each drifted listing's old
 * values are kept in listing_mls_repair_log before it is re-pulled (source
 * 'closings-reconcile' or 'status-reconcile'), and in closings mode closings
 * Spark no longer serves at all are recorded in market_listing_absent_from_mls
 * (left out of every Market Truth statistic, Matt 2026-09-25). See
 * lib/sync/closingsReconcile.ts.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { writeFileSync } from 'node:fs'
import { reconcileClosings, reconcileListingStatus, STATUS_RECONCILE_TERMINAL_DAYS } from '@/lib/sync/closingsReconcile'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

function wholeNumber(name: string, min: number): number | undefined {
  const v = flag(name)
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} takes a whole number of at least ${min}`)
  return n
}

function tally(drift: { reasons: string[] }[]): string {
  const byReason = new Map<string, number>()
  for (const d of drift) for (const reason of d.reasons) byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
  return [...byReason].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'
}

async function status(repair: boolean, max: number | undefined) {
  const terminalDays = wholeNumber('terminal-days', 0) ?? STATUS_RECONCILE_TERMINAL_DAYS
  const r = await reconcileListingStatus({ repair, maxRepairs: max, terminalSinceDays: terminalDays })
  console.log(
    `on the market: Spark ${r.sparkOnMarket}, we hold ${r.ourOnMarket}; our terminal rows re-checked: ${r.terminalChecked}` +
      (r.terminalSince ? ` (status change since ${r.terminalSince.slice(0, 10)})` : ' (skipped)'),
  )
  if (r.refused) console.log(`REFUSED: ${r.refused}`)
  const pairs = new Map<string, number>()
  for (const d of r.drift) {
    const k = `${d.ours?.status ?? '(not held)'} -> ${d.mls.status ?? '?'}`
    pairs.set(k, (pairs.get(k) ?? 0) + 1)
  }
  console.log(`drifted ${r.drift.length}: ${tally(r.drift)}`)
  console.log(`  status pairs (ours -> Spark): ${[...pairs].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)
  console.log(`on the market here but not served by Spark at all: ${r.notInSpark.length} (reported only)`)
  if (repair) {
    console.log(
      `repaired ${r.repaired} (old values kept in listing_mls_repair_log: ${r.repairLogged}), history replaced ${r.historyRefreshed}, re-frozen ${r.refinalized}, membership rows rebuilt ${r.membershipRows}, left alone as newer here ${r.skippedNewer.length}, failed ${r.repairFailed.length}`,
    )
    if (r.repairFailed.length > 0) console.log(`  failed: ${r.repairFailed.join(', ')}`)
  }
  return r
}

async function closings(repair: boolean, max: number | undefined) {
  const from = flag('from')
  const to = flag('to')
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('usage: --from YYYY-MM-DD --to YYYY-MM-DD [--repair] [--max n] [--json file]  |  --status [--terminal-days n] [--repair] [--max n] [--json file]')
  }
  const r = await reconcileClosings({ from, to, repair, maxRepairs: max })
  console.log(`window ${from}..${to}: Spark ${r.sparkClosings} closings; we hold ${r.ourClosedInWindow} closed`)
  console.log(`drifted ${r.drift.length}: ${tally(r.drift)}`)
  console.log(
    `not in Spark: ${r.notInSpark.length}` +
      (repair
        ? ` (recorded as absent from the MLS: ${r.absentFromMls.recorded}; back in the MLS and released: ${r.absentFromMls.cleared}${r.absentFromMls.refused ? `; NOT recorded: ${r.absentFromMls.refused}` : ''})`
        : ' (reported only)'),
  )
  if (repair) {
    console.log(
      `repaired ${r.repaired} (old values kept in listing_mls_repair_log: ${r.repairLogged}), history replaced ${r.historyRefreshed}, re-frozen ${r.refinalized}, membership rows rebuilt ${r.membershipRows}, left alone as newer here ${r.repairSkippedNewer.length}, failed ${r.repairFailed.length}`,
    )
    if (r.repairFailed.length > 0) console.log(`  failed: ${r.repairFailed.join(', ')}`)
  }
  return r
}

async function main() {
  const repair = argv.includes('--repair')
  const max = wholeNumber('max', 1)
  const t0 = Date.now()
  const r = argv.includes('--status') ? await status(repair, max) : await closings(repair, max)
  const out = flag('json')
  if (out) writeFileSync(out, JSON.stringify(r, null, 1))
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
