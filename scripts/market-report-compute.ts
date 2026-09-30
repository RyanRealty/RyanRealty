/**
 * Monthly market report: refresh the listing attributes and compute the series.
 *
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --listings
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --from 1997-01 --to 2026-08
 *   npx tsx --conditions=react-server scripts/market-report-compute.ts --from 2026-07 --to 2026-07 --kinds month
 *
 * Flags
 *   --listings              rebuild market_report_listing (batched) and the geography universe first
 *   --facts                 rebuild the compact sale and span copies (after --listings; before computing)
 *   --from YYYY-MM          first period end month (inclusive)
 *   --to YYYY-MM            last period end month (inclusive)
 *   --kinds a,b             month,trailing3,trailing12,quarter (default: all four; quarter only at quarter ends)
 *   --definition <id>       definition_id to write (default mr-v1); use a scratch id for calibration runs
 *   --acreage <n>           acreage threshold in acres (default 1)
 *   --refresh-window        incremental refresh for --from..--to (what the daily cron runs): prune and
 *                           refresh sale facts from --from, rebuild episodes for listings modified since
 *                           --span-since (default --from), refresh report attributes, rebuild the compact
 *                           copies for the window, recompute every period in it
 *   --span-since YYYY-MM-DD with --refresh-window
 *
 * Every call is idempotent: a period is deleted and rewritten for its definition.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { refreshReportWindow } from '@/lib/market-report/pipeline'
import {
  computeMarketReportPeriod,
  refreshMarketReportFacts,
  refreshMarketReportGeo,
  refreshMarketReportListingBatch,
  REPORT_DEFINITION_ID,
  type ReportPeriodKind,
} from '@/lib/data/market-report/compute'

const argv = process.argv.slice(2)
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (name: string) => argv.includes(`--${name}`)

function monthEnds(from: string, to: string): string[] {
  const m1 = /^(\d{4})-(\d{2})$/.exec(from)
  const m2 = /^(\d{4})-(\d{2})$/.exec(to)
  if (!m1 || !m2) throw new Error('--from and --to take YYYY-MM')
  let y = Number(m1[1])
  let m = Number(m1[2])
  const endKey = Number(m2[1]) * 12 + Number(m2[2])
  const out: string[] = []
  while (y * 12 + m <= endKey) {
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    out.push(last)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

async function refreshListings() {
  let after = ''
  let total = 0
  const t0 = Date.now()
  for (;;) {
    const r = await refreshMarketReportListingBatch(after, 8000)
    if (!r.ok) throw new Error('refresh batch returned not ok')
    total += r.upserted
    if (r.done) break
    after = r.lastKey
    process.stdout.write(`\r  listings: ${total} rows, last ${after.slice(0, 14)}…   `)
  }
  const geos = await refreshMarketReportGeo()
  console.log(`\n  listings done: ${total} rows, ${geos} geographies, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

async function main() {
  if (has('listings')) {
    console.log('refreshing market_report_listing')
    await refreshListings()
  }
  if (has('facts')) {
    const t0 = Date.now()
    const f = await refreshMarketReportFacts()
    console.log(`facts rebuilt: ${f.sales} sales, ${f.spans} spans, complete through ${f.completeThrough} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
  const from = flag('from')
  const to = flag('to')
  if (!from || !to) return
  if (has('refresh-window')) {
    const t0 = Date.now()
    const r = await refreshReportWindow({
      fromMonth: from,
      toMonth: to,
      spanSince: flag('span-since') ?? `${from}-01`,
      attributesSince: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      log: (line) => console.log(`  ${line} (${((Date.now() - t0) / 1000).toFixed(0)}s)`),
    })
    if (r.periodErrors.length > 0) console.log(`refused periods:\n  ${r.periodErrors.join('\n  ')}`)
    return
  }
  const kinds = (flag('kinds') ?? 'month,trailing3,trailing12,quarter').split(',') as ReportPeriodKind[]
  const definitionId = flag('definition') ?? REPORT_DEFINITION_ID
  const acreageMin = flag('acreage') ? Number(flag('acreage')) : 1
  const ends = monthEnds(from, to)
  console.log(`computing ${ends.length} month ends × [${kinds.join(', ')}] → ${definitionId} (acreage ≥ ${acreageMin})`)
  const t0 = Date.now()
  let calls = 0
  for (const end of ends) {
    const month = Number(end.slice(5, 7))
    for (const kind of kinds) {
      if (kind === 'quarter' && month % 3 !== 0) continue
      const r = await computeMarketReportPeriod(kind, end, { definitionId, acreageMin })
      calls += 1
      if (!r.ok) {
        console.log(`\n  ${kind} ${end}: ${r.error}${r.completeThrough ? ` (complete through ${r.completeThrough})` : ''}`)
        continue
      }
      process.stdout.write(`\r  ${kind.padEnd(10)} ${end}  rows ${r.rows}  bands ${r.bandRows ?? 0}  (${calls} calls, ${((Date.now() - t0) / 1000).toFixed(0)}s)   `)
    }
  }
  console.log(`\ndone: ${calls} periods in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
